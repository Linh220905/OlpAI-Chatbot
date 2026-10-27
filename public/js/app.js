/**
 * app.js - Logic điều khiển giao diện chính của Môi trường luyện thi OLPAi
 */

import { configureMarked, renderMarkdown, initCodeCopyHandler, escapeHtml } from './markdown.js';

// LocalStorage key
const STORAGE_KEY = 'olpai_chat_history_v1';
const SELECTED_MODEL_KEY = 'olpai_selected_model_v1';

class OLPAiApp {
  constructor() {
    this.chats = this.loadChatsFromStorage();
    this.currentChatId = null;
    this.availableModels = [];
    this.selectedModel = localStorage.getItem(SELECTED_MODEL_KEY) || 'gpt-4o-mini';
    this.isStreaming = false;
    this.abortController = null;
    this.templates = [];

    this.cacheDom();
    this.bindEvents();
  }

  cacheDom() {
    this.dom = {
      sidebar: document.getElementById('sidebar'),
      btnToggleSidebar: document.getElementById('btnToggleSidebar'),
      btnNewChat: document.getElementById('btnNewChat'),
      chatHistoryList: document.getElementById('chatHistoryList'),
      providerStatusDot: document.getElementById('providerStatusDot'),
      providerStatusText: document.getElementById('providerStatusText'),

      modelSelectorBtn: document.getElementById('modelSelectorBtn'),
      currentModelLabel: document.getElementById('currentModelLabel'),
      modelDropdown: document.getElementById('modelDropdown'),
      modelOptionsList: document.getElementById('modelOptionsList'),
      customModelInput: document.getElementById('customModelInput'),
      btnApplyCustomModel: document.getElementById('btnApplyCustomModel'),

      chatContainer: document.getElementById('chatContainer'),
      chatInner: document.getElementById('chatInner'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      quickTemplatesGrid: document.getElementById('quickTemplatesGrid'),

      chatTextarea: document.getElementById('chatTextarea'),
      btnSend: document.getElementById('btnSend'),
      btnStop: document.getElementById('btnStop')
    };
  }

  bindEvents() {
    // Khởi tạo marked & copy handler
    configureMarked();
    initCodeCopyHandler();

    // Toggle Sidebar
    if (this.dom.btnToggleSidebar) {
      this.dom.btnToggleSidebar.addEventListener('click', () => {
        this.dom.sidebar.classList.toggle('open');
      });
    }

    // New Chat Button
    this.dom.btnNewChat.addEventListener('click', () => {
      this.createNewChat();
    });

    // Model Selector Dropdown
    this.dom.modelSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.modelDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!this.dom.modelDropdown.contains(e.target) && e.target !== this.dom.modelSelectorBtn) {
        this.dom.modelDropdown.classList.remove('open');
      }
    });

    // Apply custom model
    this.dom.btnApplyCustomModel.addEventListener('click', () => {
      const val = this.dom.customModelInput.value.trim();
      if (val) {
        this.selectModel(val);
        this.dom.customModelInput.value = '';
        this.dom.modelDropdown.classList.remove('open');
      }
    });

    // Textarea Auto-grow & Enter to Send
    this.dom.chatTextarea.addEventListener('input', () => {
      this.autoGrowTextarea();
      this.updateSendButtonState();
    });

    this.dom.chatTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Send & Stop Buttons
    this.dom.btnSend.addEventListener('click', () => {
      this.handleSendMessage();
    });

    this.dom.btnStop.addEventListener('click', () => {
      this.stopStreaming();
    });
  }

  async init() {
    await this.fetchHealthAndConfig();
    await this.fetchTemplates();
    this.renderChatHistoryList();

    // Khởi tạo chat ban đầu
    if (this.chats.length > 0) {
      this.loadChat(this.chats[0].id);
    } else {
      this.createNewChat();
    }
  }

  autoGrowTextarea() {
    const el = this.dom.chatTextarea;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  updateSendButtonState() {
    const hasText = Boolean(this.dom.chatTextarea.value.trim());
    this.dom.btnSend.disabled = !hasText || this.isStreaming;
  }

  // Quản lý Models & Provider
  async fetchHealthAndConfig() {
    try {
      const healthRes = await fetch('/api/health');
      const healthData = await healthRes.json();

      if (healthData.success && healthData.data.providerConfigured) {
        this.dom.providerStatusDot.className = 'status-dot';
        this.dom.providerStatusText.textContent = `Provider Sẵn sàng (${healthData.data.baseUrl.replace('https://', '')})`;
      } else {
        this.dom.providerStatusDot.className = 'status-dot warning';
        this.dom.providerStatusText.textContent = 'Chưa cấu hình API Key trong .env';
      }

      const modelsRes = await fetch('/api/models');
      const modelsData = await modelsRes.json();

      if (modelsData.success && modelsData.data) {
        const configured = modelsData.data.models || [];
        const remote = modelsData.data.remoteModels || [];

        // Hợp nhất danh sách model không trùng lặp
        const combined = Array.from(new Set([...configured, ...remote]));
        this.availableModels = combined.length > 0 ? combined : ['gpt-4o-mini', 'deepseek-chat'];

        if (!this.selectedModel || !this.availableModels.includes(this.selectedModel)) {
          this.selectedModel = modelsData.data.defaultModel || this.availableModels[0];
          localStorage.setItem(SELECTED_MODEL_KEY, this.selectedModel);
        }

        this.renderModelOptions();
      }
    } catch {
      this.dom.providerStatusDot.className = 'status-dot error';
      this.dom.providerStatusText.textContent = 'Mất kết nối server';
    }
  }

  renderModelOptions() {
    this.dom.currentModelLabel.textContent = this.selectedModel;
    this.dom.modelOptionsList.innerHTML = '';

    for (const model of this.availableModels) {
      const opt = document.createElement('div');
      opt.className = `model-option ${model === this.selectedModel ? 'active' : ''}`;
      opt.innerHTML = `
        <span>${escapeHtml(model)}</span>
        ${model === this.selectedModel ? '<span>✓</span>' : ''}
      `;
      opt.addEventListener('click', () => {
        this.selectModel(model);
        this.dom.modelDropdown.classList.remove('open');
      });
      this.dom.modelOptionsList.appendChild(opt);
    }
  }

  selectModel(modelName) {
    this.selectedModel = modelName;
    localStorage.setItem(SELECTED_MODEL_KEY, modelName);
    this.dom.currentModelLabel.textContent = modelName;
    this.renderModelOptions();

    // Cập nhật model vào phiên chat hiện tại nếu có
    const currentChat = this.getCurrentChat();
    if (currentChat) {
      currentChat.model = modelName;
      this.saveChatsToStorage();
    }
  }

  // Quick Templates OLP
  async fetchTemplates() {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        this.templates = data.data;
        this.renderTemplates();
      }
    } catch {
      // Fallback
    }
  }

  renderTemplates() {
    this.dom.quickTemplatesGrid.innerHTML = '';
    for (const item of this.templates) {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <div class="template-card-category">${escapeHtml(item.category)}</div>
        <div class="template-card-title">${escapeHtml(item.title)}</div>
        <div class="template-card-snippet">${escapeHtml(item.prompt)}</div>
      `;
      card.addEventListener('click', () => {
        this.dom.chatTextarea.value = item.prompt;
        this.autoGrowTextarea();
        this.handleSendMessage();
      });
      this.dom.quickTemplatesGrid.appendChild(card);
    }
  }

  // LocalStorage Chat Management
  loadChatsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveChatsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.chats));
    } catch {
      // Storage quota
    }
  }

  getCurrentChat() {
    return this.chats.find(c => c.id === this.currentChatId);
  }

  createNewChat() {
    const newId = 'chat_' + Date.now();
    const newChat = {
      id: newId,
      title: 'Đoạn chat mới',
      model: this.selectedModel,
      messages: [],
      updatedAt: Date.now()
    };

    this.chats.unshift(newChat);
    this.saveChatsToStorage();
    this.renderChatHistoryList();
    this.loadChat(newId);
  }

  loadChat(chatId) {
    this.currentChatId = chatId;
    const chat = this.getCurrentChat();
    if (!chat) return;

    if (chat.model) {
      this.selectedModel = chat.model;
      this.dom.currentModelLabel.textContent = chat.model;
      this.renderModelOptions();
    }

    this.renderChatHistoryList();
    this.renderChatMessages(chat);
  }

  deleteChat(chatId, e) {
    if (e) e.stopPropagation();
    this.chats = this.chats.filter(c => c.id !== chatId);
    this.saveChatsToStorage();
    this.renderChatHistoryList();

    if (this.currentChatId === chatId) {
      if (this.chats.length > 0) {
        this.loadChat(this.chats[0].id);
      } else {
        this.createNewChat();
      }
    }
  }

  renderChatHistoryList() {
    this.dom.chatHistoryList.innerHTML = '';

    if (this.chats.length === 0) {
      this.dom.chatHistoryList.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:12px 8px;">Chưa có đoạn chat nào</div>';
      return;
    }

    for (const chat of this.chats) {
      const item = document.createElement('div');
      item.className = `history-item ${chat.id === this.currentChatId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="history-item-title">${escapeHtml(chat.title)}</span>
        <div class="history-item-actions">
          <button class="btn-action-tiny btn-delete" title="Xóa đoạn chat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      item.addEventListener('click', () => {
        this.loadChat(chat.id);
        if (window.innerWidth <= 768) {
          this.dom.sidebar.classList.remove('open');
        }
      });

      const btnDelete = item.querySelector('.btn-delete');
      btnDelete.addEventListener('click', (e) => {
        this.deleteChat(chat.id, e);
      });

      this.dom.chatHistoryList.appendChild(item);
    }
  }

  renderChatMessages(chat) {
    // Xóa tin nhắn cũ ngoại trừ welcomeScreen
    const existingMessages = this.dom.chatInner.querySelectorAll('.message-row');
    existingMessages.forEach(el => el.remove());

    if (!chat.messages || chat.messages.length === 0) {
      this.dom.welcomeScreen.style.display = 'flex';
    } else {
      this.dom.welcomeScreen.style.display = 'none';
      for (const msg of chat.messages) {
        this.appendMessageToDom(msg.role, msg.content, msg.reasoning);
      }
      this.scrollToBottom();
    }
  }

  appendMessageToDom(role, content, reasoning) {
    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user-row' : 'assistant-row'}`;

    const isUser = role === 'user';
    const avatar = isUser ? 'BẠN' : 'OLP';
    const authorName = isUser ? 'Bạn' : `OLPAi (${this.selectedModel})`;

    let reasoningHtml = '';
    if (reasoning) {
      reasoningHtml = `
        <div class="reasoning-box">
          <div class="reasoning-header">
            <span>💭 Suy nghĩ của mô hình</span>
            <span>▼</span>
          </div>
          <div class="reasoning-body">${escapeHtml(reasoning)}</div>
        </div>
      `;
    }

    const renderedContent = isUser ? escapeHtml(content) : renderMarkdown(content);

    row.innerHTML = `
      <div class="message-avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}">${avatar}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-author">${escapeHtml(authorName)}</span>
        </div>
        ${reasoningHtml}
        <div class="message-content">${renderedContent}</div>
      </div>
    `;

    // Toggle reasoning box
    const reasoningHeader = row.querySelector('.reasoning-header');
    if (reasoningHeader) {
      reasoningHeader.addEventListener('click', () => {
        const body = row.querySelector('.reasoning-body');
        if (body) {
          body.style.display = body.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    this.dom.chatInner.appendChild(row);
    return row;
  }

  scrollToBottom() {
    this.dom.chatContainer.scrollTop = this.dom.chatContainer.scrollHeight;
  }

  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isStreaming = false;
    this.dom.btnStop.classList.remove('visible');
    this.dom.btnSend.style.display = 'flex';
    this.updateSendButtonState();
  }

  async handleSendMessage() {
    const rawText = this.dom.chatTextarea.value.trim();
    if (!rawText || this.isStreaming) return;

    const chat = this.getCurrentChat();
    if (!chat) return;

    // Ẩn welcome screen
    this.dom.welcomeScreen.style.display = 'none';

    // Đẩy user message
    const userMsg = { role: 'user', content: rawText };
    chat.messages.push(userMsg);

    // Cập nhật tiêu đề chat nếu là tin nhắn đầu tiên
    if (chat.messages.length === 1) {
      chat.title = rawText.slice(0, 30) + (rawText.length > 30 ? '...' : '');
      this.renderChatHistoryList();
    }

    chat.updatedAt = Date.now();
    this.saveChatsToStorage();

    this.appendMessageToDom('user', rawText);
    this.dom.chatTextarea.value = '';
    this.autoGrowTextarea();
    this.scrollToBottom();

    // Tạo placeholder assistant message
    const assistantRow = this.appendMessageToDom('assistant', '');
    const contentEl = assistantRow.querySelector('.message-content');
    contentEl.innerHTML = '<span class="streaming-cursor"></span>';

    this.isStreaming = true;
    this.dom.btnSend.style.display = 'none';
    this.dom.btnStop.classList.add('visible');

    this.abortController = new AbortController();

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chat.messages,
          model: this.selectedModel
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Lỗi HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') break;

          try {
            const dataObj = JSON.parse(dataStr);
            if (dataObj.error) {
              throw new Error(dataObj.error);
            }
            if (dataObj.content) {
              accumulatedContent += dataObj.content;
            }
            if (dataObj.reasoning) {
              accumulatedReasoning += dataObj.reasoning;
            }

            contentEl.innerHTML = renderMarkdown(accumulatedContent) + '<span class="streaming-cursor"></span>';
            this.scrollToBottom();
          } catch (e) {
            if (e.message && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }

      // Hoàn tất stream
      contentEl.innerHTML = renderMarkdown(accumulatedContent);

      // Thêm reasoning box nếu có
      if (accumulatedReasoning) {
        const reasoningHtml = `
          <div class="reasoning-box">
            <div class="reasoning-header">
              <span>💭 Suy nghĩ của mô hình</span>
              <span>▼</span>
            </div>
            <div class="reasoning-body">${escapeHtml(accumulatedReasoning)}</div>
          </div>
        `;
        const bodyEl = assistantRow.querySelector('.message-body');
        const headerEl = assistantRow.querySelector('.message-header');
        headerEl.insertAdjacentHTML('afterend', reasoningHtml);
      }

      chat.messages.push({
        role: 'assistant',
        content: accumulatedContent,
        reasoning: accumulatedReasoning
      });
      chat.updatedAt = Date.now();
      this.saveChatsToStorage();

    } catch (err) {
      if (this.abortController.signal.aborted) {
        contentEl.innerHTML = renderMarkdown(accumulatedContent) + ' <em>(Đã dừng)</em>';
      } else {
        const errMsg = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định';
        contentEl.innerHTML = `
          <div style="color:var(--accent-red);background:rgba(239,68,68,0.1);border:1px solid var(--accent-red);padding:10px 14px;border-radius:var(--radius-md);">
            <strong>Lỗi phản hồi:</strong> ${escapeHtml(errMsg)}
            <br><small style="color:var(--text-muted);">Vui lòng kiểm tra lại cấu hình PROVIDER_API_KEY và PROVIDER_BASE_URL trong file .env.</small>
          </div>
        `;
      }
    } finally {
      this.stopStreaming();
      this.scrollToBottom();
    }
  }
}

// Khởi tạo ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  const app = new OLPAiApp();
  app.init();
});
