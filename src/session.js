/**
 * session.js - Quản lý token theo phiên (Session) cho Môi trường thi OLPAi
 * Giới hạn mặc định: 2,000 token (Input + Output) mỗi phiên
 * Số lượng phiên: Không giới hạn
 */

export const DEFAULT_MAX_TOKENS = 2000;

export class Session {
  /**
   * @param {string} id
   * @param {number} [maxTokens=DEFAULT_MAX_TOKENS]
   */
  constructor(id, maxTokens = DEFAULT_MAX_TOKENS) {
    this.id = id;
    this.maxTokens = typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  get totalTokens() {
    return this.inputTokens + this.outputTokens;
  }

  get remainingTokens() {
    return Math.max(0, this.maxTokens - this.totalTokens);
  }

  get isExceeded() {
    return this.totalTokens >= this.maxTokens;
  }

  get percentage() {
    if (this.maxTokens <= 0) return 100;
    return Math.min(100, Math.round((this.totalTokens / this.maxTokens) * 1000) / 10);
  }

  /**
   * Thêm token vào phiên
   * @param {number} input
   * @param {number} output
   */
  addTokens(input = 0, output = 0) {
    const validIn = Number.isFinite(input) && input > 0 ? Math.round(input) : 0;
    const validOut = Number.isFinite(output) && output > 0 ? Math.round(output) : 0;

    this.inputTokens += validIn;
    this.outputTokens += validOut;
    this.updatedAt = Date.now();
  }

  /**
   * Thiết lập trực tiếp token (tính từ các tin nhắn thực tế của phiên)
   * @param {number} input
   * @param {number} output
   */
  setTokens(input = 0, output = 0) {
    this.inputTokens = Number.isFinite(input) && input >= 0 ? Math.round(input) : 0;
    this.outputTokens = Number.isFinite(output) && output >= 0 ? Math.round(output) : 0;
    this.updatedAt = Date.now();
  }

  /**
   * Chuyển đổi thành Object trả về API
   */
  toJSON() {
    return {
      sessionId: this.id,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
      maxTokens: this.maxTokens,
      remainingTokens: this.remainingTokens,
      percentage: this.percentage,
      isExceeded: this.isExceeded,
      updatedAt: this.updatedAt
    };
  }
}

export class SessionStore {
  /**
   * @param {number} [defaultMaxTokens=DEFAULT_MAX_TOKENS]
   */
  constructor(defaultMaxTokens = DEFAULT_MAX_TOKENS) {
    this.defaultMaxTokens = defaultMaxTokens;
    /** @type {Map<string, Session>} */
    this.sessions = new Map();
  }

  /**
   * Lấy hoặc tạo mới một phiên (không giới hạn số lượng phiên)
   * @param {string} sessionId
   * @returns {Session}
   */
  getOrCreate(sessionId) {
    const id = (typeof sessionId === 'string' && sessionId.trim()) ? sessionId.trim() : `session_${Date.now()}`;
    let session = this.sessions.get(id);
    if (!session) {
      session = new Session(id, this.defaultMaxTokens);
      this.sessions.set(id, session);
    }
    return session;
  }

  /**
   * Lấy phiên nếu đã tồn tại
   * @param {string} sessionId
   * @returns {Session | undefined}
   */
  get(sessionId) {
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  /**
   * Xóa một phiên
   * @param {string} sessionId
   * @returns {boolean}
   */
  delete(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Xóa tất cả các phiên
   */
  clear() {
    this.sessions.clear();
  }
}
