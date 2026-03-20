import os
import asyncio
import time
import logging
import requests
import sqlite3
from datetime import datetime
from stravalib.client import Client
from run_page.generator import Generator
from run_page.auth import get_credential

logger = logging.getLogger(__name__)

_MAX_PHOTO_BYTES = 20 * 1024 * 1024  # 20 MB hard cap per photo

def get_db_conn():
    db_path = os.environ.get("DB_PATH", "run_page/data.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def sync_strava_photos(days: int = 90):
    """
    Background task: download photos from Strava for activities in the last
    `days` days and save metadata to the local DB.

    Using an `after` time window instead of a large `limit` drastically reduces
    the number of paginated API calls (Strava rate limit: 100 req/15 min).
    """
    logger.info("Starting photo sync (last %d days)...", days)
    
    client_id = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")
    
    if not all([client_id, client_secret, refresh_token]):
        print("Missing Strava credentials for photo sync.")
        return

    client = Client()
    try:
        response = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token
        )
        client.access_token = response["access_token"]
        
        conn = get_db_conn()
        cur = conn.cursor()
        
        static_photos_dir = os.path.join("run_page", "static", "photos")
        os.makedirs(static_photos_dir, exist_ok=True)
        
        # Fetch only recent activities — per_page=200 uses the Strava API maximum
        # to minimise the number of paginated requests (default is 30/page).
        after_dt = datetime.now() - __import__('datetime').timedelta(days=days)
        activities = list(client.get_activities(after=after_dt, per_page=200))
        # Batch query which activities already have photos in DB (avoids N+1 queries)
        photo_activity_ids = [a.id for a in activities if getattr(a, 'total_photo_count', 0) > 0]
        if not photo_activity_ids:
            conn.close()
            return
        ph_ids = ",".join(["?"] * len(photo_activity_ids))
        cur.execute(f"SELECT DISTINCT activity_id FROM photos WHERE activity_id IN ({ph_ids})", photo_activity_ids)
        synced_ids = {row[0] for row in cur.fetchall()}

        for activity in activities:
            if getattr(activity, 'total_photo_count', 0) == 0:
                continue
            if activity.id in synced_ids:
                continue

            activity_photos = client.get_activity_photos(activity.id, only_instagram=False, size=800)
            for idx, photo in enumerate(activity_photos):
                    if hasattr(photo, 'urls') and photo.urls:
                        remote_url = photo.urls.get('800') or photo.urls.get('original') or list(photo.urls.values())[0]
                        photo_id = getattr(photo, 'unique_id', None) or f"{activity.id}_{idx}"

                        local_name = f"{photo_id}.jpg"
                        local_path = os.path.join(static_photos_dir, local_name)

                        if not os.path.exists(local_path):
                            try:
                                r = requests.get(remote_url, timeout=15)
                                if r.status_code == 200:
                                    content_type = r.headers.get("Content-Type", "")
                                    if not content_type.startswith("image/"):
                                        logger.warning("Skipping non-image URL %s (type: %s)", remote_url, content_type)
                                        local_path = None
                                    elif len(r.content) > _MAX_PHOTO_BYTES:
                                        logger.warning("Skipping oversized photo %s (%d bytes)", remote_url, len(r.content))
                                        local_path = None
                                    else:
                                        with open(local_path, "wb") as f:
                                            f.write(r.content)
                                else:
                                    local_path = None
                            except Exception as dl_err:
                                logger.warning("Photo download failed for %s: %s", remote_url, dl_err)
                                local_path = None
                        
                        if local_path:
                            # Normalize path for DB saving (web paths use forward slashes)
                            web_path = f"run_page/static/photos/{local_name}"
                            cur.execute("""
                                INSERT OR REPLACE INTO photos (id, activity_id, local_path, remote_url, title, date, type, location_country)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                str(photo_id), activity.id, web_path, remote_url, 
                                activity.name, str(activity.start_date_local).split(' ')[0], 
                                activity.type, getattr(activity, 'location_country', '')
                            ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Photo sync error: %s", e, exc_info=True)

def perform_sync_logic(force=False, segments_limit=20):
    """Core synchronization business logic."""
    try:
        db_path = os.environ.get("DB_PATH", "run_page/data.db")
        gen = Generator(db_path)
        
        cid = get_credential("strava_client_id")
        secret = get_credential("strava_client_secret")
        refresh = get_credential("strava_refresh_token")
        
        if cid and secret and refresh:
            gen.set_strava_config(cid, secret, refresh)
            gen.sync(force=force)
            gen.sync_segments(limit=segments_limit)
            sync_strava_photos(days=90)
        gen.close()
    except Exception as e:
        print(f"Sync failed: {e}")

async def auto_sync_worker():
    """Infinite loop for the midnight sync task."""
    import datetime as dt_mod
    from datetime import timezone, timedelta
    
    # Run once at startup if requested
    if os.environ.get("SYNC_ON_STARTUP", "true").lower() == "true":
        print(f"[{datetime.now()}] Performing initial startup sync (async thread)...")
        await asyncio.to_thread(perform_sync_logic)
        os.environ["SYNC_ON_STARTUP"] = "false"

    while True:
        tz_e8 = timezone(timedelta(hours=8))
        now_e8 = datetime.now(tz_e8)
        tomorrow = now_e8 + dt_mod.timedelta(days=1)
        next_sync = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=tz_e8)
        
        delay = (next_sync - now_e8).total_seconds()
        print(f"[{datetime.now()}] Next auto-sync scheduled for {next_sync} (in {delay/3600:.1f}h)")
        
        await asyncio.sleep(delay)
        await asyncio.to_thread(perform_sync_logic)
