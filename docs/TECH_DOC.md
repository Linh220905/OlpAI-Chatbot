# Tài liệu kỹ thuật (Tech Doc)

## 1. Yêu cầu môi trường
- Node.js >= 18.0.0 (khuyến nghị Node 20 hoặc 22).
- Trình duyệt hiện đại (Chrome, Edge, Firefox, Safari) hỗ trợ ES6 và CSS Grid/Flexbox.

## 2. Cấu trúc thư mục
```
ENV_OLP/
├── docs/                 # Tài liệu PRD, Architecture, System Design
├── public/               # Frontend tĩnh (giao diện web)
│   ├── css/
│   │   └── style.css     # CSS tối giản, dark theme
│   ├── js/
│   │   ├── app.js        # Logic điều khiển chat & stream
│   │   └── markdown.js   # Render markdown & đóng gói code card
│   └── index.html        # Trang giao diện chính
├── src/                  # Backend Node.js
│   ├── config.js         # Đọc và xác thực cấu hình .env
│   ├── prompts.js        # Prompt chuẩn hóa cho OLP
│   ├── provider.js       # Adapter gọi LLM Provider qua SSE
│   └── server.js         # HTTP Server và API routes
├── test/                 # Test suite (Node.js test runner)
│   ├── config.test.js
│   ├── provider.test.js
│   └── server.test.js
├── .env.example          # Mẫu cấu hình biến môi trường
├── package.json          # Quản lý script và phụ thuộc
└── README.md             # Hướng dẫn cài đặt và sử dụng
```

## 3. Quy chuẩn System Prompt OLP
System prompt định hướng mô hình đóng vai Huấn luyện viên Olympic Tin học (OLPAi Coach):
- Luôn ưu tiên độ chính xác tuyệt đối về thuật toán.
- Trả lời theo cấu trúc 4 phần rõ ràng:
  1. **Ý tưởng & Bản chất thuật toán** (Trực quan, giải thích vì sao chọn thuật toán này).
  2. **Độ phức tạp** (Đánh giá chặt chẽ Thời gian & Bộ nhớ theo $O(...)$).
  3. **Mã nguồn hoàn chỉnh (C++/Python/Java/...)** (Sử dụng fast I/O, thư viện chuẩn, biến đặt tên rõ nghĩa, comment các chỗ dễ bẫy).
  4. **Các trường hợp biên (Corner Cases & Pitfalls)** (Tràn số nguyên, mảng kích thước 0/1, giá trị âm, đồ thị không liên thông, chu trình âm,...).
