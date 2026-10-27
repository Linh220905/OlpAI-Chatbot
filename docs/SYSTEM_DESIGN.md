# Thiết kế chi tiết hệ thống (System Design)

## 1. Giao thức API

### 1.1. GET `/api/health`
- **Mục đích**: Kiểm tra tình trạng backend và provider configuration.
- **Phản hồi**:
```json
{
  "status": "ok",
  "providerConfigured": true,
  "baseUrl": "https://api.openai.com/v1",
  "defaultModel": "gpt-4o-mini"
}
```

### 1.2. GET `/api/models`
- **Mục đích**: Lấy danh sách các model được cấu hình trong `.env` (`AVAILABLE_MODELS`).
- **Phản hồi**:
```json
{
  "models": ["gpt-4o", "gpt-4o-mini", "deepseek-chat", "deepseek-reasoner"],
  "defaultModel": "gpt-4o-mini"
}
```

### 1.3. POST `/api/chat`
- **Mục đích**: Gửi đoạn hội thoại và nhận câu trả lời dạng streaming.
- **Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "Thuật toán tìm đường đi ngắn nhất Dijkstra với hàng đợi ưu tiên" }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.3
}
```
- **Response**: Server-Sent Events (`text/event-stream`)
```
data: {"content": "Chào"}
data: {"content": " bạn! Dưới đây là..."}
...
data: [DONE]
```
- **Xử lý lỗi**: Trả về SSE `data: {"error": "Chi tiết lỗi"}` hoặc status code 400/500 tương ứng.

## 2. Thiết kế Code Cell Card
Khi markdown chứa khối code (ví dụ ` ```cpp ... ``` `):
- Parser bọc trong cấu trúc HTML:
```html
<div class="code-card">
  <div class="code-card-header">
    <div class="code-card-lang">
      <span class="lang-icon"></span>
      <span class="lang-text">C++</span>
    </div>
    <button class="copy-btn" onclick="copyCode(this)">
      <svg>...</svg>
      <span>Copy code</span>
    </button>
  </div>
  <div class="code-card-body">
    <pre><code class="language-cpp">...</code></pre>
  </div>
</div>
```

## 3. Quản lý trạng thái Client (State Management)
- `currentChatId`: ID của phiên chat hiện tại.
- `chats`: Danh sách các phiên chat trong `localStorage` (gồm `id`, `title`, `messages`, `model`, `updatedAt`).
- `isStreaming`: Boolean xác định bot có đang gõ trả lời không để hiển thị nút Stop/Send.
