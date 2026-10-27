import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/server.js';

describe('server module', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    app = createApp({
      providerBaseUrl: 'https://api.openai.com/v1',
      providerApiKey: 'mock-key',
      availableModels: ['model-1', 'model-2'],
      defaultModel: 'model-1',
      port: 0
    });

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
    assert.deepEqual(json.data.models, ['model-1', 'model-2']);
    assert.equal(json.data.defaultModel, 'model-1');
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

  it('GET / serves HTML page', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Môi trường luyện thi OLPAi'));
  });
});
