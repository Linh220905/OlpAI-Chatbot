/**
 * tokens.js - Module ước tính và đếm token cho Môi trường luyện thi OLPAi
 */

/**
 * Đếm/ước tính số token của chuỗi văn bản
 * Phù hợp với BPE tokenizer chuẩn (OpenAI cl100k, Claude) cho tiếng Việt, tiếng Anh và code
 * @param {string} text
 * @returns {number}
 */
export function countTextTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // Ghép khoảng trắng phía trước với từ (tương tự quy tắc BPE)
  const matches = trimmed.match(/\s*[\p{L}\p{N}]+|[^\s\p{L}\p{N}]|\s{2,}/gu);
  if (!matches) return 0;

  let count = 0;
  for (const part of matches) {
    const clean = part.trim();
    if (!clean) {
      count += Math.max(1, Math.floor(part.length / 4));
    } else if (clean.length > 5) {
      count += Math.ceil(clean.length / 4);
    } else {
      count += 1;
    }
  }

  return Math.max(1, count);
}

/**
 * Đếm tổng số token của danh sách tin nhắn chat chuẩn OpenAI
 * Bao gồm token overhead của mỗi message và system prompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} [systemPrompt]
 * @returns {number}
 */
export function countMessagesTokens(messages, systemPrompt) {
  if (!Array.isArray(messages)) return 0;

  let total = 3; // priming assistant response

  if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
    total += 4 + countTextTokens(systemPrompt);
  }

  for (const msg of messages) {
    if (!msg) continue;
    total += 4; // overhead cho mỗi message block
    if (msg.role) total += 1;
    if (msg.content) {
      total += countTextTokens(msg.content);
    }
  }

  return total;
}
