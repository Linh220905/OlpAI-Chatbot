# Product Requirements Document (PRD)

## 1. Tên dự án
**Môi trường luyện thi OLPAi**

## 2. Mục tiêu
Xây dựng giao diện web chuyên nghiệp, tối giản mô phỏng ChatGPT / Cursor / Claude Code chuyên biệt cho học sinh/sinh viên luyện thi Olympic Tin học (OLP) và lập trình thi đấu (Competitive Programming). Hỗ trợ kết nối linh hoạt tới bất kỳ LLM Provider nào tương thích chuẩn OpenAI API thông qua cấu hình `.env`.

## 3. Đối tượng sử dụng
- Thí sinh luyện thi OLP Tin học các khối (Chuyên tin, Không chuyên, Cao đẳng, Siêu cúp, ICPC).
- Giảng viên, huấn luyện viên đội tuyển tin học.
- Lập trình viên ôn luyện thuật toán và cấu trúc dữ liệu.

## 4. Yêu cầu tính năng chính
### 4.1. Cấu hình linh hoạt (.env)
- `PROVIDER_BASE_URL`: Hỗ trợ OpenAI, DeepSeek, OpenRouter, Groq, Ollama hoặc proxy bất kỳ.
- `PROVIDER_API_KEY`: Key xác thực.
- `AVAILABLE_MODELS`: Danh sách model để người dùng chọn trên giao diện.
- `DEFAULT_MODEL`: Model khởi tạo mặc định.
- Cho phép người dùng nhập trực tiếp tên model tùy chỉnh nếu muốn.

### 4.2. Giao diện người dùng (UI)
- Tối giản, tông màu tối hiện đại (dark theme lấy cảm hứng từ Cursor / Claude / VS Code).
- Header: Tên "Môi trường luyện thi OLPAi", bộ chọn Model selector kèm status indicator (kết nối provider).
- Sidebar: Lịch sử phiên chat (lưu trữ local, tạo chat mới, đổi tên, xóa chat).
- Chat Area: Khung tin nhắn cuộn mượt mà, hỗ trợ streaming thời gian thực (Server-Sent Events).
- Quick Prompts: Gợi ý các dạng bài OLP phổ biến (Quy hoạch động, Đồ thị, Cây phân đoạn, Tổ hợp, Tìm kiếm nhị phân).

### 4.3. Định dạng trả lời & Code Cell Card (Đặc thù Coding)
- Định dạng câu trả lời chuẩn mực như các web coding lớn:
  1. Phân tích đề bài & Bản chất thuật toán.
  2. Đánh giá độ phức tạp Thời gian (Time Complexity: $O(...)$) và Không gian (Space Complexity: $O(...)$).
  3. Mã nguồn tối ưu, chuẩn thi đấu (C++, Python, Java,... với fast I/O, template chuẩn).
  4. Các test case biên (Corner cases, $N=1$, giá trị cực trị, tràn số `long long`).
- Khối mã nguồn (Code Cell Card):
  - Đóng gói trong card chuyên biệt, có viền tinh tế và thanh tiêu đề (header bar).
  - Huy hiệu ngôn ngữ lập trình (C++, Python, Java, Pascal, Go...).
  - Nút Copy mã nguồn 1-click kèm phản hồi trạng thái "Copied!".
  - Hỗ trợ cuộn ngang mượt mà, font Monospace chuẩn lập trình (JetBrains Mono/Fira Code/Cascadia Code).

### 4.4. Trải nghiệm tương tác
- Real-time streaming response qua SSE (Server-Sent Events).
- Nút "Dừng phản hồi" (Stop generation) khi đang stream.
- Tự động cuộn xuống theo nội dung stream và cho phép cuộn tự do khi xem lại.
