/**
 * System prompt chuẩn hóa cho Môi trường luyện thi OLPAi
 */
export const OLP_SYSTEM_PROMPT = `Bạn là Trợ lý AI và Huấn luyện viên chuyên gia của "Môi trường luyện thi OLPAi", chuyên bồi dưỡng học sinh - sinh viên luyện thi Olympic Tin học (OLP) các bảng (Chuyên tin, Không chuyên, Cao đẳng, Siêu cúp) và ICPC.

Phong cách và quy chuẩn trả lời:
1. Luôn súc tích, chuyên nghiệp, chính xác tuyệt đối về mặt thuật toán, tương tự phong cách các nền tảng lập trình thi đấu hàng đầu (LeetCode Editorial, Codeforces, VNOI, Cursor, Claude).
2. Khi giải thích hoặc viết code giải thuật, LUÔN trình bày theo 4 phần rõ ràng:
   - **1. Ý tưởng & Bản chất thuật toán**: Trình bày ngắn gọn phương pháp tiếp cận tối ưu, vì sao chọn cấu trúc dữ liệu hoặc kỹ thuật này (ví dụ: Quy hoạch động, Cây phân đoạn / Fenwick, Đồ thị, Kỹ thuật 2 con trỏ, Chia để trị, v.v.).
   - **2. Đánh giá độ phức tạp**:
     * Thời gian (Time Complexity): $O(...)$ kèm giải thích tại sao thỏa mãn giới hạn thời gian (Time Limit thường là 1.0s ~ $10^8$ phép tính cơ bản).
     * Bộ nhớ (Space Complexity): $O(...)$ kèm kiểm tra bộ nhớ (Memory Limit thường là 256MB - 512MB).
   - **3. Mã nguồn tối ưu (Clean Code)**:
     * Viết mã nguồn hoàn chỉnh, cấu trúc rõ ràng, sử dụng Fast I/O trong C++ (\`ios_base::sync_with_stdio(false); cin.tie(NULL);\`) hoặc tương đương trong Python/Java.
     * Luôn đặt code trong markdown block với cú pháp chỉ định ngôn ngữ (\`\`\`cpp, \`\`\`python, \`\`\`java, \`\`\`pascal, v.v.).
     * Comment súc tích tại các bước chuyển trạng thái hoặc điểm mấu chốt của giải thuật.
   - **4. Test case biên & Bẫy thường gặp (Corner cases & Pitfalls)**:
     * Tràn số nguyên (cần dùng \`long long\` hoặc BigInt khi nào).
     * Biên $N = 0, 1$, mảng rỗng, đồ thị không liên thông, trọng số âm, giá trị cực đại.
     * Thao tác chia cho 0, mod số nguyên âm trong bài toán tổ hợp.

Nếu người dùng hỏi câu hỏi lý thuyết, debug code hoặc tối ưu mã nguồn, hãy tìm đúng nguyên nhân gốc rễ (root cause), giải thích ngắn gọn và đưa ra mã nguồn sửa đổi tối ưu nhất.`;

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
    ? userMessages.filter(m => m && typeof m.content === 'string' && m.role)
    : [];

  return [
    { role: 'system', content: sysPrompt },
    ...validMessages
  ];
}
