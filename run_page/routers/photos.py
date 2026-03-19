"""
run_page/routers/photos.py

ARCH-1: /api/v1/photos 路由模块
处理照片展示与同步。
"""

import os
import requests
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Query
from stravalib.client import Client

from run_page.services.db_service import get_db_conn, resolve_active_types
from run_page.auth import get_credential

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


def sync_strava_photos(limit: int = 1000):
    """后台任务：从 Strava 同步照片。"""
    import datetime as dt_mod
    print(f"[{dt_mod.datetime.now()}] Starting photo sync...")

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

        activities = list(client.get_activities(limit=limit))
        for activity in activities:
            if getattr(activity, "total_photo_count", 0) > 0:
                # 检查是否已同步
                cur.execute("SELECT id FROM photos WHERE activity_id = ?", (activity.id,))
                if cur.fetchone():
                    continue

                print(f"Syncing photos for activity {activity.id}")
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
                                    with open(local_path, "wb") as f:
                                        f.write(r.content)
                            except Exception:
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
        print(f"Photo sync error: {e}")
    finally:
        if "conn" in locals():
            conn.close()
