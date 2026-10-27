/**
 * markdown.js - Xử lý Markdown, KaTeX và bọc khối Code thành Card chuyên nghiệp
 */

// Escape HTML cơ bản để phòng chống XSS
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chuẩn hóa tên ngôn ngữ
export function normalizeLanguage(lang) {
  if (!lang) return 'code';
  const clean = lang.trim().toLowerCase();
  const map = {
    'c++': 'cpp',
    'cplusplus': 'cpp',
    'py': 'python',
    'python3': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'pas': 'pascal',
    'rs': 'rust'
  };
  return map[clean] || clean;
}

// Render KaTeX nếu thư viện đã tải
function renderMath(text) {
  if (typeof window === 'undefined' || typeof window.katex === 'undefined') {
    return text;
  }

  // Block math: $$ ... $$
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
    try {
      return window.katex.renderToString(expr.trim(), {
        displayMode: true,
        throwOnError: false
      });
    } catch {
      return match;
    }
  });

  // Inline math: $ ... $ (tránh ăn nhầm biến tiền tệ $100)
  processed = processed.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, expr) => {
    try {
      const rendered = window.katex.renderToString(expr.trim(), {
        displayMode: false,
        throwOnError: false
      });
      return prefix + rendered;
    } catch {
      return match;
    }
  });

  return processed;
}

/**
 * Tạo HTML cho Code Cell Card
 * @param {string} codeRaw
 * @param {string} lang
 * @returns {string}
 */
export function buildCodeCardHtml(codeRaw, lang) {
  const normalizedLang = normalizeLanguage(lang);
  let highlightedCode = '';

  const hasHljs = typeof window !== 'undefined' && typeof window.hljs !== 'undefined';
  if (hasHljs && window.hljs.getLanguage(normalizedLang)) {
    try {
      highlightedCode = window.hljs.highlight(codeRaw, { language: normalizedLang, ignoreIllegals: true }).value;
    } catch {
      highlightedCode = escapeHtml(codeRaw);
    }
  } else {
    highlightedCode = escapeHtml(codeRaw);
  }

  const encodedCode = encodeURIComponent(codeRaw);

  return `
<div class="code-card">
  <div class="code-card-header">
    <div class="code-card-lang">
      <span class="lang-icon"></span>
      <span class="lang-text">${escapeHtml(normalizedLang.toUpperCase())}</span>
    </div>
    <button class="copy-btn" data-code="${encodedCode}" title="Sao chép toàn bộ mã nguồn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy code</span>
    </button>
  </div>
  <div class="code-card-body">
    <pre><code class="language-${normalizedLang}">${highlightedCode}</code></pre>
  </div>
</div>`.trim();
}

/**
 * Thiết lập Marked.js renderer
 */
export function configureMarked() {
  if (typeof window === 'undefined' || typeof window.marked === 'undefined') return;

  const renderer = new window.marked.Renderer();

  renderer.code = function ({ text, lang }) {
    return buildCodeCardHtml(text, lang || '');
  };

  window.marked.setOptions({
    renderer,
    gfm: true,
    breaks: true
  });
}

/**
 * Render chuỗi Markdown + KaTeX sang HTML hoàn chỉnh
 * @param {string} markdownText
 * @returns {string}
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  const withMath = renderMath(markdownText);

  if (typeof window !== 'undefined' && typeof window.marked !== 'undefined') {
    try {
      return window.marked.parse(withMath);
    } catch {
      return escapeHtml(withMath);
    }
  }

  return escapeHtml(withMath);
}

/**
 * Khởi tạo sự kiện sao chép code 1-click
 */
export function initCodeCopyHandler() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('.copy-btn');
    if (!btn) return;

    const rawEncoded = btn.getAttribute('data-code');
    if (!rawEncoded) return;

    try {
      const code = decodeURIComponent(rawEncoded);
      await navigator.clipboard.writeText(code);

      const originalHtml = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalHtml;
      }, 2000);
    } catch (err) {
      // Fallback nếu clipboard API bị chặn
      const textarea = document.createElement('textarea');
      textarea.value = decodeURIComponent(rawEncoded);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    }
  });
}
