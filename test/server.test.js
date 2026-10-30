import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/server.js';
import { SessionStore } from '../src/session.js';

describe('server module', () => {
  let app;
  let server;
  let baseUrl;
  let sessionStore;

  before(async () => {
    sessionStore = new SessionStore(2000);
    app = createApp({
      providerBaseUrl: 'https://llm.example.com/v1',
      providerApiKey: 'mock-key',
      deepseekBaseUrl: 'https://modal.example.com/v1',
      deepseekProxyToken: 'wk-test.ws-test-secret',
      deepseekInitiallyEnabled: true,
      chatbotControlPassword: 'test-control-password',
      availableModels: ['model-1', 'model-2'],
      defaultModel: 'model-1',
      port: 0
    }, sessionStore);

    server = http.createServer(app);
    await new Promise(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    server.close();
  });

  it('GET /api/health returns system status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'ok');
    assert.equal(json.data.defaultModel, 'model-1');
  });

  it('GET /api/models returns available models', async () => {
    const res = await fetch(`${baseUrl}/api/models`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.deepEqual(json.data.models, [
      'deepseek-32b',
      'ag/gemini-3.8-flash-high',
      'model-1',
      'model-2'
    ]);
    assert.equal(json.data.defaultModel, 'model-1');
  });

  it('chatbot control rejects an incorrect password before calling Modal', async () => {
    const res = await fetch(`${baseUrl}/api/chatbot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'incorrect' })
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { success: false, error: 'Mật khẩu không đúng.' });
  });

  it('GET /api/templates returns quick OLP templates', async () => {
    const res = await fetch(`${baseUrl}/api/templates`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
  });

  it('POST /api/chat rejects missing messages', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.error.includes('messages'));
  });

  it('POST /api/chat routes DeepSeek to Modal with up to 4090 reasoning/output tokens', async () => {
    const originalFetch = globalThis.fetch;
    let upstreamRequest;
    globalThis.fetch = async (url, options) => {
      if (url === 'https://modal.example.com/v1/chat/completions') {
        upstreamRequest = { url, options };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'Xin chào' } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { 'Content-Type': 'text/event-stream' } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'deepseek-routing-test',
          model: 'deepseek-32b',
          messages: [{ role: 'user', content: 'Xin chào' }]
        })
      });
      assert.equal(res.status, 200);
      assert.match(await res.text(), /Xin chào/);
      assert.equal(upstreamRequest.url, 'https://modal.example.com/v1/chat/completions');
      const payload = JSON.parse(upstreamRequest.options.body);
      assert.equal(payload.model, 'deepseek-32b');
      assert.equal(payload.max_tokens, 4090);
      assert.equal(payload.thinking_token_budget, 256);
      assert.equal(payload.stream, true);
      assert.equal(upstreamRequest.options.headers.Authorization, 'Bearer wk-test.ws-test-secret');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/chat raises DeepSeek reasoning budget for OLP/code questions', async () => {
    const originalFetch = globalThis.fetch;
    let upstreamPayload;
    globalThis.fetch = async (url, options) => {
      if (url === 'https://modal.example.com/v1/chat/completions') {
        upstreamPayload = JSON.parse(options.body);
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'Độ phức tạp O(N).' } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { 'Content-Type': 'text/event-stream' } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'deepseek-olp-reasoning-budget-test',
          model: 'deepseek-32b',
          messages: [{ role: 'user', content: 'Giải thuật này có độ phức tạp nào? Viết code C++.' }]
        })
      });
      assert.equal(res.status, 200);
      await res.text();
      assert.equal(upstreamPayload.thinking_token_budget, 768);
      assert.equal(upstreamPayload.max_tokens, 4090);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('POST /api/chat requires explicit chatbot start before using DeepSeek', async () => {
    const gatedApp = createApp({
      providerBaseUrl: 'https://llm.example.com/v1',
      providerApiKey: 'mock-key',
      deepseekBaseUrl: 'https://modal.example.com/v1',
      availableModels: ['deepseek-32b'],
      defaultModel: 'deepseek-32b',
      port: 0
    });
    const gatedServer = http.createServer(gatedApp);
    await new Promise(resolve => gatedServer.listen(0, '127.0.0.1', resolve));
    const gatedUrl = `http://127.0.0.1:${gatedServer.address().port}`;

    try {
      const res = await fetch(`${gatedUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'deepseek-not-started-test',
          model: 'deepseek-32b',
          messages: [{ role: 'user', content: 'Xin chào' }]
        })
      });
      assert.equal(res.status, 503);
      const json = await res.json();
      assert.equal(json.code, 'CHATBOT_NOT_STARTED');
    } finally {
      await new Promise(resolve => gatedServer.close(resolve));
    }
  });

  it('POST /api/chat routes Gemini through the configured provider', async () => {
    const originalFetch = globalThis.fetch;
    let upstreamRequest;
    globalThis.fetch = async (url, options) => {
      if (url === 'https://llm.example.com/v1/chat/completions') {
        upstreamRequest = { url, options };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'Gemini trả lời' } }] })}\n\ndata: [DONE]\n\n`,
          { headers: { 'Content-Type': 'text/event-stream' } }
        );
      }
      return originalFetch(url, options);
    };

    try {
      const res = await originalFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'gemini-routing-test',
          model: 'ag/gemini-3.8-flash-high',
          messages: [{ role: 'user', content: 'Xin chào' }]
        })
      });
      assert.equal(res.status, 200);
      assert.match(await res.text(), /Gemini trả lời/);
      assert.equal(upstreamRequest.url, 'https://llm.example.com/v1/chat/completions');
      assert.equal(upstreamRequest.options.headers.Authorization, 'Bearer mock-key');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('GET /api/sessions/:id returns session token status', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/test-session-1`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.sessionId, 'test-session-1');
    assert.equal(json.data.maxTokens, 2000);
    assert.equal(json.data.totalTokens, 0);
    assert.equal(json.data.isExceeded, false);
  });

  it('POST /api/chat rejects when session reaches 2000 tokens', async () => {
    const sessionId = 'exceeded-session';
    const session = sessionStore.getOrCreate(sessionId);
    session.addTokens(1000, 1000); // Đã đủ 2000 token

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messages: [{ role: 'user', content: 'Xin chào AI' }]
      })
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.code, 'SESSION_TOKEN_LIMIT_REACHED');
    assert.ok(json.error.includes('2,000 token'));
  });

  it('POST /api/chat rejects when input tokens exceed remaining session tokens', async () => {
    const sessionId = 'near-limit-session';
    const session = sessionStore.getOrCreate(sessionId);
    session.addTokens(1000, 950); // total 1950 tokens, remaining 50

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messages: [{
          role: 'user',
          content: 'Đây là một câu hỏi rất dài với nhiều nội dung thuật toán quy hoạch động, cây phân đoạn Segment Tree, đồ thị luồng cực đại Dinic và cấu trúc dữ liệu nâng cao nhằm mục đích tạo ra một chuỗi văn bản có độ dài vượt mức năm mươi token để kiểm tra việc từ chối khi vượt quá ngân sách còn lại của phiên thi.'
        }]
      })
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.code, 'SESSION_TOKEN_LIMIT_REACHED');
    assert.ok(json.error.includes('vượt quá'));
  });

  it('DELETE /api/sessions/:id clears session', async () => {
    sessionStore.getOrCreate('del-session').addTokens(200, 300);
    const delRes = await fetch(`${baseUrl}/api/sessions/del-session`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    const json = await delRes.json();
    assert.equal(json.success, true);

    const getRes = await fetch(`${baseUrl}/api/sessions/del-session`);
    const getJson = await getRes.json();
    assert.equal(getJson.data.totalTokens, 0);
  });

  it('GET / serves HTML page', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Môi trường luyện thi OLPAi'));
  });
});
