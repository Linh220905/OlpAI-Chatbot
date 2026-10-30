"""Change the deployed DeepSeek Modal function's warm-container floor."""

import argparse
import time

import modal


APP_NAME = "deepseek-32b-service"
FUNCTION_NAME = "serve"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("start", "stop"))
    action = parser.parse_args().action

    function = modal.Function.from_name(APP_NAME, FUNCTION_NAME)
    if action == "start":
        function.update_autoscaler(
            min_containers=1,
            max_containers=1,
            scaledown_window=300,
        )
        print("One warm container requested; scale-out capped at 1")
    else:
        function.update_autoscaler(min_containers=0, scaledown_window=2)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            stats = function.get_current_stats()
            if stats.num_total_runners == 0 and stats.num_running_inputs == 0:
                print("DeepSeek stopped: zero runners and zero active inputs")
                return
            time.sleep(2)
        raise TimeoutError(
            "DeepSeek did not scale to zero within 180 seconds "
            f"(runners={stats.num_total_runners}, active={stats.num_running_inputs})"
        )


if __name__ == "__main__":
    main()
