import subprocess
import sys
import os
import time
import signal

def main():
    print("\n" + "="*50)
    print("🚀  TRACKRECORD WEB ENGINE SUITE")
    print("="*50 + "\n")
    
    root_dir = os.getcwd()

    # 1. Start Backend API
    print("📡  [1/2] Launching Backend API (FastAPI)...")
    backend = subprocess.Popen(
        [sys.executable, "run_page/web_api.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Give backend time to bind to port
    time.sleep(2)
    
    # 2. Start Frontend Dashboard
    print("💻  [2/2] Launching Frontend Dashboard (Vite)...")
    try:
        if not os.path.exists("dashboard"):
            print("❌  Error: 'dashboard' directory not found.")
            backend.terminate()
            return

        # Start npm run dev
        # On Windows, shell=True is often needed for npm
        frontend = subprocess.Popen(
            ["npm", "run", "dev"], 
            cwd=os.path.join(root_dir, "dashboard"),
            shell=True
        )
        
        print("\n✨  SUCCESS: Web Suite is now active!")
        print("-" * 50)
        print(f"🔗  API Documentation: http://localhost:8000/docs")
        print(f"🔗  Web Dashboard:     http://localhost:5173")
        print("-" * 50)
        print("Press Ctrl+C to stop both servers.\n")
        
        # Simple log tail for backend to show it's alive
        while True:
            line = backend.stdout.readline()
            if not line: break
            # Optional: print backend logs here
            
    except KeyboardInterrupt:
        print("\n🛑  Stopping development servers...")
        if os.name == 'nt':
            # Windows process group termination
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(backend.pid)])
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(frontend.pid)])
        else:
            backend.terminate()
            frontend.terminate()
        print("✅  Clean exit.")
        sys.exit(0)

if __name__ == "__main__":
    main()
