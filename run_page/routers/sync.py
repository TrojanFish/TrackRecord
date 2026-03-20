"""
run_page/routers/sync.py

ARCH-1: /api/v1/sync 路由模块
负责手动触发同步、查询同步状态，以及 segments 同步。
"""

import os
from fastapi import APIRouter, BackgroundTasks

from run_page.services.cache_service import cache

router = APIRouter(prefix="/api/v1", tags=["sync"])


def _run_full_sync(force: bool = False):
    """后台全量同步任务（原 web_api.py run_full_sync 内嵌函数）。"""
    from run_page.generator import Generator
    from run_page.auth import get_credential

    db_path = os.environ.get("DB_PATH", "run_page/data.db")
    gen = Generator(db_path)
    try:
        cid     = get_credential("strava_client_id")
        secret  = get_credential("strava_client_secret")
        refresh = get_credential("strava_refresh_token")
        if cid and secret and refresh:
            gen.set_strava_config(cid, secret, refresh)
            gen.sync(force=force)
            # Backfill segments for activities that were synced without them.
            # sync() itself no longer calls sync_segments internally — this is
            # the single authoritative call site.
            gen.sync_segments(limit=20)

            try:
                from run_page.routers.photos import sync_strava_photos
                sync_strava_photos(days=90)
            except Exception as pe:
                print(f"[sync] Photo sync failed: {pe}")
    finally:
        gen.close()
        # 同步完成后清除 stats 缓存，让下次请求拿到最新数据
        cleared = cache.clear_prefix("stats:")
        print(f"[sync] Cache cleared: {cleared} stats keys invalidated.")


def _run_segments_sync(limit: int = 20):
    """后台 Segments 同步任务。"""
    from run_page.generator import Generator
    from run_page.auth import get_credential

    db_path = os.environ.get("DB_PATH", "run_page/data.db")
    gen = Generator(db_path)
    try:
        cid     = get_credential("strava_client_id")
        secret  = get_credential("strava_client_secret")
        refresh = get_credential("strava_refresh_token")
        if cid and secret and refresh:
            gen.set_strava_config(cid, secret, refresh)
            gen.sync_segments(limit=limit)
    finally:
        gen.close()


@router.post("/sync")
def full_sync_endpoint(background_tasks: BackgroundTasks, force: bool = False):
    """触发后台全量数据同步。"""
    background_tasks.add_task(_run_full_sync, force)
    return {"status": "Full data sync started in background", "force": force}


@router.get("/sync/status")
def sync_status():
    """简单的同步状态查询（占位，可扩展为真实状态跟踪）。"""
    stats_info = cache.stats()
    return {
        "status": "idle",
        "cache": stats_info,
    }


@router.post("/sync_segments")
def sync_segments_endpoint(background_tasks: BackgroundTasks, limit: int = 20):
    """触发后台 Strava Segments 同步。"""
    background_tasks.add_task(_run_segments_sync, limit)
    return {"status": "Syncing segments in background", "limit": limit}