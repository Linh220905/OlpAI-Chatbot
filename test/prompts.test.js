import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OLP_SYSTEM_PROMPT, buildChatMessages, QUICK_TEMPLATES } from '../src/prompts.js';

describe('prompts module', () => {
  it('exports system prompt containing OLP guidance', () => {
    assert.ok(typeof OLP_SYSTEM_PROMPT === 'string');
    assert.ok(OLP_SYSTEM_PROMPT.includes('OLPAi'));
    assert.ok(OLP_SYSTEM_PROMPT.includes('Olympic'));
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

  it('exports quick templates for OLP topics', () => {
    assert.ok(Array.isArray(QUICK_TEMPLATES));
    assert.ok(QUICK_TEMPLATES.length >= 4);
    assert.ok(QUICK_TEMPLATES.every(t => t.title && t.prompt && t.category));
  });
});
