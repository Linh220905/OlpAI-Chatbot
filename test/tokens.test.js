import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countTextTokens, countMessagesTokens } from '../src/tokens.js';

describe('tokens module', () => {
  it('handles empty, null, or undefined text', () => {
    assert.equal(countTextTokens(''), 0);
    assert.equal(countTextTokens(null), 0);
    assert.equal(countTextTokens(undefined), 0);
    assert.equal(countTextTokens('   '), 0);
  });

  it('estimates tokens for English sentences and code', () => {
    const text = 'int main() { return 0; }';
    const count = countTextTokens(text);
    assert.ok(count >= 5 && count <= 15, `Token count should be reasonable: ${count}`);
  });

  it('estimates tokens for Vietnamese text', () => {
    const vnText = 'Thuật toán quy hoạch động giải bài toán cái túi O(N * W)';
    const count = countTextTokens(vnText);
    assert.ok(count >= 10 && count <= 25, `Vietnamese token count should be reasonable: ${count}`);
  });

  it('counts tokens for messages array with system prompt', () => {
    const messages = [
      { role: 'user', content: 'Hãy giải thích thuật toán Dijkstra' },
      { role: 'assistant', content: 'Dijkstra là thuật toán tìm đường đi ngắn nhất...' }
    ];
    const systemPrompt = 'Bạn là trợ lý thi OLP Tin học.';

    const total = countMessagesTokens(messages, systemPrompt);
    assert.ok(total > 20, `Total messages tokens should exceed 20: ${total}`);
  });

  it('handles empty messages array', () => {
    assert.equal(countMessagesTokens([]), 3); // 3 priming tokens
    assert.equal(countMessagesTokens(null), 0);
  });
});
