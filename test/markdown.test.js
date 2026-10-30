import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, normalizeLanguage, buildCodeCardHtml, renderMarkdown, stripThinking } from '../public/js/markdown.js';

describe('markdown and code card module', () => {
  it('escapes dangerous HTML characters', () => {
    const raw = '<script>alert("xss & bug")</script>';
    const escaped = escapeHtml(raw);
    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));
  });

  it('normalizes programming language names', () => {
    assert.equal(normalizeLanguage('c++'), 'cpp');
    assert.equal(normalizeLanguage('CPLUSPLUS'), 'cpp');
    assert.equal(normalizeLanguage('py'), 'python');
    assert.equal(normalizeLanguage('pas'), 'pascal');
    assert.equal(normalizeLanguage(''), 'code');
  });

  it('builds professional code card html with copy button', () => {
    const code = '#include <iostream>\nusing namespace std;\nint main() { return 0; }';
    const cardHtml = buildCodeCardHtml(code, 'cpp');

    assert.ok(cardHtml.includes('class="code-card"'));
    assert.ok(cardHtml.includes('class="code-card-header"'));
    assert.ok(cardHtml.includes('class="code-card-lang"'));
    assert.ok(cardHtml.toLowerCase().includes('cpp'));
    assert.ok(cardHtml.includes('class="copy-btn"'));
    assert.ok(cardHtml.includes('data-code='));
    assert.ok(cardHtml.includes('class="code-card-body"'));
    assert.ok(cardHtml.includes('class="language-cpp"'));
  });

  it('handles empty input in renderMarkdown gracefully', () => {
    assert.equal(renderMarkdown(''), '');
    assert.equal(renderMarkdown(null), '');
  });

  it('strips <think> tags from text via stripThinking and renderMarkdown', () => {
    const raw = '<think>Suy nghĩ thuật toán DP</think>Kết quả là 100';
    assert.equal(stripThinking(raw), 'Kết quả là 100');
    assert.ok(!renderMarkdown(raw).includes('Suy nghĩ thuật toán'));
    assert.ok(renderMarkdown(raw).includes('Kết quả là 100'));
  });

  it('strips prefilled reasoning without opening <think> tag', () => {
    const raw = 'Okay, so I need to figure out how to respond...\n</think>\n\nTôi là Trợ lý AI của OLPAi.';
    assert.equal(stripThinking(raw), 'Tôi là Trợ lý AI của OLPAi.');
    assert.ok(!renderMarkdown(raw).includes('Okay, so I need'));
    assert.ok(renderMarkdown(raw).includes('Tôi là Trợ lý AI của OLPAi.'));
  });
});
