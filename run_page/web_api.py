"""
run_page/web_api.py

职责：
  1. 创建 FastAPI app 实例
  2. 配置 CORS、静态文件、lifespan
  3. include_router() 挂载所有路由模块（stats, sync, challenges, photos, segments, rewind）
  4. 支持 SPA 路由回退 (catch-all)
"""

import os
import asyncio
import contextlib
from datetime import datetime

import sys
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from run_page.db import init_db
from run_page.config import API_PORT, FRONTEND_PORT
from run_page.routers import photos, challenges, segments, sync, stats, rewind
from run_page.services.sync_service import auto_sync_worker


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles application startup and shutdown events."""
    try:
        init_db()
        print(f"[{datetime.now()}] Database initialized.")
    except Exception as e:
        print(f"[{datetime.now()}] Database initialization failed: {e}")

    asyncio.create_task(auto_sync_worker())
    yield


app = FastAPI(
    title="TrackRecord API",
    description="Modular API for TrackRecord",
    version="2.0.0",
    lifespan=lifespan
)

origins = [
    f"http://localhost:{FRONTEND_PORT}",
    f"http://127.0.0.1:{FRONTEND_PORT}",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(photos.router)
app.include_router(challenges.router)
app.include_router(segments.router)
app.include_router(sync.router)
app.include_router(stats.router)
app.include_router(rewind.router)

# Static Asset Mounting
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(os.path.join(STATIC_DIR, "photos"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "trophy_icons"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Dashboard Build Mounting (Vite/SPA)
dashboard_root = os.path.join(BASE_DIR, "static", "dashboard")
if os.path.exists(dashboard_root):
    assets_path = os.path.join(dashboard_root, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="dashboard-assets")
    app.mount("/dashboard", StaticFiles(directory=dashboard_root), name="dashboard-ui")


@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Catch-all route for SPA routing support."""
    if full_path.startswith("api/v1"):
        raise HTTPException(status_code=404, detail="API Route Not Found")

    file_path = os.path.join(dashboard_root, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    index_path = os.path.join(dashboard_root, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<p>TrackRecord API — <a href='/docs'>Swagger Docs</a></p>")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("run_page.web_api:app", host="0.0.0.0", port=API_PORT, reload=True)
