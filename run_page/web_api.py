"""
run_page/web_api.py  (ARCH-1 重构后的精简主入口)

职责：
  1. 创建 FastAPI app 实例
  2. 配置 CORS、静态文件、lifespan
  3. include_router() 挂载所有路由模块
  4. 保留少量无法拆分的旧函数（Strava athlete cache、clubs cache）
     供各路由模块 import 使用，待后续进一步拆分

原 web_api.py 中的业务逻辑已迁移至：
  run_page/routers/stats.py        → /api/v1/stats
  run_page/routers/sync.py         → /api/v1/sync, /api/v1/sync_segments
  run_page/routers/challenges.py   → /api/v1/challenges
  run_page/services/db_service.py  → 数据库连接与工具函数
  run_page/services/cache_service.py → 内存缓存
"""

import os
import sys
import asyncio
import time
from datetime import datetime

import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

sys.path.append(os.getcwd())

from run_page.core.auth import load_creds, get_credential
from run_page.core.config import API_PORT, FRONTEND_PORT
from run_page.services.db_service import get_db_conn
from run_page.services.cache_service import cache

# ── CORS origins（支持环境变量覆盖） ─────────────────────────────────────────
_cors_env = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env
    else [
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
    ]
)

# ── Strava 全局缓存（供 routers 共用） ───────────────────────────────────────
ATHLETE_CACHE: dict = {"data": None, "expiry": 0}
CLUBS_CACHE:   dict = {"data": None, "expiry": 0}


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
    except Exception as e:
        print(f"[web_api] Athlete fetch error: {e}")
        ATHLETE_CACHE["error_expiry"] = now + 600
        return {"username": "KY", "profile": None}


# ── Auto-sync scheduler ───────────────────────────────────────────────────────

async def schedule_auto_sync():
    """每天 00:00 (SGT/CCT) 自动触发一次全量同步。"""
    import datetime as dt
    import pytz

    while True:
        try:
            tz  = pytz.timezone("Asia/Singapore")
            now = datetime.now(tz)
            tomorrow = (now + dt.timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            wait_sec = (tomorrow - now).total_seconds()
            await asyncio.sleep(wait_sec)

            sync_on_startup = os.environ.get("SYNC_ON_STARTUP", "false").lower() == "true"
            if sync_on_startup:
                from run_page.routers.sync import _run_full_sync
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                    ex.submit(_run_full_sync, False)
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
    except Exception as e:
        print(f"[{datetime.now()}] Database init failed: {e}")

    # 启动时如果设置了 SYNC_ON_STARTUP，立即同步一次
    if os.environ.get("SYNC_ON_STARTUP", "false").lower() == "true":
        from run_page.routers.sync import _run_full_sync
        asyncio.create_task(asyncio.to_thread(_run_full_sync, False))

    asyncio.create_task(schedule_auto_sync())
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="TrackRecord API",
    description="Multi-platform sports data sync & dashboard backend.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
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

# ── Include routers ───────────────────────────────────────────────────────────
from run_page.routers.stats      import router as stats_router
from run_page.routers.sync       import router as sync_router
from run_page.routers.challenges import router as challenges_router

# 以下路由尚未拆分，保留在原 web_api.py（或继续按需拆分）:
# segments, photos, profile / rewind — 可参照上述模式逐步迁移

app.include_router(stats_router)
app.include_router(sync_router)
app.include_router(challenges_router)

# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def read_root():
    index_path = os.path.join("run_page", "static", "dashboard", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<p>TrackRecord API — <a href='/docs'>Swagger Docs</a></p>")


# ── Dev entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("run_page.web_api:app", host="0.0.0.0", port=API_PORT, reload=True)