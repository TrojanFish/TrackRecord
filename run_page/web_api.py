"""
run_page/web_api.py (ARCH-1 精简主入口 - 修复版)

职责：
  1. 创建 FastAPI app 实例
  2. 配置 CORS、静态文件、lifespan
  3. include_router() 挂载所有路由模块（stats, sync, challenges, photos, segments, rewind）
  4. 支持 SPA 路由回退 (catch-all)
"""

import os
import sys
import asyncio
import time
from datetime import datetime
import contextlib

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

sys.path.append(os.getcwd())

from run_page.core.auth import load_creds, get_credential
from run_page.core.config import API_PORT, FRONTEND_PORT
from run_page.services.db_service import get_db_conn
from run_page.services.cache_service import cache

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_env = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env
    else [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
    ]
)

# ── Strava 缓存（保留在入口，供全量迁移前兼容） ────────────────────────────────
ATHLETE_CACHE: dict = {"data": None, "expiry": 0}

def get_strava_athlete_cached(creds: dict) -> dict:
    global ATHLETE_CACHE
    now = time.time()
    if ATHLETE_CACHE["data"] and now < ATHLETE_CACHE["expiry"]:
        return ATHLETE_CACHE["data"]
    if "error_expiry" in ATHLETE_CACHE and now < ATHLETE_CACHE["error_expiry"]:
        return {"username": "KY", "profile": None}

    client_id     = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")

    if not all([client_id, client_secret, refresh_token]):
        return {"username": "KY", "profile": None}

    try:
        from stravalib.client import Client
        client = Client()
        resp = client.refresh_access_token(
            client_id=client_id, client_secret=client_secret, refresh_token=refresh_token
        )
        client.access_token = resp["access_token"]
        athlete = client.get_athlete()
        data = {
            "username": f"{athlete.firstname} {athlete.lastname or ''}".strip(),
            "profile": athlete.profile_medium,
        }
        ATHLETE_CACHE.update({"data": data, "expiry": now + 3600})
        return data
    except Exception:
        ATHLETE_CACHE["error_expiry"] = now + 600
        return {"username": "KY", "profile": None}


# ── 任务调度 (Auto-Sync) ─────────────────────────────────────────────────────

async def schedule_auto_sync():
    import datetime as dt
    import pytz
    while True:
        try:
            tz = pytz.timezone("Asia/Singapore")
            now = datetime.now(tz)
            tomorrow = (now + dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            wait_sec = (tomorrow - now).total_seconds()
            await asyncio.sleep(wait_sec)

            if os.environ.get("SYNC_ON_STARTUP", "false").lower() == "true":
                from run_page.routers.sync import _run_full_sync
                asyncio.create_task(asyncio.to_thread(_run_full_sync, False))
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[auto-sync] Error: {e}")
            await asyncio.sleep(3600)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from run_page.db import init_db
        db_path = os.environ.get("DB_PATH", "run_page/data.db")
        init_db(db_path)
        print(f"[{datetime.now()}] Database initialized.")
    except Exception:
        pass

    if os.environ.get("SYNC_ON_STARTUP", "false").lower() == "true":
        from run_page.routers.sync import _run_full_sync
        asyncio.create_task(asyncio.to_thread(_run_full_sync, False))

    asyncio.create_task(schedule_auto_sync())
    yield


# ── APP 实例 ───────────────────────────────────────────────────────────────

app = FastAPI(title="TrackRecord API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 静态文件 ──────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(os.path.join(STATIC_DIR, "photos"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "trophy_icons"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

dashboard_root = os.path.join("run_page", "static", "dashboard")
if os.path.exists(dashboard_root):
    assets_path = os.path.join(dashboard_root, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="dashboard-assets")
    app.mount("/dashboard", StaticFiles(directory=dashboard_root), name="dashboard-ui")


# ── 路由挂载 ──────────────────────────────────────────────────────────────────
from run_page.routers.stats      import router as stats_router
from run_page.routers.sync       import router as sync_router
from run_page.routers.challenges import router as challenges_router
from run_page.routers.photos     import router as photos_router
from run_page.routers.segments   import router as segments_router
from run_page.routers.rewind     import router as rewind_router

app.include_router(stats_router)
app.include_router(sync_router)
app.include_router(challenges_router)
app.include_router(photos_router)
app.include_router(segments_router)
app.include_router(rewind_router)


# ── Root & SPA Catch-all ─────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def read_root():
    index_path = os.path.join(dashboard_root, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<p>TrackRecord API — <a href='/docs'>Swagger Docs</a></p>")

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """支持前端 SPA 路由回退，如果不是 API 路径且文件不存在则返回 index.html。"""
    if full_path.startswith("api/v1"):
        raise HTTPException(status_code=404, detail="API route not found")
    
    file_path = os.path.join(dashboard_root, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_path = os.path.join(dashboard_root, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    raise HTTPException(status_code=404, detail="Not Found")


# ── 启动入口 ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("run_page.web_api:app", host="0.0.0.0", port=API_PORT, reload=True)