import modal

app = modal.App("test-kernel-build")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("vllm")
    .run_commands("vllm download-kernels")
)

@app.function(image=image)
def dummy():
    print("Kernel download test successful!")

@app.local_entrypoint()
def main():
    dummy.remote()
