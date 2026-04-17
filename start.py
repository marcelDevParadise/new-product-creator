"""Start script — launches FastAPI backend, waits until it's ready,
then starts the Vite frontend and opens the browser."""

import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"
HEALTH_URL = f"{BACKEND_URL}/api/health"

BACKEND_READY_TIMEOUT = 60  # seconds
POLL_INTERVAL = 0.5  # seconds


def wait_for_backend(process: subprocess.Popen) -> bool:
    """Poll the backend's health endpoint until it responds or timeout is hit."""
    print("Waiting for backend to become ready", end="", flush=True)
    deadline = time.monotonic() + BACKEND_READY_TIMEOUT
    while time.monotonic() < deadline:
        if process.poll() is not None:
            print("\n  Backend process exited unexpectedly.")
            return False
        try:
            with urllib.request.urlopen(HEALTH_URL, timeout=1) as resp:
                if resp.status == 200:
                    print(" -> ready.")
                    return True
        except (urllib.error.URLError, ConnectionError, TimeoutError, OSError):
            pass
        print(".", end="", flush=True)
        time.sleep(POLL_INTERVAL)
    print("\n  Timeout: backend did not become ready in time.")
    return False


def main():
    print("Starting Attribut Generator...")
    print(f"  Backend:  {BACKEND_URL}")
    print(f"  Frontend: {FRONTEND_URL}")
    print()

    # Start backend — only watch Python source folders, not data/
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", "8000",
         "--reload-dir", "routers",
         "--reload-dir", "services",
         "--reload-dir", "models",
         ],
        cwd=str(BACKEND_DIR),
    )

    if not wait_for_backend(backend):
        backend.terminate()
        try:
            backend.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend.kill()
        sys.exit(1)

    # Start frontend dev server once backend is ready
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=str(FRONTEND_DIR),
        shell=True,
    )

    # Give Vite a brief moment to bind before opening the browser
    time.sleep(2)
    webbrowser.open(FRONTEND_URL)

    print("Press Ctrl+C to stop both servers.\n")
    try:
        backend.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        backend.terminate()
        frontend.terminate()
        backend.wait()
        frontend.wait()
        print("Done.")


if __name__ == "__main__":
    main()
