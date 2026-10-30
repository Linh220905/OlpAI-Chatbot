/**
 * System prompt chuẩn hóa cho Môi trường luyện thi OLPAi
 */
export const OLP_SYSTEM_PROMPT = `Bạn là Trợ lý AI và Huấn luyện viên chuyên gia của "Môi trường luyện thi OLPAi", chuyên bồi dưỡng học sinh - sinh viên luyện thi Olympic Tin học (OLP) các bảng (Chuyên tin, Không chuyên, Cao đẳng, Siêu cúp) và ICPC.

Quy chuẩn và phong cách trả lời:
1. Trả lời CỰC KỲ NGẮN GỌN, súc tích, đi thẳng vào trọng tâm. Không chào hỏi khách sáo, không mở bài dông dài, không kết bài thừa thãi.
2. TUYỆT ĐỐI KHÔNG xuất quá trình suy nghĩ (thinking process, reasoning, Chain of Thought, độc thoại nội tâm). TUYỆT ĐỐI KHÔNG in các đoạn suy nghĩ nháp bằng tiếng Anh vào câu trả lời.
3. 100% phản hồi bằng tiếng Việt (ngoại trừ cú pháp mã nguồn và thuật ngữ kỹ thuật bắt buộc).
4. Bạn là "Trợ lý AI của Môi trường luyện thi OLPAi" (không xưng là ChatGPT, GPT-4 hay OpenAI). Với câu hỏi thông thường, hỏi han hoặc hỏi danh tính: chỉ trả lời trong 1 - 2 câu ngắn gọn, không áp dụng cấu trúc 4 phần giải thuật.
5. Khi người dùng yêu cầu giải thuật toán hoặc viết code, LUÔN trình bày súc tích theo 4 phần:
   - **1. Ý tưởng & Bản chất thuật toán**: Giải thích ngắn gọn trong 1-3 câu phương pháp tiếp cận tối ưu.
   - **2. Đánh giá độ phức tạp**: Thời gian $O(...)$, Bộ nhớ $O(...)$ (kèm kiểm tra giới hạn $10^8$ phép tính / 256MB).
   - **3. Mã nguồn tối ưu (Clean Code)**: Mã nguồn hoàn chỉnh, cấu trúc rõ ràng, sử dụng Fast I/O, bọc trong markdown block (\`\`\`cpp, \`\`\`python, v.v.).
   - **4. Test case biên & Bẫy thường gặp (Corner cases)**: Gạch đầu dòng cực ngắn về tràn số (\`long long\`), $N=0, 1$, mảng rỗng, chia cho 0, mod số âm.
6. Nếu người dùng hỏi debug hoặc lý thuyết: tìm đúng nguyên nhân gốc rễ (root cause), giải thích ngắn gọn trong 1-2 câu và đưa mã sửa đổi tối ưu nhất.`;

/**
 * Danh sách gợi ý câu hỏi nhanh (Quick Templates) cho luyện thi OLP
 */
export const QUICK_TEMPLATES = Object.freeze([
  {
    id: 'dp-opt',
    category: 'Quy hoạch động',
    title: 'Tối ưu Quy hoạch động',
    prompt: 'Hãy hướng dẫn các kỹ thuật tối ưu Quy hoạch động phổ biến trong OLP (như Convex Hull Trick, D&C Optimization, Knuth Optimization) kèm bài toán kinh điển minh họa.'
  },
  {
    id: 'segment-tree',
    category: 'Cấu trúc dữ liệu',
    title: 'Segment Tree & Lazy Propagation',
    prompt: 'Cài đặt Cây phân đoạn (Segment Tree) hỗ trợ cập nhật đoạn (Lazy Propagation) và truy vấn giá trị lớn nhất trong đoạn. Viết bằng C++ chuẩn thi đấu.'
  },
  {
    id: 'shortest-path',
    category: 'Đồ thị',
    title: 'Dijkstra + Priority Queue',
    prompt: 'Cài đặt thuật toán Dijkstra tìm đường đi ngắn nhất sử dụng priority_queue trong C++. Phân tích độ phức tạp thời gian và các trường hợp biên đồ thị có cạnh 0.'
  },
  {
    id: 'math-comb',
    category: 'Số học & Tổ hợp',
    title: 'Nghịch đảo modulo & Tổ hợp nCk',
    prompt: 'Viết hàm tiền xử lý tính giai thừa và nghịch đảo modulo để tính tổ hợp $C_n^k \\pmod{10^9 + 7}$ với $n \\le 10^6$ trong thời gian $O(1)$ mỗi truy vấn.'
  },
  {
    id: 'binary-search',
    category: 'Tìm kiếm',
    title: 'Chặt nhị phân kết quả',
    prompt: 'Mẫu khuôn (template) chuẩn cho bài toán Chặt nhị phân trên tập kết quả (Binary Search on Answer) trong thi Olympic Tin học, cách xác định hàm kiểm tra check() và tránh lặp vô tận.'
  },
  {
    id: 'code-review-olp',
    category: 'Debug & Tối ưu',
    title: 'Debug & Tối ưu thuật toán',
    prompt: 'Tôi có một đoạn code đang bị TLE (Time Limit Exceeded) hoặc WA (Wrong Answer). Hãy giúp tôi tìm bẫy corner-case và tối ưu độ phức tạp.'
  }
]);

/**
 * Tạo danh sách tin nhắn gửi tới Provider (luôn kẹp System Prompt OLP ở đầu)
 * @param {Array<{role: string, content: string}>} userMessages
 * @param {string} [systemPromptOverride]
 * @returns {Array<{role: string, content: string}>}
 */
export function buildChatMessages(userMessages, systemPromptOverride) {
  const sysPrompt = systemPromptOverride || OLP_SYSTEM_PROMPT;

  const validMessages = Array.isArray(userMessages)
    ? userMessages.filter(m => m && typeof m.content === 'string' && m.content.trim().length > 0 && m.role)
    : [];

  // Gộp các tin nhắn liên tiếp cùng role để tương thích chuẩn OpenAI và tránh lỗi consecutive user messages
  const collapsedMessages = [];
  for (const msg of validMessages) {
    if (collapsedMessages.length > 0 && collapsedMessages[collapsedMessages.length - 1].role === msg.role) {
      collapsedMessages[collapsedMessages.length - 1].content += '\n\n' + msg.content.trim();
    } else {
      collapsedMessages.push({ role: msg.role, content: msg.content.trim() });
    }
  }

  return [
    { role: 'system', content: sysPrompt },
    ...collapsedMessages
  ];
}
