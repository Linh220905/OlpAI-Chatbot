import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getConfig } from './config.js';
import { buildChatMessages, QUICK_TEMPLATES } from './prompts.js';
import { streamChatCompletion, fetchProviderModels } from './provider.js';
import { SessionStore, DEFAULT_MAX_TOKENS } from './session.js';
import { countMessagesTokens, countTextTokens } from './tokens.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const DEEPSEEK_MODEL = 'deepseek-32b';
const GEMINI_MODEL = 'ag/gemini-3.8-flash-high';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://linh220905--deepseek-32b-service-serve.us-east.modal.run/v1';
const MAX_OUTPUT_TOKENS = 4090;
const DEFAULT_REASONING_TOKEN_BUDGET = 256;
const OLP_REASONING_TOKEN_BUDGET = 768;
const execFileAsync = promisify(execFile);
const MODAL_CONTROL_SCRIPT = path.resolve(__dirname, '../modal_deepseek/control.py');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function passwordMatches(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function getReasoningTokenBudget(messages) {
  const lastUserMessage = [...messages].reverse().find(message => message?.role === 'user');
  const text = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';
  const olpTaskPattern = /```|\b(?:algorithm|algorithms|code|debug|icpc|olp|dp|bfs|dfs|dijkstra|segment tree|binary search|time complexity|runtime|compile|tle|wa)\b|thuật toán|giải thuật|lập trình|viết\s+(?:code|chương trình)|tối ưu|quy hoạch động|đồ thị|cây phân đoạn|độ phức tạp|chứng minh|gỡ lỗi|sửa lỗi|c\+\+|python/i;
  return olpTaskPattern.test(text)
    ? OLP_REASONING_TOKEN_BUDGET
    : DEFAULT_REASONING_TOKEN_BUDGET;
}

async function updateDeepseekAutoscaler(action) {
  await execFileAsync(
    process.env.MODAL_PYTHON || 'python',
    [MODAL_CONTROL_SCRIPT, action],
    { cwd: PROJECT_ROOT, timeout: action === 'stop' ? 210_000 : 30_000 }
  );
}

/**
 * Tạo Express Application với cấu hình chỉ định
 * @param {import('./config.js').AppConfig} [customConfig]
 * @param {SessionStore} [customSessionStore]
 * @returns {express.Express}
 */
export function createApp(customConfig, customSessionStore) {
  const config = customConfig || getConfig();
  const sessionStore = customSessionStore || new SessionStore(DEFAULT_MAX_TOKENS);
  let deepseekEnabled = config.deepseekInitiallyEnabled === true;
  const activeDeepseekControllers = new Set();
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Tránh browser cache file tĩnh JS/CSS trong quá trình phát triển
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  app.use(express.static(PUBLIC_DIR));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        title: 'Môi trường luyện thi OLPAi',
        providerConfigured: Boolean(
          (config.providerApiKey && config.providerApiKey.length > 0) || config.deepseekBaseUrl
        ),
        chatbotControlConfigured: Boolean(config.chatbotControlPassword),
        deepseekProxyConfigured: Boolean(config.deepseekProxyToken),
        baseUrl: config.providerBaseUrl,
        defaultModel: config.defaultModel,
        port: config.port
      }
    });
  });

  app.post('/api/chatbot/start', async (req, res) => {
    if (!config.chatbotControlPassword) {
      res.status(503).json({ success: false, error: 'Chưa cấu hình mật khẩu điều khiển chatbot.' });
      return;
    }
    if (!passwordMatches(req.body?.password, config.chatbotControlPassword)) {
      res.status(401).json({ success: false, error: 'Mật khẩu không đúng.' });
      return;
    }
    if (!config.deepseekProxyToken) {
      res.status(503).json({
        success: false,
        error: 'Chưa cấu hình DEEPSEEK_MODAL_PROXY_TOKEN để xác thực endpoint Modal.'
      });
      return;
    }

    try {
      await updateDeepseekAutoscaler('start');
      const healthUrl = `${(config.deepseekBaseUrl || DEFAULT_DEEPSEEK_BASE_URL).replace(/\/v1\/?$/, '')}/health`;
      const response = await fetch(healthUrl, {
        headers: { Authorization: `Bearer ${config.deepseekProxyToken}` },
        signal: AbortSignal.timeout(630_000)
      });
      if (!response.ok) {
        throw new Error(`DeepSeek chưa sẵn sàng (HTTP ${response.status}).`);
      }
      deepseekEnabled = true;
      res.json({ success: true, status: 'ready', message: 'DeepSeek đã khởi tạo, có thể chat.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể khởi tạo chatbot.';
      res.status(502).json({ success: false, error: message });
    }
  });

  app.post('/api/chatbot/stop', async (req, res) => {
    if (!config.chatbotControlPassword) {
      res.status(503).json({ success: false, error: 'Chưa cấu hình mật khẩu điều khiển chatbot.' });
      return;
    }
    if (!passwordMatches(req.body?.password, config.chatbotControlPassword)) {
      res.status(401).json({ success: false, error: 'Mật khẩu không đúng.' });
      return;
    }

    try {
      deepseekEnabled = false;
      for (const controller of activeDeepseekControllers) controller.abort();
      await updateDeepseekAutoscaler('stop');
      await new Promise(resolve => setTimeout(resolve, 2500));
      res.json({
        success: true,
        status: 'stopped',
        message: 'DeepSeek đã dừng; cần khởi động lại trước khi chat.'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tắt chatbot.';
      res.status(502).json({ success: false, error: message });
    }
  });

  // Get available models
  app.get('/api/models', async (req, res) => {
    try {
      let remoteModels = [];
      if (config.providerApiKey) {
        remoteModels = await fetchProviderModels(config.providerBaseUrl, config.providerApiKey);
      }

      res.json({
        success: true,
        data: {
          models: Array.from(new Set([DEEPSEEK_MODEL, GEMINI_MODEL, ...config.availableModels])),
          defaultModel: config.defaultModel,
          remoteModels
        }
      });
    } catch {
      res.json({
        success: true,
        data: {
          models: Array.from(new Set([DEEPSEEK_MODEL, GEMINI_MODEL, ...config.availableModels])),
          defaultModel: config.defaultModel,
          remoteModels: []
        }
      });
    }
  });

  // Quick prompt templates for OLP
  app.get('/api/templates', (req, res) => {
    res.json({
      success: true,
      data: QUICK_TEMPLATES
    });
  });

  // Thông tin token của một session trong phòng thi (tối đa 2,000 token)
  app.get('/api/sessions/:id', (req, res) => {
    const session = sessionStore.getOrCreate(req.params.id);
    res.json({
      success: true,
      data: session.toJSON()
    });
  });

  // Xóa session (khi thí sinh xóa đoạn chat, số lượng session không giới hạn)
  app.delete('/api/sessions/:id', (req, res) => {
    sessionStore.delete(req.params.id);
    res.json({
      success: true,
      message: 'Đã xóa dữ liệu session'
    });
  });

  // Chat completion streaming endpoint
  app.post('/api/chat', async (req, res) => {
    const { messages, model, temperature, systemPrompt, sessionId } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Trường messages phải là mảng chứa ít nhất một tin nhắn.'
      });
      return;
    }

    const currentSessionId = (typeof sessionId === 'string' && sessionId.trim())
      ? sessionId.trim()
      : 'default_session';

    const session = sessionStore.getOrCreate(currentSessionId);

    // Kiểm tra giới hạn 2,000 token của session
    if (session.isExceeded) {
      res.status(403).json({
        success: false,
        code: 'SESSION_TOKEN_LIMIT_REACHED',
        error: 'Phiên thi này đã đạt giới hạn tối đa 2,000 token (Input + Output). Vui lòng tạo phiên mới để tiếp tục.',
        data: { tokenUsage: session.toJSON() }
      });
      return;
    }

    const selectedModel = (typeof model === 'string' && model.trim())
      ? model.trim()
      : config.defaultModel;
    const isDeepseekModel = selectedModel === DEEPSEEK_MODEL;
    const selectedProvider = isDeepseekModel
      ? {
          baseUrl: config.deepseekBaseUrl || DEFAULT_DEEPSEEK_BASE_URL,
          apiKey: config.deepseekProxyToken || ''
        }
      : { baseUrl: config.providerBaseUrl, apiKey: config.providerApiKey };

    if (isDeepseekModel && !deepseekEnabled) {
      res.status(503).json({
        success: false,
        code: 'CHATBOT_NOT_STARTED',
        error: 'DeepSeek đang tắt. Nhấn “Khởi động” và chờ sẵn sàng trước khi chat.'
      });
      return;
    }

    const formattedMessages = buildChatMessages(messages, systemPrompt);

    // CHỈ tính input người dùng nhập (không tính kèm system prompt ẩn)
    const lastUserMsg = [...messages].reverse().find(m => m && m.role === 'user');
    const incomingInputTokens = lastUserMsg && typeof lastUserMsg.content === 'string'
      ? countTextTokens(lastUserMsg.content)
      : 0;

    // Kiểm tra nếu input của người dùng vượt quá số token còn lại của session
    if (session.totalTokens + incomingInputTokens > session.maxTokens) {
      res.status(403).json({
        success: false,
        code: 'SESSION_TOKEN_LIMIT_REACHED',
        error: `Tin nhắn của bạn sẽ vượt quá giới hạn độ dài của đoạn chat này. Cần ~${incomingInputTokens} token, còn lại ${session.remainingTokens} token (tối đa 2,000 token). Hãy thử rút ngắn tin nhắn hoặc bắt đầu một đoạn chat mới.`,
        data: { tokenUsage: session.toJSON() }
      });
      return;
    }

    const maxAllowedVisibleOutput = Math.max(1, session.maxTokens - session.totalTokens - incomingInputTokens);

    // Chuẩn bị SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const abortController = new AbortController();
    if (isDeepseekModel) activeDeepseekControllers.add(abortController);

    // Hủy request nếu client thực sự ngắt kết nối giữa chừng (res.on close khi writableFinished là false)
    res.on('close', () => {
      if (!res.writableFinished) {
        abortController.abort();
      }
    });

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      await streamChatCompletion({
        baseUrl: selectedProvider.baseUrl,
        apiKey: selectedProvider.apiKey,
        model: selectedModel,
        messages: formattedMessages,
        temperature: typeof temperature === 'number' ? temperature : 0.3,
        // max_tokens also covers hidden reasoning; visible output is separately capped by session budget below.
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(isDeepseekModel ? { thinking_token_budget: getReasoningTokenBudget(messages) } : {}),
        signal: abortController.signal,
        onChunk: (chunk) => {
          if (chunk.content) accumulatedContent += chunk.content;
          if (chunk.reasoning) accumulatedReasoning += chunk.reasoning;

          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          // Dừng stream nếu CHỈ PHẦN NỘI DUNG HIỂN THỊ (accumulatedContent) chạm trần hạn mức còn lại
          // Hoàn toàn KHÔNG tính token suy luận ngầm (accumulatedReasoning)
          const currentVisibleOutputTokens = countTextTokens(accumulatedContent);
          if (currentVisibleOutputTokens >= maxAllowedVisibleOutput) {
            abortController.abort();
          }
        }
      });

      // Cập nhật số token cho session: CHỈ tính input người dùng và nội dung hiển thị màn hình
      const finalInputTokens = incomingInputTokens;
      const finalOutputTokens = countTextTokens(accumulatedContent);
      session.addTokens(finalInputTokens, finalOutputTokens);

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ tokenUsage: session.toJSON() })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        const finalInputTokens = incomingInputTokens;
        const finalOutputTokens = countTextTokens(accumulatedContent);
        session.addTokens(finalInputTokens, finalOutputTokens);

        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ tokenUsage: session.toJSON() })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Lỗi kết nối Provider';
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } finally {
      if (isDeepseekModel) activeDeepseekControllers.delete(abortController);
    }
  });

  // Fallback to index.html for SPA
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}

// Chạy trực tiếp nếu file là entry point
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const config = getConfig();
  const app = createApp(config);
  app.listen(config.port, () => {
    process.stdout.write(
      `[OLPAi Server] Đang chạy tại http://localhost:${config.port}\n` +
      `[Provider] Base URL: ${config.providerBaseUrl} | Model mặc định: ${config.defaultModel}\n`
    );
  });
}
