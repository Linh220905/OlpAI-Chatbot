import subprocess
import time
from urllib.error import URLError
from urllib.request import urlopen

import modal

app = modal.App("deepseek-32b-service")
volume = modal.Volume.from_name("deepseek-model-cache", create_if_missing=True)

MODEL_DIR = "/models/deepseek-32b-fp8"
SERVER_STARTUP_TIMEOUT = 600

vllm_image = (
    modal.Image.from_registry(
        "vllm/vllm-openai:latest",
        add_python="3.11",
        setup_dockerfile_commands=["ENTRYPOINT []"],
    ).env(
        {
            "VLLM_USE_V1": "0",
            "HF_HUB_ENABLE_HF_TRANSFER": "1",
        }
    )
)


@app.function(
    gpu="L40S",
    image=vllm_image,
    volumes={"/models": volume},
    timeout=1800,
    scaledown_window=300,
)
@modal.web_server(
    port=8000,
    startup_timeout=SERVER_STARTUP_TIMEOUT,
    requires_proxy_auth=True,
)
def serve():
    cmd = [
        "vllm",
        "serve",
        MODEL_DIR,
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--served-model-name",
        "deepseek-32b",
        "--gpu-memory-utilization",
        "0.95",
        "--max-model-len",
        "16384",
        "--max-num-seqs",
        "64",
        "--reasoning-parser",
        "deepseek_r1",
        "--reasoning-config",
        '{"reasoning_start_str":"<think>","reasoning_end_str":"</think>"}',
        "--kv-cache-dtype",
        "fp8",
        "--enable-prefix-caching",
        "--enable-chunked-prefill",
        "--trust-remote-code",
    ]
    process = subprocess.Popen(cmd)
    deadline = time.monotonic() + SERVER_STARTUP_TIMEOUT - 10

    while time.monotonic() < deadline:
        return_code = process.poll()
        if return_code is not None:
            raise RuntimeError(
                f"vLLM exited during startup with code {return_code}; see container logs"
            )

        try:
            with urlopen("http://127.0.0.1:8000/health", timeout=2):
                return
        except (OSError, URLError):
            time.sleep(1)

    process.terminate()
    raise TimeoutError(
        f"vLLM did not become healthy within {SERVER_STARTUP_TIMEOUT - 10} seconds"
    )
