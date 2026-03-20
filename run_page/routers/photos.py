"""
run_page/routers/photos.py

ARCH-1: /api/v1/photos 路由模块
处理照片展示与同步。
"""

import os
import logging
import requests
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Query
from stravalib.client import Client

from run_page.services.db_service import get_db_conn, resolve_active_types
from run_page.auth import get_credential

logger = logging.getLogger(__name__)
_MAX_PHOTO_BYTES = 20 * 1024 * 1024  # 20 MB hard cap per photo

router = APIRouter(prefix="/api/v1", tags=["photos"])


@router.get("/photos")
def get_activity_photos(background_tasks: BackgroundTasks, sport_type: Optional[str] = Query(None)):
    """获取照片列表，如果为空则触发同步。"""
    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        active_types, _, _ = resolve_active_types(sport_type)
        placeholders = ",".join(["?"] * len(active_types))

        cur.execute(
            f"SELECT * FROM photos WHERE type IN ({placeholders}) ORDER BY date DESC LIMIT 500",
            (*active_types,),
        )
        rows = cur.fetchall()

        if not rows and not sport_type:
            background_tasks.add_task(sync_strava_photos)
            return []

        photos = []
        for r in rows:
            # 兼容本地路径与远程 URL
            url = r["remote_url"]
            if r["local_path"]:
                local_name = os.path.basename(r["local_path"])
                url = f"/static/photos/{local_name}"

            photos.append({
                "id": r["id"],
                "url": url,
                "title": r["title"],
                "location": r["location_country"] or "Strava Activity",
                "date": r["date"],
                "type": r["type"],
                "country": r["location_country"],
                "activity_id": str(r["activity_id"])
            })
        return photos
    finally:
        conn.close()


def sync_strava_photos(days: int = 90):
    """
    后台任务：同步最近 `days` 天内有照片的活动到本地 DB。
    使用时间窗口而非 limit=N，大幅减少 Strava API 分页调用次数。
    """
    import datetime as dt_mod
    logger.info("Starting photo sync (last %d days)...", days)

    client_id     = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")

    if not all([client_id, client_secret, refresh_token]):
        return

    client = Client()
    try:
        resp = client.refresh_access_token(
            client_id=client_id, client_secret=client_secret, refresh_token=refresh_token
        )
        client.access_token = resp["access_token"]

        conn = get_db_conn()
        cur = conn.cursor()

        static_photos_dir = "run_page/static/photos"
        os.makedirs(static_photos_dir, exist_ok=True)

        after_dt = dt_mod.datetime.now() - dt_mod.timedelta(days=days)
        # per_page=200 is the Strava API maximum (default 30 wastes 6× more calls)
        activities = list(client.get_activities(after=after_dt, per_page=200))
        # Batch query already-synced activity IDs to avoid N+1 queries
        photo_activity_ids = [a.id for a in activities if getattr(a, "total_photo_count", 0) > 0]
        if not photo_activity_ids:
            return
        ph_ids = ",".join(["?"] * len(photo_activity_ids))
        cur.execute(f"SELECT DISTINCT activity_id FROM photos WHERE activity_id IN ({ph_ids})", photo_activity_ids)
        synced_ids = {row[0] for row in cur.fetchall()}

        for activity in activities:
            if getattr(activity, "total_photo_count", 0) == 0:
                continue
            if activity.id in synced_ids:
                continue

            logger.info("Syncing photos for activity %s", activity.id)
            activity_photos = client.get_activity_photos(activity.id, only_instagram=False, size=800)
            for idx, photo in enumerate(activity_photos):
                    if hasattr(photo, "urls") and photo.urls:
                        remote_url = (
                            photo.urls.get("800")
                            or photo.urls.get("original")
                            or list(photo.urls.values())[0]
                        )
                        photo_id = getattr(photo, "unique_id", None) or f"{activity.id}_{idx}"
                        local_name = f"{photo_id}.jpg"
                        local_path = os.path.join(static_photos_dir, local_name)

                        if not os.path.exists(local_path):
                            try:
                                r = requests.get(remote_url, timeout=15)
                                if r.status_code == 200:
                                    content_type = r.headers.get("Content-Type", "")
                                    if not content_type.startswith("image/"):
                                        logger.warning("Skipping non-image %s (type: %s)", remote_url, content_type)
                                        local_path = ""
                                    elif len(r.content) > _MAX_PHOTO_BYTES:
                                        logger.warning("Skipping oversized photo %s (%d bytes)", remote_url, len(r.content))
                                        local_path = ""
                                    else:
                                        with open(local_path, "wb") as f:
                                            f.write(r.content)
                            except Exception as dl_err:
                                logger.warning("Photo download failed %s: %s", remote_url, dl_err)
                                local_path = ""

                        cur.execute(
                            """INSERT OR REPLACE INTO photos
                               (id, activity_id, local_path, remote_url, title, date, type, location_country)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                str(photo_id),
                                activity.id,
                                local_path.replace("\\", "/"),
                                remote_url,
                                activity.name,
                                str(activity.start_date_local).split(" ")[0],
                                activity.type,
                                getattr(activity, "location_country", "")
                            )
                        )
        conn.commit()
    except Exception as e:
        logger.error("Photo sync error: %s", e, exc_info=True)
    finally:
        if "conn" in locals():
            conn.close()
