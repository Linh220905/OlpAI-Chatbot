import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, normalizeLanguage, buildCodeCardHtml, renderMarkdown } from '../public/js/markdown.js';

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
    assert.ok(cardHtml.includes('CPP'));
    assert.ok(cardHtml.includes('class="copy-btn"'));
    assert.ok(cardHtml.includes('data-code='));
    assert.ok(cardHtml.includes('class="code-card-body"'));
    assert.ok(cardHtml.includes('class="language-cpp"'));
  });

  it('handles empty input in renderMarkdown gracefully', () => {
    assert.equal(renderMarkdown(''), '');
    assert.equal(renderMarkdown(null), '');
  });
});
