# Kiến trúc hệ thống (Architecture)

## 1. Mô hình tổng thể
Kiến trúc Client-Server tinh gọn (Lightweight Client-Server), không phụ thuộc framework frontend nặng để đạt hiệu năng tối đa, không độ trễ build, dễ triển khai:

```
+-----------------------------------------------------------+
|                     Client (Browser)                      |
|  - HTML5 / CSS3 / ES Modules                              |
|  - UI: Modern Minimalist Dark Theme                       |
|  - Markdown Parser: marked.js                             |
|  - Code Syntax Highlighter: highlight.js                  |
|  - Math Notation: KaTeX (Big-O, formulas)                 |
|  - Session Storage: LocalStorage                          |
+-----------------------------------------------------------+
                           |
               HTTP / SSE (Server-Sent Events)
                           |
+-----------------------------------------------------------+
|                     Server (Node.js)                      |
|  - Express / Native HTTP                                  |
|  - /api/health: Kiểm tra tình trạng kết nối               |
|  - /api/models: Trả về danh sách model cấu hình từ .env   |
|  - /api/chat: SSE proxy chuyển tiếp tới LLM Provider      |
|  - System Prompt Injector: Tối ưu cho Olympic Tin học     |
+-----------------------------------------------------------+
                           |
           OpenAI-Compatible REST API (Streaming)
                           |
+-----------------------------------------------------------+
|                   External LLM Provider                   |
|  (OpenAI / DeepSeek / OpenRouter / Groq / Ollama / etc.)  |
+-----------------------------------------------------------+
```

## 2. Các tầng thành phần
1. **Presentation Layer (`public/`)**:
   - `index.html`: Cấu trúc DOM chính, sidebar, chat window, input box.
   - `css/style.css`: Hệ thống biến màu Dark Mode, typography, layout Flexbox/Grid, style cho Code Cell Card.
   - `js/app.js`: Xử lý logic giao diện, quản lý session, gọi API stream, quản lý phím tắt (Enter to send, Shift+Enter newline).
   - `js/markdown.js`: Tách parser, đóng gói code block thành card với header bar, copy button.

2. **Application Layer (`src/`)**:
   - `server.js`: Web server, static file serving, route handlers.
   - `config.js`: Nạp biến môi trường từ `.env`, kiểm tra tính hợp lệ.
   - `provider.js`: Client giao tiếp với Provider (chuẩn OpenAI Chat Completions SSE), xử lý lỗi, timeout.
   - `prompts.js`: System prompt chuyên gia OLP (phân tích thuật toán, độ phức tạp, code chuẩn thi đấu).

## 3. Quyết định kỹ thuật (ADR)
- **Node.js Native Fetch**: Tận dụng `fetch` và `ReadableStream` chuẩn của Node 22, không cần cài đặt các SDK cồng kềnh.
- **SSE (Server-Sent Events)**: Trải nghiệm streaming mượt mà như ChatGPT / Claude.
- **Client-side Markdown & Highlighting**: Giảm tải cho server, render ngay khi nhận chunk từ stream.
