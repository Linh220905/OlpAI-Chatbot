/**
 * @typedef {Object} SSEParsedResult
 * @property {boolean} done
 * @property {string} content
 * @property {string} reasoning
 * @property {string} [error]
 * @property {{promptTokens?: number, completionTokens?: number, totalTokens?: number}} [usage]
 */

/**
 * Phân tích một dòng SSE từ OpenAI-compatible provider
 * @param {string} rawLine
 * @returns {SSEParsedResult}
 */
export function parseSSEChunk(rawLine) {
  const line = rawLine.trim();

  if (!line || line.startsWith(':')) {
    return { done: false, content: '', reasoning: '' };
  }

  if (line.startsWith('data:')) {
    const payload = line.slice(5).trim();

    if (payload === '[DONE]') {
      return { done: true, content: '', reasoning: '' };
    }

    try {
      const data = JSON.parse(payload);

      if (data.error) {
        const errMsg = typeof data.error === 'object'
          ? (data.error.message || JSON.stringify(data.error))
          : String(data.error);
        return { done: false, content: '', reasoning: '', error: errMsg };
      }

      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined;

      const choice = data.choices && data.choices[0];
      if (!choice) {
        return { done: false, content: '', reasoning: '', usage };
      }

      const delta = choice.delta || {};
      const content = typeof delta.content === 'string'
        ? delta.content
        : (typeof delta.text === 'string' ? delta.text : (typeof choice.text === 'string' ? choice.text : ''));
      const reasoning = typeof delta.reasoning_content === 'string'
        ? delta.reasoning_content
        : (typeof delta.reasoning === 'string'
          ? delta.reasoning
          : (typeof delta.thought === 'string' ? delta.thought : ''));

      return { done: false, content, reasoning, usage };
    } catch {
      // Bỏ qua dòng json không hợp lệ
      return { done: false, content: '', reasoning: '' };
    }
  }

  return { done: false, content: '', reasoning: '' };
}

/**
 * Bộ lọc tách thẻ <think>...</think> hoặc prefilled reasoning từ content thành reasoning trong luồng stream
 * @param {(chunk: {content: string, reasoning: string, usage?: any, error?: string}) => void} onChunk
 * @param {{isReasoningModel?: boolean, model?: string}} [options]
 * @returns {((chunk: {content: string, reasoning: string, usage?: any, error?: string}) => void) & {flush: () => void}}
 */
export function createThinkFilter(onChunk, options = {}) {
  const isReasoningModel = Boolean(
    options.isReasoningModel ||
    (typeof options.model === 'string' && (
      options.model.toLowerCase().includes('deepseek') ||
      options.model.toLowerCase().includes('r1') ||
      options.model.toLowerCase().includes('reasoner')
    ))
  );

  let inThink = isReasoningModel;
  let buffer = '';

  const processBuffer = (isFlush = false) => {
    let finalContent = '';
    let reasoning = '';

    while (buffer.length > 0) {
      if (inThink) {
        if (buffer.startsWith('<think>')) {
          buffer = buffer.slice(7);
          continue;
        }

        const closeIdx = buffer.indexOf('</think>');
        if (closeIdx !== -1) {
          reasoning += buffer.slice(0, closeIdx);
          buffer = buffer.slice(closeIdx + 8);
          inThink = false;
        } else {
          if (!isFlush) {
            let possibleCloseTag = false;
            for (let i = 1; i < 8; i++) {
              if (buffer.endsWith('</think>'.slice(0, i))) {
                possibleCloseTag = true;
                break;
              }
            }
            if (possibleCloseTag) {
              break;
            }
          }
          reasoning += buffer;
          buffer = '';
        }
      } else {
        const rogueCloseIdx = buffer.indexOf('</think>');
        if (rogueCloseIdx !== -1) {
          reasoning += buffer.slice(0, rogueCloseIdx);
          buffer = buffer.slice(rogueCloseIdx + 8);
          continue;
        }

        const openIdx = buffer.indexOf('<think>');
        if (openIdx !== -1) {
          finalContent += buffer.slice(0, openIdx);
          buffer = buffer.slice(openIdx + 7);
          inThink = true;
        } else {
          if (!isFlush) {
            let possibleOpenTag = false;
            for (let i = 1; i < 7; i++) {
              if (buffer.endsWith('<think>'.slice(0, i))) {
                possibleOpenTag = true;
                break;
              }
            }
            if (possibleOpenTag) {
              break;
            }
          }
          finalContent += buffer;
          buffer = '';
        }
      }
    }

    return { finalContent, reasoning };
  };

  const filter = (chunk) => {
    const rawContent = chunk.content || '';
    const chunkReasoning = chunk.reasoning || '';

    if (rawContent) {
      buffer += rawContent;
    }

    const { finalContent, reasoning } = processBuffer(false);
    const combinedReasoning = (chunkReasoning + reasoning);

    if (finalContent || combinedReasoning || chunk.usage || chunk.error) {
      onChunk({
        ...chunk,
        content: finalContent,
        reasoning: combinedReasoning
      });
    }
  };

  filter.flush = () => {
    const { finalContent, reasoning } = processBuffer(true);
    if (finalContent || reasoning) {
      onChunk({
        content: finalContent,
        reasoning
      });
    }
  };

  return filter;
}

/**
 * Gửi yêu cầu Chat Completion dạng Streaming tới LLM Provider
 * @param {Object} params
 * @param {string} params.baseUrl
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.temperature=0.3]
 * @param {number} [params.max_tokens]
 * @param {number} [params.thinking_token_budget]
 * @param {AbortSignal} [params.signal]
 * @param {(chunk: {content: string, reasoning: string, usage?: {promptTokens?: number, completionTokens?: number, totalTokens?: number}}) => void} params.onChunk
 * @returns {Promise<void>}
 */
export async function streamChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.3,
  max_tokens,
  thinking_token_budget,
  signal,
  onChunk
}) {
  const endpoint = `${baseUrl}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const payload = {
    model,
    messages,
    temperature,
    stream: true,
    stream_options: { include_usage: true }
  };

  if (typeof max_tokens === 'number' && max_tokens > 0) {
    payload.max_tokens = max_tokens;
  }

  if (typeof thinking_token_budget === 'number' && thinking_token_budget > 0) {
    payload.thinking_token_budget = thinking_token_budget;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error && errorJson.error.message) {
        errorDetail = errorJson.error.message;
      } else if (typeof errorJson === 'string') {
        errorDetail = errorJson;
      }
    } catch {
      // response không phải JSON
    }
    throw new Error(`Provider Error (${response.status}): ${errorDetail}`);
  }

  if (!response.body) {
    throw new Error('Provider response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const filteredOnChunk = createThinkFilter(onChunk, {
    model,
    isReasoningModel: Boolean(
      model && (
        model.toLowerCase().includes('deepseek') ||
        model.toLowerCase().includes('r1') ||
        model.toLowerCase().includes('reasoner')
      )
    )
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const parsed = parseSSEChunk(line);
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      if (parsed.done) {
        filteredOnChunk.flush();
        return;
      }
      if (parsed.content || parsed.reasoning || parsed.usage) {
        filteredOnChunk({
          content: parsed.content,
          reasoning: parsed.reasoning,
          usage: parsed.usage
        });
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSSEChunk(buffer);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (!parsed.done && (parsed.content || parsed.reasoning || parsed.usage)) {
      filteredOnChunk({
        content: parsed.content,
        reasoning: parsed.reasoning,
        usage: parsed.usage
      });
    }
  }
  filteredOnChunk.flush();
}

/**
 * Lấy danh sách các models từ provider endpoint /models
 * @param {string} baseUrl
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
export async function fetchProviderModels(baseUrl, apiKey) {
  try {
    const endpoint = `${baseUrl}/models`;
    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    if (Array.isArray(json.data)) {
      return json.data
        .map(m => m && m.id)
        .filter(id => typeof id === 'string');
    }
    return [];
  } catch {
    return [];
  }
}
