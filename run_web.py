import subprocess
import sys
import os
import time
import shutil
from run_page.config import API_PORT, FRONTEND_PORT

# Ensure stdout uses UTF-8 on Windows (avoids GBK emoji crash)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def main():
    backend = None
    frontend = None
    try:
        print("\n" + "="*50)
        print("  TRACKRECORD WEB ENGINE SUITE")
        print("="*50 + "\n")

        # 1. Start Backend API
        print("[1/2] Launching Backend API (FastAPI)...")
        # Use module-style start (-m) to ensure parent package is recognized
        backend = subprocess.Popen(
            [sys.executable, "-m", "run_page.web_api"]
        )

        # Give backend time to bind to port
        time.sleep(2)

        # 2. Start Frontend Dashboard
        print("[2/2] Launching Frontend Dashboard (Vite)...")

        if not os.path.exists("dashboard"):
            print("Error: 'dashboard' directory not found.")
            backend.terminate()
            return

        if not shutil.which("npm"):
            print("Error: 'npm' command not found. Please ensure Node.js is installed.")
            backend.terminate()
            return

        # Start npm run dev
        frontend = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=os.path.join(os.getcwd(), "dashboard"),
            shell=True
        )

        print("\nSUCCESS: Web Suite is now active!")
        print("-" * 50)
        print(f"  API Documentation: http://localhost:{API_PORT}/docs")
        print(f"  Web Dashboard:     http://localhost:{FRONTEND_PORT}")
        print("-" * 50)
        print("Press Ctrl+C to stop both servers.\n")

        # Wait for the backend process to exit (or for a signal)
        backend.wait()

    except KeyboardInterrupt:
        print("\nStopping development servers...")
        for p in [backend, frontend]:
            if p:
                try:
                    p.terminate()
                    p.wait(timeout=5)
                except (subprocess.TimeoutExpired, Exception):
                    if p: p.kill()
        print("Clean exit.")
        sys.exit(0)

if __name__ == "__main__":
    main()
