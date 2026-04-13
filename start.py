"""Start script — launches FastAPI backend and opens the browser."""

import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"


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

    # Start frontend dev server
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=str(FRONTEND_DIR),
        shell=True,
    )

    time.sleep(3)
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
