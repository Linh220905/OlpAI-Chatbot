import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getConfig } from './config.js';
import { buildChatMessages, QUICK_TEMPLATES } from './prompts.js';
import { streamChatCompletion, fetchProviderModels } from './provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

/**
 * Tạo Express Application với cấu hình chỉ định
 * @param {import('./config.js').AppConfig} [customConfig]
 * @returns {express.Express}
 */
export function createApp(customConfig) {
  const config = customConfig || getConfig();
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(PUBLIC_DIR));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        title: 'Môi trường luyện thi OLPAi',
        providerConfigured: Boolean(config.providerApiKey && config.providerApiKey.length > 0),
        baseUrl: config.providerBaseUrl,
        defaultModel: config.defaultModel,
        port: config.port
      }
    });
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
          models: config.availableModels,
          defaultModel: config.defaultModel,
          remoteModels
        }
      });
    } catch {
      res.json({
        success: true,
        data: {
          models: config.availableModels,
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

  // Chat completion streaming endpoint
  app.post('/api/chat', async (req, res) => {
    const { messages, model, temperature, systemPrompt } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Trường messages phải là mảng chứa ít nhất một tin nhắn.'
      });
      return;
    }

    const selectedModel = (typeof model === 'string' && model.trim())
      ? model.trim()
      : config.defaultModel;

    const formattedMessages = buildChatMessages(messages, systemPrompt);

    // Chuẩn bị SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const abortController = new AbortController();

    // Hủy request nếu client ngắt kết nối giữa chừng
    req.on('close', () => {
      abortController.abort();
    });

    try {
      await streamChatCompletion({
        baseUrl: config.providerBaseUrl,
        apiKey: config.providerApiKey,
        model: selectedModel,
        messages: formattedMessages,
        temperature: typeof temperature === 'number' ? temperature : 0.3,
        signal: abortController.signal,
        onChunk: (chunk) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }
      });

      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Lỗi kết nối Provider';
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
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
