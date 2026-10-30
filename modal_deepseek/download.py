import modal

app = modal.App("deepseek-downloader")
volume = modal.Volume.from_name("deepseek-model-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("huggingface_hub[hf_transfer]>=0.28.0")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

DEFAULT_MODEL_ID = "RedHatAI/DeepSeek-R1-Distill-Qwen-32B-FP8-dynamic"
MODEL_DIR = "/models/deepseek-32b-fp8"


@app.function(
    image=image,
    volumes={"/models": volume},
    secrets=[modal.Secret.from_name("huggingface")],
    timeout=3600,
)
def download_model(model_id: str = DEFAULT_MODEL_ID):
    from huggingface_hub import snapshot_download

    print(f"--> Bắt đầu tải checkpoint: {model_id}")
    print(f"--> Lưu vào Modal Volume tại: {MODEL_DIR}")
    snapshot_download(
        repo_id=model_id,
        local_dir=MODEL_DIR,
        ignore_patterns=["*.pt", "*.bin", "*.pth", "*.onnx"],
    )
    volume.commit()
    print("--> Hoàn tất tải model vào Volume!")


@app.local_entrypoint()
def main(model_id: str = DEFAULT_MODEL_ID):
    download_model.remote(model_id=model_id)
