import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { streamChatCompletion, parseSSEChunk, fetchProviderModels } from '../src/provider.js';

describe('provider module', () => {
  let mockServer;
  let mockPort;
  let mockBaseUrl;

  before(async () => {
    mockServer = http.createServer((req, res) => {
      if (req.url === '/v1/models' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: [
            { id: 'model-remote-1' },
            { id: 'model-remote-2' }
          ]
        }));
        return;
      }

      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const parsed = JSON.parse(body);

          if (parsed.model === 'error-model') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'Invalid model' } }));
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          res.write('data: {"choices":[{"delta":{"content":"Xin"}}]}\n\n');
          res.write('data: {"choices":[{"delta":{"content":" chao"}}]}\n\n');
          res.write('data: [DONE]\n\n');
          res.end();
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise(resolve => {
      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = mockServer.address().port;
        mockBaseUrl = `http://127.0.0.1:${mockPort}/v1`;
        resolve();
      });
    });
  });

  after(() => {
    mockServer.close();
  });

  it('parses SSE lines correctly', () => {
    const line = 'data: {"choices":[{"delta":{"content":"test"}}]}';
    const parsed = parseSSEChunk(line);
    assert.equal(parsed.done, false);
    assert.equal(parsed.content, 'test');

    const doneLine = 'data: [DONE]';
    const parsedDone = parseSSEChunk(doneLine);
    assert.equal(parsedDone.done, true);

    const empty = parseSSEChunk(': keep-alive');
    assert.equal(empty.content, '');
  });

  it('streams chat completion from provider', async () => {
    const received = [];

    await streamChatCompletion({
      baseUrl: mockBaseUrl,
      apiKey: 'test-key',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      onChunk: (chunk) => {
        received.push(chunk.content);
      }
    });

    assert.equal(received.join(''), 'Xin chao');
  });

  it('handles provider error status codes gracefully', async () => {
    await assert.rejects(
      async () => {
        await streamChatCompletion({
          baseUrl: mockBaseUrl,
          apiKey: 'test-key',
          model: 'error-model',
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => {}
        });
      },
      /Invalid model/
    );
  });

  it('fetches remote models from provider', async () => {
    const models = await fetchProviderModels(mockBaseUrl, 'test-key');
    assert.deepEqual(models, ['model-remote-1', 'model-remote-2']);
  });
});
