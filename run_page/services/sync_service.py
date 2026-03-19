import os
import asyncio
import time
import requests
import sqlite3
from datetime import datetime
from stravalib.client import Client
from run_page.generator import Generator
from run_page.auth import get_credential

def get_db_conn():
    db_path = os.environ.get("DB_PATH", "run_page/data.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def sync_strava_photos(limit: int = 1000):
    """Background task to download photos from Strava and save to local DB."""
    print(f"[{datetime.now()}] Starting photo sync (limit={limit})...")
    
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
        
        activities = list(client.get_activities(limit=limit))
        photo_activities_count = 0
        for activity in activities:
            if getattr(activity, 'total_photo_count', 0) > 0:
                photo_activities_count += 1
                cur.execute("SELECT local_path FROM photos WHERE activity_id = ?", (activity.id,))
                row = cur.fetchone()
                if row and row[0] and os.path.exists(row[0]):
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
                                    with open(local_path, "wb") as f:
                                        f.write(r.content)
                                else:
                                    local_path = None
                            except:
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
        print(f"Photo sync error: {e}")

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
            sync_strava_photos(limit=100)
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
