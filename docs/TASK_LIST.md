# Danh sách công việc triển khai (Task List)

## Phase 1: Nền tảng & Cấu hình (Foundation)
- [x] Tạo file `.gitignore`, `.env.example`, `.env`.
- [x] Tạo tài liệu thiết kế (PRD, Architecture, System Design, Tech Doc).
- [x] Cập nhật `package.json` với script test, start, dev.
- [x] Viết unit test cho `src/config.js` (TDD - RED).
- [x] Triển khai `src/config.js` (TDD - GREEN).

## Phase 2: Logic Backend & Provider SSE
- [x] Viết test cho `src/prompts.js` và `src/provider.js` (TDD - RED).
- [x] Triển khai `src/prompts.js` (TDD - GREEN).
- [x] Triển khai `src/provider.js` xử lý streaming OpenAI-compatible (TDD - GREEN).
- [x] Viết test cho API endpoints trong `src/server.js` (`/api/health`, `/api/models`, `/api/chat`) (TDD - RED).
- [x] Triển khai `src/server.js` (TDD - GREEN).

## Phase 3: Giao diện Web (Frontend)
- [x] Xây dựng `public/index.html`: Layout tối giản, header với tên "Môi trường luyện thi OLPAi", model selector, sidebar lịch sử chat, quick prompts OLP.
- [x] Xây dựng `public/css/style.css`: Theme tối chuyên nghiệp (Cursor/Claude style), thiết kế Code Cell Card với header bar, copy button, syntax highlight.
- [x] Xây dựng `public/js/markdown.js`: Tích hợp marked, highlight.js, katex; bọc code trong card, copy 1-click.
- [x] Xây dựng `public/js/app.js`: Xử lý gửi/nhận SSE stream, quản lý lịch sử chat LocalStorage, phím tắt, chọn model.

## Phase 4: Kiểm thử, Tối ưu & Đóng gói
- [x] Chạy toàn bộ test suite kiểm tra coverage >= 80% (Đạt 83.29% line coverage, 100% tests pass).
- [x] Chạy thử nghiệm thực tế khởi động server và API health check.
- [x] Hoàn thiện `README.md` hướng dẫn cấu hình và sử dụng.
