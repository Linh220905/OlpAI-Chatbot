# Môi trường luyện thi OLPAi

Giao diện web chuyên nghiệp, tối giản mô phỏng ChatGPT và các nền tảng coding hiện đại (Cursor, Claude, LeetCode) chuyên biệt cho luyện thi **Olympic Tin học (OLP)** và lập trình thi đấu (Competitive Programming / ICPC).

---

## 🌟 Tính năng nổi bật

- **Tùy biến Provider linh hoạt (`.env`)**:
  - Hỗ trợ mọi Provider chuẩn OpenAI API: OpenAI, DeepSeek, OpenRouter, Groq, Ollama (local), vLLM, proxy riêng,...
  - Toàn bộ URL, API Key, Model được quản lý trong file `.env`.
- **Bộ chọn Model (Model Selector)**:
  - Chọn model trực tiếp từ thanh công cụ trên web.
  - Tự động nạp danh sách model từ file `.env` và truy vấn từ Provider.
  - Cho phép nhập tên model tùy chỉnh nếu muốn thử nghiệm model mới.
- **Khối mã nguồn (Code Cell Card) chuyên biệt cho Coding**:
  - Đóng gói mã nguồn trong Card riêng biệt có viền và thanh tiêu đề (Header bar).
  - Huy hiệu ngôn ngữ lập trình (C++, Python, Java, Pascal, Rust,...).
  - Nút **Copy code** 1-click có hiệu ứng phản hồi trạng thái "Copied!".
  - Tích hợp Highlight.js với theme tối hiện đại (Atom One Dark).
- **Chuẩn format câu từ của các trang coding lớn**:
  - AI được thiết lập vai trò Huấn luyện viên OLP, trả lời theo 4 phần quy chuẩn:
    1. **Ý tưởng & Bản chất thuật toán** (Tiếp cận tối ưu).
    2. **Độ phức tạp** (Đánh giá thời gian $O(...)$ và bộ nhớ $O(...)$ đối chiếu với Time Limit 1s).
    3. **Mã nguồn tối ưu** (Clean code, Fast I/O, thư viện chuẩn, comment vị trí trọng yếu).
    4. **Corner cases & Pitfalls** (Tràn số `long long`, biên $N=1$, mảng rỗng, đồ thị đặc biệt).
- **Trải nghiệm Streaming SSE thời gian thực**:
  - Chữ và code xuất hiện mượt mà từng token như ChatGPT / Claude.
  - Hỗ trợ hiển thị khối suy nghĩ (Reasoning / Thinking) đối với các mô hình lý luận (như DeepSeek-R1, Gemini Thinking).
  - Có nút dừng tạo phản hồi (Stop generation).
- **Giao diện tối giản, chuyên nghiệp**:
  - Dark mode chuẩn IDE, sidebar quản lý lịch sử đoạn chat (lưu trữ an toàn tại trình duyệt LocalStorage).
  - Thẻ gợi ý nhanh các chuyên đề OLP kinh điển (Quy hoạch động, Segment Tree, Dijkstra, Tổ hợp modulo, Chặt nhị phân,...).

---

## 🚀 Cài đặt & Khởi chạy

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình Provider trong file `.env`
Sao chép `.env.example` thành `.env` (hoặc chỉnh sửa trực tiếp file `.env`):
```env
# URL Provider của bạn (OpenAI, DeepSeek, OpenRouter, Groq, Ollama...)
PROVIDER_BASE_URL=https://llm.tanlinh.dev/v1

# API Key của provider
PROVIDER_API_KEY=sk-your-api-key-here

# Danh sách model hiển thị ở menu chọn model (phân cách bằng dấu phẩy)
AVAILABLE_MODELS=gpt-4o,gpt-4o-mini,deepseek-chat,deepseek-reasoner,claude-3-5-sonnet

# Model mặc định khi mở web
DEFAULT_MODEL=gpt-4o-mini

# Cổng chạy web server
PORT=3000
```

### 3. Chạy server
Chế độ sản xuất:
```bash
npm start
```
Chế độ phát triển (tự reload khi sửa code):
```bash
npm run dev
```

Mở trình duyệt truy cập: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Chạy kiểm thử (Automated Tests)
Dự án được phát triển theo phương pháp TDD, đạt độ bao phủ kiểm thử > 80%:
```bash
npm test
```
Kiểm tra test coverage:
```bash
node --test --experimental-test-coverage test/**/*.test.js
```

---

## 📁 Cấu trúc mã nguồn

```
ENV_OLP/
├── docs/                 # Tài liệu PRD, Architecture, System Design
├── public/               # Frontend tĩnh (giao diện web)
│   ├── css/
│   │   └── style.css     # Dark theme chuyên nghiệp, Code Card styling
│   ├── js/
│   │   ├── app.js        # Logic điều khiển, SSE streaming, quản lý chat
│   │   └── markdown.js   # Parser markdown, KaTeX math, đóng gói Code Card
│   └── index.html        # Giao diện chính
├── src/                  # Backend Node.js
│   ├── config.js         # Nạp và xác thực biến môi trường
│   ├── prompts.js        # System prompt huấn luyện viên OLP & gợi ý mẫu
│   ├── provider.js       # Client gọi LLM Provider qua SSE stream
│   └── server.js         # HTTP Server, API routes (/api/chat, /api/models,...)
├── test/                 # Test suites (Node.js test runner)
│   ├── config.test.js
│   ├── markdown.test.js
│   ├── prompts.test.js
│   ├── provider.test.js
│   └── server.test.js
├── .env.example          # File mẫu cấu hình biến môi trường
├── package.json
└── README.md
```
