/**
 * app.js - Logic điều khiển giao diện chính của Môi trường luyện thi OLPAi
 * Thiết kế giao diện DeepSeek Web Interface
 */

import { configureMarked, renderMarkdown, initCodeCopyHandler, escapeHtml } from './markdown.js';

// LocalStorage key
const STORAGE_KEY = 'olpai_chat_history_v1';
const SELECTED_MODEL_KEY = 'olpai_selected_model_v3';
const DEFAULT_MODEL = 'deepseek-32b';
const MODEL_LABELS = Object.freeze({
  'deepseek-32b': 'DeepSeek 32B Distill R1 Qwen',
  'ag/gemini-3.8-flash-high': 'Gemini Flash (fallback)'
});
const THEME_KEY = 'olpai_theme_mode_v1';

class OLPAiApp {
  constructor() {
    this.chats = this.loadChatsFromStorage();
    this.currentChatId = null;
    this.availableModels = [];
    this.preferredModel = localStorage.getItem(SELECTED_MODEL_KEY) || DEFAULT_MODEL;
    this.selectedModel = this.preferredModel;
    this.chatbotReady = false;
    this.currentTheme = localStorage.getItem(THEME_KEY) || 'light';
    this.activeControllers = new Set();
    this.templates = [];

    this.cacheDom();
    this.bindEvents();
  }

  cacheDom() {
    this.dom = {
      mainContent: document.getElementById('mainContent'),
      sidebar: document.getElementById('sidebar'),
      btnToggleSidebar: document.getElementById('btnToggleSidebar'),
      btnSidebarCollapse: document.getElementById('btnSidebarCollapse'),
      sidebarBrandBtn: document.getElementById('sidebarBrandBtn'),
      btnNewChat: document.getElementById('btnNewChat'),
      chatHistoryList: document.getElementById('chatHistoryList'),
      providerStatusDot: document.getElementById('providerStatusDot'),
      providerStatusText: document.getElementById('providerStatusText'),
      chatbotStatus: document.getElementById('chatbotStatus'),
      btnStartChatbot: document.getElementById('btnStartChatbot'),
      btnStopChatbot: document.getElementById('btnStopChatbot'),
      chatbotControlDialog: document.getElementById('chatbotControlDialog'),
      chatbotControlForm: document.getElementById('chatbotControlForm'),
      chatbotControlTitle: document.getElementById('chatbotControlTitle'),
      chatbotPasswordInput: document.getElementById('chatbotPasswordInput'),
      chatbotControlError: document.getElementById('chatbotControlError'),
      btnCancelChatbotControl: document.getElementById('btnCancelChatbotControl'),
      btnConfirmChatbotControl: document.getElementById('btnConfirmChatbotControl'),
      btnThemeToggle: document.getElementById('btnThemeToggle'),
      themeIcon: document.getElementById('themeIcon'),

      modelSelectorBtn: document.getElementById('modelSelectorBtn'),
      currentModelLabel: document.getElementById('currentModelLabel'),
      modelDropdown: document.getElementById('modelDropdown'),
      modelOptionsList: document.getElementById('modelOptionsList'),
      customModelInput: document.getElementById('customModelInput'),
      btnApplyCustomModel: document.getElementById('btnApplyCustomModel'),

      btnModelIndicator: document.getElementById('btnModelIndicator'),
      bottomModelLabel: document.getElementById('bottomModelLabel'),

      chatContainer: document.getElementById('chatContainer'),
      chatInner: document.getElementById('chatInner'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      welcomeGreetingTitle: document.getElementById('welcomeGreetingTitle'),
      quickTemplatesGrid: document.getElementById('quickTemplatesGrid'),
      btnScrollBottom: document.getElementById('btnScrollBottom'),
      btnShareChat: document.getElementById('btnShareChat'),
      btnCopyPage: document.getElementById('btnCopyPage'),

      chatTextarea: document.getElementById('chatTextarea'),
      btnSend: document.getElementById('btnSend'),
      btnStop: document.getElementById('btnStop'),

      // Exam token elements
      examTokenBar: document.getElementById('examTokenBar'),
      tokenCountLabel: document.getElementById('tokenCountLabel'),
      tokenPercentLabel: document.getElementById('tokenPercentLabel'),
      examTokenProgressFill: document.getElementById('examTokenProgressFill'),
      tokenPulse: document.getElementById('tokenPulse'),
      sessionLimitBanner: document.getElementById('sessionLimitBanner'),
      btnNewSessionBanner: document.getElementById('btnNewSessionBanner'),
      btnCloseLimitBanner: document.getElementById('btnCloseLimitBanner')
    };
  }

  bindEvents() {
    // Áp dụng theme (mặc định Sáng)
    this.applyTheme(this.currentTheme);
    if (this.dom.btnThemeToggle) {
      this.dom.btnThemeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    this.dom.btnStartChatbot?.addEventListener('click', () => this.openChatbotControl('start'));
    this.dom.btnStopChatbot?.addEventListener('click', () => this.openChatbotControl('stop'));
    this.dom.btnCancelChatbotControl?.addEventListener('click', () => {
      this.dom.chatbotControlDialog?.close();
    });
    this.dom.chatbotControlForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.runChatbotControl(this.pendingChatbotAction, this.dom.chatbotPasswordInput.value);
    });

    // Nút tạo phiên mới từ banner khi chạm trần token
    if (this.dom.btnNewSessionBanner) {
      this.dom.btnNewSessionBanner.addEventListener('click', () => {
        this.createNewChat();
      });
    }

    // Nút đóng thông báo chạm trần token
    if (this.dom.btnCloseLimitBanner) {
      this.dom.btnCloseLimitBanner.addEventListener('click', () => {
        if (this.dom.sessionLimitBanner) {
          this.dom.sessionLimitBanner.style.display = 'none';
        }
      });
    }

    // Khởi tạo marked & copy handler
    configureMarked();
    initCodeCopyHandler();

    // Toggle Sidebar
    if (this.dom.btnToggleSidebar) {
      this.dom.btnToggleSidebar.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          this.dom.sidebar.classList.toggle('open');
        } else {
          this.dom.sidebar.classList.toggle('collapsed');
        }
      });
    }

    if (this.dom.btnSidebarCollapse) {
      this.dom.btnSidebarCollapse.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          this.dom.sidebar.classList.remove('open');
        } else {
          this.dom.sidebar.classList.add('collapsed');
        }
      });
    }

    // New Chat Button
    if (this.dom.btnNewChat) {
      this.dom.btnNewChat.addEventListener('click', () => {
        this.createNewChat();
      });
    }

    // Scroll to bottom button
    if (this.dom.btnScrollBottom) {
      this.dom.btnScrollBottom.addEventListener('click', () => {
        this.scrollToBottom();
      });
    }

    if (this.dom.chatContainer) {
      this.dom.chatContainer.addEventListener('scroll', () => {
        const threshold = 150;
        const distFromBottom = this.dom.chatContainer.scrollHeight - this.dom.chatContainer.scrollTop - this.dom.chatContainer.clientHeight;
        if (distFromBottom > threshold) {
          this.dom.btnScrollBottom?.classList.add('visible');
        } else {
          this.dom.btnScrollBottom?.classList.remove('visible');
        }
      });
    }

    // Share & Copy whole conversation
    if (this.dom.btnShareChat) {
      this.dom.btnShareChat.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href).catch(() => {});
        const span = this.dom.btnShareChat.querySelector('span');
        if (span) {
          const oldText = span.textContent;
          span.textContent = 'Đã sao chép link';
          setTimeout(() => { span.textContent = oldText; }, 2000);
        }
      });
    }

    if (this.dom.btnCopyPage) {
      this.dom.btnCopyPage.addEventListener('click', async () => {
        const chat = this.getCurrentChat();
        if (!chat || !chat.messages || chat.messages.length === 0) return;
        const text = chat.messages.map(m => `[${m.role.toUpperCase()}]:\n${m.content}`).join('\n\n---\n\n');
        await navigator.clipboard.writeText(text).catch(() => {});
        this.dom.btnCopyPage.style.color = 'var(--deepseek-blue)';
        setTimeout(() => { this.dom.btnCopyPage.style.color = ''; }, 1500);
      });
    }

    // Model Selector Dropdown
    const toggleModelMenu = (e) => {
      e.stopPropagation();
      this.dom.modelDropdown.classList.toggle('show');
    };

    if (this.dom.modelSelectorBtn) {
      this.dom.modelSelectorBtn.addEventListener('click', toggleModelMenu);
    }
    if (this.dom.sidebarBrandBtn) {
      this.dom.sidebarBrandBtn.addEventListener('click', toggleModelMenu);
    }
    if (this.dom.btnModelIndicator) {
      this.dom.btnModelIndicator.addEventListener('click', toggleModelMenu);
    }

    document.addEventListener('click', (e) => {
      if (!this.dom.modelDropdown.contains(e.target) &&
          e.target !== this.dom.modelSelectorBtn &&
          e.target !== this.dom.btnModelIndicator &&
          e.target !== this.dom.sidebarBrandBtn) {
        this.dom.modelDropdown.classList.remove('show');
      }
    });

    // Apply custom model
    this.dom.btnApplyCustomModel.addEventListener('click', () => {
      const val = this.dom.customModelInput.value.trim();
      if (val) {
        this.selectModel(val);
        this.dom.customModelInput.value = '';
        this.dom.modelDropdown.classList.remove('show');
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

  updateGreetingTitle() {
    if (!this.dom.welcomeGreetingTitle) return;
    const hour = new Date().getHours();
    let greeting = 'Chào buổi tối, tôi có thể giúp gì cho bạn?';
    if (hour >= 5 && hour < 11) {
      greeting = 'Chào buổi sáng, tôi có thể giúp gì cho bạn?';
    } else if (hour >= 11 && hour < 18) {
      greeting = 'Chào buổi chiều, tôi có thể giúp gì cho bạn?';
    }
    this.dom.welcomeGreetingTitle.textContent = greeting;
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#18181b' : '#ffffff');
    }
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }

  async init() {
    await this.fetchHealthAndConfig();
    await this.fetchTemplates();
    this.updateGreetingTitle();
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
    const chatbotUnavailable = this.selectedModel === DEFAULT_MODEL && !this.chatbotReady;
    this.dom.btnSend.disabled = !hasText || chatbotUnavailable;
  }

  openChatbotControl(action) {
    this.pendingChatbotAction = action;
    const isStart = action === 'start';
    this.dom.chatbotControlTitle.textContent = isStart ? 'Khởi động DeepSeek' : 'Tắt DeepSeek';
    this.dom.btnConfirmChatbotControl.textContent = isStart ? 'Khởi động' : 'Tắt chatbot';
    this.dom.chatbotControlError.textContent = '';
    this.dom.chatbotPasswordInput.value = '';
    this.dom.chatbotControlDialog.showModal();
    this.dom.chatbotPasswordInput.focus();
  }

  async runChatbotControl(action, password) {
    if (!action || !password) {
      this.dom.chatbotControlError.textContent = 'Nhập mật khẩu để tiếp tục.';
      return;
    }

    const isStart = action === 'start';
    this.dom.chatbotControlError.textContent = '';
    this.dom.chatbotStatus.textContent = isStart
      ? 'Đang khởi động DeepSeek… lần đầu có thể mất vài phút'
      : 'Đang yêu cầu tắt DeepSeek…';
    this.dom.btnStartChatbot.disabled = true;
    this.dom.btnStopChatbot.disabled = true;
    this.dom.btnConfirmChatbotControl.disabled = true;

    try {
      const response = await fetch(`/api/chatbot/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        this.dom.chatbotControlError.textContent = data.error || `Lỗi HTTP ${response.status}`;
        this.dom.chatbotStatus.textContent = isStart ? 'DeepSeek chưa khởi tạo' : 'Chưa xác nhận đã tắt';
        return;
      }

      this.chatbotReady = isStart;
      this.dom.chatbotStatus.textContent = data.message;
      this.dom.chatbotControlDialog.close();
      this.updateSendButtonState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không kết nối được backend.';
      this.dom.chatbotControlError.textContent = message;
      this.dom.chatbotStatus.textContent = isStart ? 'DeepSeek chưa khởi tạo' : 'Chưa xác nhận đã tắt';
    } finally {
      this.dom.chatbotPasswordInput.value = '';
      this.dom.btnConfirmChatbotControl.disabled = false;
      this.dom.btnStartChatbot.disabled = false;
      this.dom.btnStopChatbot.disabled = false;
    }
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
        this.availableModels = combined.length > 0 ? combined : ['deepseek-32b', 'ag/gemini-3.8-flash-high'];

        if (!this.preferredModel || !this.availableModels.includes(this.preferredModel)) {
          this.preferredModel = modelsData.data.defaultModel || this.availableModels[0];
          this.selectedModel = this.preferredModel;
          localStorage.setItem(SELECTED_MODEL_KEY, this.preferredModel);
        }

        this.renderModelOptions();
      }
    } catch {
      this.dom.providerStatusDot.className = 'status-dot error';
      this.dom.providerStatusText.textContent = 'Mất kết nối server';
    }
  }

  renderModelOptions() {
    const selectedLabel = MODEL_LABELS[this.selectedModel] || this.selectedModel;
    if (this.dom.currentModelLabel) {
      this.dom.currentModelLabel.textContent = selectedLabel;
      this.dom.currentModelLabel.title = this.selectedModel;
    }
    if (this.dom.bottomModelLabel) {
      this.dom.bottomModelLabel.textContent = selectedLabel;
      this.dom.bottomModelLabel.title = `Model đang kết nối: ${this.selectedModel}`;
    }

    this.dom.modelOptionsList.innerHTML = '';

    for (const model of this.availableModels) {
      const opt = document.createElement('div');
      opt.className = `model-option-item ${model === this.selectedModel ? 'selected' : ''}`;
      const modelLabel = MODEL_LABELS[model] || model;
      opt.innerHTML = `
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(modelLabel)}</span>
        ${model === this.selectedModel ? '<span style="color:#1d61f2;font-weight:bold;">✓</span>' : ''}
      `;
      opt.addEventListener('click', () => {
        this.selectModel(model);
        this.dom.modelDropdown.classList.remove('show');
      });
      this.dom.modelOptionsList.appendChild(opt);
    }
  }

  selectModel(modelName) {
    this.selectedModel = modelName;
    this.preferredModel = modelName;
    localStorage.setItem(SELECTED_MODEL_KEY, modelName);
    this.renderModelOptions();
    this.updateSendButtonState();

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

  updateTokenProgress(tokenUsage) {
    const usage = tokenUsage || { totalTokens: 0, maxTokens: 2000, isExceeded: false };
    const total = Number.isFinite(usage.totalTokens) ? usage.totalTokens : 0;
    const max = Number.isFinite(usage.maxTokens) && usage.maxTokens > 0 ? usage.maxTokens : 2000;
    const percent = Math.min(100, Math.round((total / max) * 100));
    const isExceeded = Boolean(usage.isExceeded || total >= max);

    if (this.dom.tokenCountLabel) {
      this.dom.tokenCountLabel.textContent = total.toLocaleString('vi-VN');
    }
    if (this.dom.tokenPercentLabel) {
      this.dom.tokenPercentLabel.textContent = `${percent}%`;
    }
    if (this.dom.examTokenProgressFill) {
      this.dom.examTokenProgressFill.style.width = `${percent}%`;
    }

    if (this.dom.examTokenBar) {
      this.dom.examTokenBar.classList.remove('warning', 'danger');
      if (percent >= 90 || isExceeded) {
        this.dom.examTokenBar.classList.add('danger');
      } else if (percent >= 70) {
        this.dom.examTokenBar.classList.add('warning');
      }
    }

    if (this.dom.sessionLimitBanner) {
      this.dom.sessionLimitBanner.style.display = isExceeded ? 'flex' : 'none';
    }

    if (isExceeded) {
      this.dom.chatTextarea.disabled = true;
      this.dom.chatTextarea.placeholder = 'Phiên thi này đã dùng đủ 2,000 token. Nhấn "+ Trò chuyện mới" để tiếp tục.';
      this.dom.btnSend.disabled = true;
    } else {
      this.dom.chatTextarea.disabled = false;
      this.dom.chatTextarea.placeholder = 'Nhắn tin cho DeepSeek 32B Distill R1 Qwen';
      this.updateSendButtonState();
    }
  }

  createNewChat() {
    const newId = 'chat_' + Date.now();
    const newChat = {
      id: newId,
      title: 'Đoạn chat mới',
      model: this.preferredModel,
      messages: [],
      tokenUsage: {
        sessionId: newId,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        maxTokens: 2000,
        remainingTokens: 2000,
        percentage: 0,
        isExceeded: false
      },
      updatedAt: Date.now()
    };

    this.chats.unshift(newChat);
    this.saveChatsToStorage();
    this.renderChatHistoryList();
    this.loadChat(newId);
  }

  async loadChat(chatId) {
    this.currentChatId = chatId;
    const chat = this.getCurrentChat();
    if (!chat) return;

    if (chat.model) {
      this.selectedModel = chat.model;
      this.renderModelOptions();
    }

    // Hiển thị thanh tiến trình token ngay từ cache
    this.updateTokenProgress(chat.tokenUsage);

    this.renderChatHistoryList();
    this.renderChatMessages(chat);

    // Đồng bộ token từ backend
    try {
      const res = await fetch(`/api/sessions/${chat.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          chat.tokenUsage = json.data;
          this.saveChatsToStorage();
          if (this.currentChatId === chatId) {
            this.updateTokenProgress(json.data);
            this.renderChatHistoryList();
          }
        }
      }
    } catch {
      // Offline fallback
    }
  }

  deleteChat(chatId, e) {
    if (e) e.stopPropagation();
    fetch(`/api/sessions/${chatId}`, { method: 'DELETE' }).catch(() => {});
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

  getChatGroupKey(updatedAt) {
    const now = new Date();
    const chatDate = new Date(updatedAt || Date.now());

    const isToday = now.getFullYear() === chatDate.getFullYear() &&
                    now.getMonth() === chatDate.getMonth() &&
                    now.getDate() === chatDate.getDate();

    if (isToday) return 'Hôm nay';

    const diffMs = now.getTime() - chatDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) return '30 Ngày';

    const year = chatDate.getFullYear();
    const month = String(chatDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  renderChatHistoryList() {
    this.dom.chatHistoryList.innerHTML = '';

    if (this.chats.length === 0) {
      this.dom.chatHistoryList.innerHTML = '<div style="color:var(--text-muted);font-size:12.5px;padding:12px 10px;">Chưa có đoạn chat nào</div>';
      return;
    }

    // Nhóm đoạn chat theo thời gian (Hôm nay, 30 Ngày, Năm-Tháng)
    const groups = new Map();
    for (const chat of this.chats) {
      const groupKey = this.getChatGroupKey(chat.updatedAt);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(chat);
    }

    for (const [groupTitle, groupChats] of groups.entries()) {
      const header = document.createElement('div');
      header.className = 'history-group-header';
      header.textContent = groupTitle;
      this.dom.chatHistoryList.appendChild(header);

      for (const chat of groupChats) {
        const item = document.createElement('div');
        item.className = `history-item ${chat.id === this.currentChatId ? 'active' : ''}`;

        item.innerHTML = `
          <span class="history-item-title">${escapeHtml(chat.title)}</span>
          <div class="history-item-actions">
            <button class="btn-action-tiny btn-delete" title="Xóa đoạn chat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
  }

  renderChatMessages(chat) {
    // Xóa tin nhắn cũ ngoại trừ welcomeScreen
    const existingMessages = this.dom.chatInner.querySelectorAll('.message-row');
    existingMessages.forEach(el => el.remove());

    if (!chat.messages || chat.messages.length === 0) {
      this.dom.welcomeScreen.style.display = 'flex';
      if (this.dom.mainContent) this.dom.mainContent.classList.add('is-welcome-view');
      this.updateGreetingTitle();
    } else {
      this.dom.welcomeScreen.style.display = 'none';
      if (this.dom.mainContent) this.dom.mainContent.classList.remove('is-welcome-view');
      for (const msg of chat.messages) {
        this.appendMessageToDom(msg.role, msg.content, msg.reasoning, msg.model || chat.model);
      }
      this.scrollToBottom();
    }
  }

  appendMessageToDom(role, content, reasoning, modelName) {
    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user-row' : 'assistant-row'}`;

    if (role === 'user') {
      row.innerHTML = `
        <div class="user-bubble-container">
          <div class="user-bubble">${escapeHtml(content)}</div>
          <div class="message-actions user-actions">
            <span class="user-time-stamp">Vừa xong</span>
            <button class="btn-msg-action btn-copy-user" title="Sao chép">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      const btnCopy = row.querySelector('.btn-copy-user');
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          await navigator.clipboard.writeText(content).catch(() => {});
          btnCopy.style.color = 'var(--deepseek-blue)';
          setTimeout(() => { btnCopy.style.color = ''; }, 1500);
        });
      }
    } else {
      row.innerHTML = `
        <div class="assistant-container">
          <div class="message-content">${renderMarkdown(content)}</div>
          <div class="message-actions assistant-actions">
            <button class="btn-msg-action btn-copy-assistant" title="Sao chép câu trả lời">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="btn-msg-action btn-good" title="Tốt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
            </button>
            <button class="btn-msg-action btn-bad" title="Chưa tốt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      // Copy response
      const btnCopy = row.querySelector('.btn-copy-assistant');
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          await navigator.clipboard.writeText(content).catch(() => {});
          btnCopy.style.color = 'var(--deepseek-blue)';
          setTimeout(() => { btnCopy.style.color = ''; }, 1500);
        });
      }
    }

    this.dom.chatInner.appendChild(row);
    return row;
  }

  scrollToBottom() {
    this.dom.chatContainer.scrollTop = this.dom.chatContainer.scrollHeight;
  }

  stopStreaming() {
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }
    this.activeControllers.clear();
    this.dom.btnStop.classList.remove('visible');
    this.updateSendButtonState();
  }

  async handleSendMessage() {
    const rawText = this.dom.chatTextarea.value.trim();
    if (!rawText) return;

    if (this.selectedModel === DEFAULT_MODEL && !this.chatbotReady) {
      this.dom.chatbotStatus.textContent = 'Nhấn “Khởi động” và chờ DeepSeek sẵn sàng trước khi chat.';
      return;
    }

    const chat = this.getCurrentChat();
    if (!chat) return;

    // Kiểm tra nếu phiên đã đạt giới hạn 2,000 token
    if (chat.tokenUsage && chat.tokenUsage.isExceeded) {
      this.updateTokenProgress(chat.tokenUsage);
      return;
    }

    const targetModel = this.selectedModel;

    // Ẩn welcome screen & thoát welcome-view
    this.dom.welcomeScreen.style.display = 'none';
    if (this.dom.mainContent) this.dom.mainContent.classList.remove('is-welcome-view');

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
    this.updateSendButtonState();
    this.scrollToBottom();

    // Tạo placeholder assistant message với spinner / thinking dots
    const assistantRow = this.appendMessageToDom('assistant', '', '', targetModel);
    const assistantContainer = assistantRow.querySelector('.assistant-container');
    const contentEl = assistantRow.querySelector('.message-content');
    contentEl.innerHTML = '<span class="streaming-cursor"></span>';

    // Tạo controller riêng cho stream này (cho phép chạy song song)
    const streamController = new AbortController();
    this.activeControllers.add(streamController);
    this.dom.btnStop.classList.add('visible');

    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let thinkingCard = null;
    let thinkingBody = null;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chat.messages,
          model: targetModel,
          sessionId: chat.id
        }),
        signal: streamController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (errJson.code === 'SESSION_TOKEN_LIMIT_REACHED' || response.status === 403) {
          chat.tokenUsage = errJson.data?.tokenUsage || {
            sessionId: chat.id,
            totalTokens: 2000,
            maxTokens: 2000,
            isExceeded: true
          };
          this.saveChatsToStorage();
          this.updateTokenProgress(chat.tokenUsage);
          this.renderChatHistoryList();
        }
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
            if (dataObj.tokenUsage) {
              chat.tokenUsage = dataObj.tokenUsage;
              this.saveChatsToStorage();
              this.updateTokenProgress(dataObj.tokenUsage);
              this.renderChatHistoryList();
            }
            if (dataObj.reasoning) {
              accumulatedReasoning += dataObj.reasoning;
              if (!accumulatedContent) {
                if (!thinkingCard) {
                  thinkingCard = document.createElement('div');
                  thinkingCard.className = 'thinking-card';
                  thinkingCard.innerHTML = `
                    <div class="thinking-header">
                      <span class="thinking-sparkle">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                        </svg>
                      </span>
                      <span class="thinking-title">Đang suy nghĩ...</span>
                    </div>
                    <div class="thinking-body"></div>
                  `;
                  assistantContainer.insertBefore(thinkingCard, contentEl);
                  thinkingBody = thinkingCard.querySelector('.thinking-body');
                  contentEl.innerHTML = '';
                }
                if (thinkingBody) {
                  thinkingBody.textContent = accumulatedReasoning;
                  thinkingBody.scrollTop = thinkingBody.scrollHeight;
                }
              }
            }

            if (dataObj.content) {
              accumulatedContent += dataObj.content;
              if (thinkingCard && !thinkingCard.classList.contains('fade-out')) {
                thinkingCard.classList.add('fade-out');
                setTimeout(() => {
                  if (thinkingCard && thinkingCard.parentNode) {
                    thinkingCard.remove();
                  }
                }, 250);
              }
              contentEl.innerHTML = renderMarkdown(accumulatedContent) + '<span class="streaming-cursor"></span>';
            }

            this.scrollToBottom();
          } catch (e) {
            if (e.message && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }

      // Gắn handler cho nút copy ở assistant row
      const btnCopyAssistant = assistantRow.querySelector('.btn-copy-assistant');
      if (btnCopyAssistant) {
        btnCopyAssistant.addEventListener('click', async () => {
          await navigator.clipboard.writeText(accumulatedContent).catch(() => {});
          btnCopyAssistant.style.color = 'var(--deepseek-blue)';
          setTimeout(() => { btnCopyAssistant.style.color = ''; }, 1500);
        });
      }

      // Hoàn tất stream - kiểm tra nếu trống rỗng
      if (!accumulatedContent.trim() && !accumulatedReasoning.trim()) {
        contentEl.innerHTML = `
          <div style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;padding:10px 14px;border-radius:var(--radius-md);">
            ⚠️ <strong>Không nhận được dữ liệu:</strong> Model <code>${escapeHtml(targetModel)}</code> không trả về nội dung.
            <br><small style="color:var(--text-muted);display:inline-block;margin-top:4px;">Gợi ý: Thử lại hoặc chọn model khác từ danh sách như <code>ag/gemini-3.8-flash-high</code>.</small>
          </div>
        `;
      } else {
        contentEl.innerHTML = renderMarkdown(accumulatedContent);
      }

      if (accumulatedContent.trim()) {
        chat.messages.push({
          role: 'assistant',
          content: accumulatedContent,
          model: targetModel
        });
        chat.updatedAt = Date.now();
        this.saveChatsToStorage();
      }

    } catch (err) {
      if (streamController.signal.aborted) {
        contentEl.innerHTML = (accumulatedContent ? renderMarkdown(accumulatedContent) : '') + ' <em>(Đã dừng)</em>';
      } else {
        const errMsg = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định';
        contentEl.innerHTML = `
          <div style="color:#b91c1c;background:#fee2e2;border:1px solid #fca5a5;padding:10px 14px;border-radius:var(--radius-md);">
            <strong>Lỗi phản hồi (${escapeHtml(targetModel)}):</strong> ${escapeHtml(errMsg)}
          </div>
        `;
      }
    } finally {
      if (thinkingCard && thinkingCard.parentNode) {
        thinkingCard.remove();
      }
      this.activeControllers.delete(streamController);
      if (this.activeControllers.size === 0) {
        this.dom.btnStop.classList.remove('visible');
      }
      this.updateSendButtonState();
      this.scrollToBottom();
    }
  }
}

// Khởi tạo ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  const app = new OLPAiApp();
  app.init();
});
