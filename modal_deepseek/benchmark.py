import argparse
import json
import time
import urllib.request

DEFAULT_PROMPT = "Viết một hàm Python thực hiện thuật toán Dijkstra tìm đường đi ngắn nhất trên đồ thị, có giải thích ngắn gọn."


def benchmark(
    url: str,
    prompt: str = DEFAULT_PROMPT,
    warm_requests: int = 3,
    max_tokens: int = 128,
) -> None:
    endpoint = url.rstrip("/")
    if not endpoint.endswith("/v1/chat/completions"):
        endpoint += "/v1/chat/completions"

    print(f"--> Endpoint: {endpoint}")
    print(
        f"--> Đo 1 request đầu + {warm_requests} request warm; "
        f"giới hạn {max_tokens} output tokens/request"
    )

    results = []
    for request_number in range(warm_requests + 1):
        payload = json.dumps(
            {
                "model": "deepseek-32b",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": 0.6,
                "stream": True,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"\n--> Request {request_number + 1} ({'cold/first' if request_number == 0 else 'warm'})")
        start_time = time.perf_counter()
        first_token_time = None
        output_text = ""

        with urllib.request.urlopen(req, timeout=900) as response:
            for line in response:
                line = line.decode("utf-8").strip()
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break

                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        output_text += delta
                except (KeyError, IndexError, json.JSONDecodeError):
                    continue

        end_time = time.perf_counter()
        total_time = end_time - start_time
        ttft = (first_token_time - start_time) if first_token_time else total_time
        output = {
            "total": total_time,
            "ttft": ttft,
            "text": output_text,
        }
        results.append(output)
        print(f"Tổng thời gian: {total_time:.2f} s")
        print(f"Time to First Token: {ttft * 1000:.1f} ms")
        print(f"Đạt chuẩn warm < 10s: {'ĐẠT' if request_number and total_time < 10 else 'CHƯA ĐẠT'}")
        if request_number == 0:
            print(f"Phản hồi đầu (150 ký tự): {output_text[:150]}...")

    warm_times = [result["total"] for result in results[1:]]
    if warm_times:
        print("\n" + "=" * 50)
        print(f"Trung bình warm: {sum(warm_times) / len(warm_times):.2f} s")
        print(f"Warm nhanh nhất: {min(warm_times):.2f} s")
        print(f"Warm đạt < 10s: {sum(t < 10 for t in warm_times)}/{len(warm_times)}")
        print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="Modal web endpoint URL")
    parser.add_argument("prompt", nargs="?", default=DEFAULT_PROMPT)
    parser.add_argument("--warm-requests", type=int, default=3)
    parser.add_argument("--max-tokens", type=int, default=128)
    args = parser.parse_args()
    benchmark(args.url, args.prompt, args.warm_requests, args.max_tokens)
