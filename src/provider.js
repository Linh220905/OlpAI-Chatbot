/**
 * @typedef {Object} SSEParsedResult
 * @property {boolean} done
 * @property {string} content
 * @property {string} reasoning
 * @property {string} [error]
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

      const choice = data.choices && data.choices[0];
      if (!choice) {
        return { done: false, content: '', reasoning: '' };
      }

      const delta = choice.delta || {};
      const content = typeof delta.content === 'string' ? delta.content : '';
      const reasoning = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '';

      return { done: false, content, reasoning };
    } catch {
      // Bỏ qua dòng json không hợp lệ
      return { done: false, content: '', reasoning: '' };
    }
  }

  return { done: false, content: '', reasoning: '' };
}

/**
 * Gửi yêu cầu Chat Completion dạng Streaming tới LLM Provider
 * @param {Object} params
 * @param {string} params.baseUrl
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.temperature=0.3]
 * @param {AbortSignal} [params.signal]
 * @param {(chunk: {content: string, reasoning: string}) => void} params.onChunk
 * @returns {Promise<void>}
 */
export async function streamChatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.3,
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
    stream: true
  };

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
        return;
      }
      if (parsed.content || parsed.reasoning) {
        onChunk({
          content: parsed.content,
          reasoning: parsed.reasoning
        });
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSSEChunk(buffer);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (!parsed.done && (parsed.content || parsed.reasoning)) {
      onChunk({
        content: parsed.content,
        reasoning: parsed.reasoning
      });
    }
  }
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
