import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OLP_SYSTEM_PROMPT, buildChatMessages, QUICK_TEMPLATES } from '../src/prompts.js';

describe('prompts module', () => {
  it('exports system prompt containing OLP guidance and brevity rules', () => {
    assert.ok(typeof OLP_SYSTEM_PROMPT === 'string');
    assert.ok(OLP_SYSTEM_PROMPT.includes('OLPAi'));
    assert.ok(OLP_SYSTEM_PROMPT.includes('Olympic'));
    assert.ok(OLP_SYSTEM_PROMPT.includes('NGẮN GỌN'));
  });

  it('prepends system prompt to chat messages', () => {
    const userMessages = [
      { role: 'user', content: 'Tìm dãy con tăng dài nhất LIS O(N log N)' }
    ];

    const messages = buildChatMessages(userMessages);

    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, 'system');
    assert.equal(messages[0].content, OLP_SYSTEM_PROMPT);
    assert.equal(messages[1].role, 'user');
    assert.equal(messages[1].content, userMessages[0].content);
  });

  it('allows custom system prompt override', () => {
    const customPrompt = 'Custom Coach';
    const messages = buildChatMessages(
      [{ role: 'user', content: 'Hello' }],
      customPrompt
    );

    assert.equal(messages[0].content, customPrompt);
  });

  it('collapses consecutive messages of same role and filters empty ones', () => {
    const raw = [
      { role: 'user', content: 'cau 1' },
      { role: 'user', content: 'cau 2' },
      { role: 'assistant', content: '   ' },
      { role: 'user', content: 'cau 3' }
    ];
    const messages = buildChatMessages(raw);
    assert.equal(messages.length, 2); // system + 1 merged user message
    assert.equal(messages[1].role, 'user');
    assert.equal(messages[1].content, 'cau 1\n\ncau 2\n\ncau 3');
  });

  it('exports quick templates for OLP topics', () => {
    assert.ok(Array.isArray(QUICK_TEMPLATES));
    assert.ok(QUICK_TEMPLATES.length >= 4);
    assert.ok(QUICK_TEMPLATES.every(t => t.title && t.prompt && t.category));
  });
});
