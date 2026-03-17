import os
import sys
import subprocess
import json
import sqlite3
import asyncio
import time
import yaml
from datetime import datetime
import datetime as dt
from typing import List, Optional, Dict
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
import contextlib
from pydantic import BaseModel

class TrophyImportRequest(BaseModel):
    html: str

import stravalib
from stravalib.client import Client
import requests
import re
from bs4 import BeautifulSoup

# Add project root to sys.path
sys.path.append(os.getcwd())

from run_page.core.platforms import get_platform_configs
from run_page.core.auth import load_creds, save_creds, get_credential
from run_page.ui.i18n import I18N

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database immediately on startup to ensure tables exist
    try:
        from run_page.db import init_db
        db_path = os.environ.get("DB_PATH", "run_page/data.db")
        init_db(db_path)
        print(f"[{datetime.now()}] Database initialized successfully.")
    except Exception as e:
        print(f"[{datetime.now()}] Database initialization failed: {e}")

    # Run the scheduler as a non-blocking background task on startup
    asyncio.create_task(schedule_auto_sync())
    yield
    # Shutdown logic if needed

app = FastAPI(
    description="Headless driver for multi-platform running data sync, powered by the core metadata system.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def row_to_seconds(val):
    if not val:
        return 0
    try:
        if isinstance(val, str):
            if " " in val: val = val.split(" ")[1] # Handle 1970-01-01 prefix
            if "." in val: val = val.split(".")[0] # Handle .000 fractional
            if ":" in val:
                parts = val.split(':')
                if len(parts) == 3:
                    return int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
                elif len(parts) == 2:
                    return int(parts[0])*60 + int(parts[1])
        return int(float(val))
    except:
        return 0

def calculate_streaks_detailed(dates):
    if not dates: return {"day": 0, "week": 0, "month": 0}
    # Unique sorted dates
    date_objs = sorted(list(set([dt.datetime.strptime(d, "%Y-%m-%d").date() for d in dates])))
    
    # 1. Day Streak
    max_day_streak = 0
    curr_day_streak = 0
    if date_objs:
        temp = 1
        for i in range(len(date_objs)-1):
            if (date_objs[i+1]-date_objs[i]).days == 1:
                temp += 1
            else:
                max_day_streak = max(max_day_streak, temp)
                temp = 1
        max_day_streak = max(max_day_streak, temp)

    # 2. Week Streak (ISO Weeks)
    weeks = sorted(list(set([d.isocalendar()[:2] for d in date_objs]))) # (year, week)
    max_week_streak = 0
    if weeks:
        temp = 1
        for i in range(len(weeks)-1):
            # Check if consecutive weeks
            y1, w1 = weeks[i]
            y2, w2 = weeks[i+1]
            if (y1 == y2 and w2 == w1 + 1) or (y2 == y1 + 1 and w1 >= 52 and w2 == 1):
                temp += 1
            else:
                max_week_streak = max(max_week_streak, temp)
                temp = 1
        max_week_streak = max(max_week_streak, temp)

    # 3. Month Streak
    months = sorted(list(set([(d.year, d.month) for d in date_objs])))
    max_month_streak = 0
    if months:
        temp = 1
        for i in range(len(months)-1):
            y1, m1 = months[i]
            y2, m2 = months[i+1]
            if (y1 == y2 and m2 == m1 + 1) or (y2 == y1 + 1 and m1 == 12 and m2 == 1):
                temp += 1
            else:
                max_month_streak = max(max_month_streak, temp)
                temp = 1
        max_month_streak = max(max_month_streak, temp)

    return {"day": max_day_streak, "week": max_week_streak, "month": max_month_streak}

# Global Caches
ATHLETE_CACHE = {"data": None, "expiry": 0}
CLUBS_CACHE = {"data": None, "expiry": 0}

def get_strava_athlete_cached(creds):
    global ATHLETE_CACHE
    now = time.time()
    if ATHLETE_CACHE["data"] and now < ATHLETE_CACHE["expiry"]:
        return ATHLETE_CACHE["data"]
    
    # Avoid rapid retries on error (especially 429)
    if "error_expiry" in ATHLETE_CACHE and now < ATHLETE_CACHE["error_expiry"]:
        return {"username": "KY", "profile": None}
    
    # Support env vars via get_credential
    client_id = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")
    
    if not all([client_id, client_secret, refresh_token]):
        return {"username": "KY", "profile": None}
        
    try:
        from stravalib.client import Client
        client = Client()
        response = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token
        )
        client.access_token = response["access_token"]
        athlete = client.get_athlete()
        data = {
            "username": f"{athlete.firstname} {athlete.lastname or ''}".strip(),
            "profile": athlete.profile_medium
        }
        ATHLETE_CACHE["data"] = data
        ATHLETE_CACHE["expiry"] = now + 3600
        return data
    except Exception as e:
        print(f"Athlete profile fetch error: {e}")
        # Cache the failure for 10 minutes to avoid spamming
        ATHLETE_CACHE["error_expiry"] = now + 600
        return {"username": "KY", "profile": None}

def get_strava_clubs_cached(creds):
    global CLUBS_CACHE
    now = time.time()
    if CLUBS_CACHE["data"] and now < CLUBS_CACHE["expiry"]:
        return CLUBS_CACHE["data"]
    
    if "error_expiry" in CLUBS_CACHE and now < CLUBS_CACHE["error_expiry"]:
        return []

    client_id = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")
    
    if not all([client_id, client_secret, refresh_token]):
        return []
        
    try:
        from stravalib.client import Client
        client = Client()
        response = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token
        )
        client.access_token = response["access_token"]
        clubs = client.get_athlete_clubs()
        clubs_data = []
        for c in clubs:
            clubs_data.append({
                "id": f"club-{c.id}",
                "name": c.name,
                "icon": "🛡️",
                "color": "#10b981",
                "progress": "Joined",
                "image": c.cover_photo_small
            })
        CLUBS_CACHE["data"] = clubs_data
        CLUBS_CACHE["expiry"] = now + 3600 # 1 hour cache
        return clubs_data
    except Exception as e:
        print(f"Club fetch error: {e}")
        CLUBS_CACHE["error_expiry"] = now + 600
        return []

def parse_and_save_trophies(html_content):
    """Parse trophies from HTML string and save to DB."""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        conn = get_db_conn()
        cur = conn.cursor()
        
        # Ensure trophy icons directory exists
        trophy_icons_dir = os.path.join("run_page", "static", "trophy_icons")
        os.makedirs(trophy_icons_dir, exist_ok=True)
        
        # Enhanced selectors to match real Strava HTML
        items = soup.select('.list-trophies li, .trophy-case-item, .trophy, li.medal, li.centered')
        count = 0
        for item in items:
            img_tag = item.select_one('img')
            name_tag = item.select_one('h6, .label, .trophy-name, h4, strong')
            date_tag = item.select_one('time.timestamp, .achievement-date, .date, small, .month')
            
            if img_tag and name_tag:
                name = name_tag.get_text(strip=True)
                img_url = img_tag.get('src')
                
                # Persistence: Download image locally
                local_img_url = img_url # Fallback
                try:
                    # Create a safe filename
                    safe_name = re.sub(r'[^a-zA-Z0-9]', '_', name).lower()
                    file_ext = img_url.split('.')[-1].split('?')[0] if '.' in img_url else 'png'
                    filename = f"{safe_name}.{file_ext}"
                    local_path = os.path.join(trophy_icons_dir, filename)
                    
                    # Download only if successfully getting the image
                    if not os.path.exists(local_path):
                        # Add a small delay for rate limit safety
                        import time
                        time.sleep(0.5) 
                        r = requests.get(img_url, stream=True, timeout=10)
                        if r.status_code == 200:
                            with open(local_path, 'wb') as f:
                                for chunk in r.iter_content(1024):
                                    f.write(chunk)
                    
                    # Only use local path if the file successfully exists now
                    if os.path.exists(local_path):
                        local_img_url = f"/static/trophy_icons/{filename}"
                except Exception as img_e:
                    print(f"Failed to download trophy icon {name}: {img_e}")

                date_str = date_tag.get_text(strip=True) if date_tag else "Special"
                month_match = re.search(r'([A-Za-z]+ \d{4})', date_str)
                month_key = month_match.group(1) if month_match else "HISTORICAL"
                
                # Use stable MD5 for ID to prevent duplicates across process restarts
                import hashlib
                stable_hash = hashlib.md5(name.encode()).hexdigest()[:12]
                tid = f"strava-trophy-{stable_hash}"
                
                # Check duplication by name or stable ID
                cur.execute("SELECT id FROM trophies WHERE name = ? OR id = ?", (name, tid))
                if cur.fetchone():
                    continue
                    
                cur.execute("""
                    INSERT OR REPLACE INTO trophies (id, name, image, color, progress, type, month)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (tid, name, local_img_url, "#ff5500", "Earned", "Strava Trophy", month_key))
                count += 1
        
        conn.commit()
        conn.close()
        return count
    except Exception as e:
        print(f"Failed to parse and save trophies: {e}")
        return 0

def get_imported_challenges_from_db():
    conn = get_db_conn()
    if not conn: return {}
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM trophies")
        rows = cur.fetchall()
        trophies_by_month = {}
        for r in rows:
            m = r["month"]
            if m not in trophies_by_month:
                trophies_by_month[m] = []
            trophies_by_month[m].append(dict(r))
        return trophies_by_month
    finally:
        conn.close()

# Create static directories and mount static files
# Use absolute paths for robust Docker mounting
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(os.path.join(STATIC_DIR, "photos"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "trophy_icons"), exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Mount production dashboard assets from the root if they exist
dashboard_root = os.path.join("run_page", "static", "dashboard")
if os.path.exists(dashboard_root):
    # Support for Vite /assets/ path
    assets_path = os.path.join(dashboard_root, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="dashboard-assets")
    # Also mount root dashboard for any other specific root files
    app.mount("/dashboard", StaticFiles(directory=dashboard_root), name="dashboard-ui")

# Simple localization for API
def L(key):
    return I18N.get("en", {}).get(key, key)

# Professional Athletics Metrics
def get_athlete_metrics():
    config_path = "run_page/settings.yaml"
    if not os.path.exists(config_path) or os.path.isdir(config_path):
        return {
            "max_hr": 190,
            "resting_hr": 60,
            "zones": {
                "zone1": {"from": 95, "to": 114},
                "zone2": {"from": 114, "to": 133},
                "zone3": {"from": 133, "to": 152},
                "zone4": {"from": 152, "to": 171},
                "zone5": {"from": 171, "to": 190}
            },
            "vo2_estimate": 45.0,
            "analysis": {
                "calorie_factors": {"run": 1.036, "ride": 0.5, "default": 0.8},
                "gap_factor": 6.0,
                "gear_warning_threshold": 0.9,
                "training_load": {"ctl_days": 42, "atl_days": 7, "trimp_fallbacks": {"run": 8.0, "ride": 2.0}},
                "tsb_advice": {"peak": 10, "fresh": 0, "optimal": -10, "productive_fatigue": -25},
                "radar_normalization": {
                    "endurance_monthly_km": 150, "climb_monthly_m": 1500, "frequency_monthly_sessions": 16, "long_run_km": 25, "speed_pace_min_km": 4.0
                },
                "milestones": {},
                "bins": {},
                "device_mapping": {}
            }
        }
        
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
    
    athlete = config.get("athlete", {})
    birthday = athlete.get("birthday", "1990-01-01")
    try:
        birth_date = datetime.strptime(birthday, "%Y-%m-%d")
        age = datetime.now().year - birth_date.year
    except:
        age = 30
    
    # Max HR
    max_hr = athlete.get("max_hr", 0)
    if not max_hr or max_hr == 0:
        formula = athlete.get("max_hr_formula", "fox")
        if formula == "fox":
            max_hr = 220 - age
        elif formula == "tanaka":
            max_hr = 208 - (0.7 * age)
        elif formula == "gellish":
            max_hr = 192 - (0.007 * (age ** 2))
        else:
            max_hr = 220 - age
            
    # Zones
    hr_zones = athlete.get("hr_zones", {})
    mode = hr_zones.get("mode", "relative")
    zones_def = hr_zones.get("default", {})
    
    calculated_zones = {}
    for z_name, range_def in zones_def.items():
        if mode == "relative":
            z_from = int(max_hr * (range_def["from"] / 100))
            z_to = int(max_hr * (range_def["to"] / 100)) if range_def["to"] else None
        else:
            z_from = range_def["from"]
            z_to = range_def["to"]
        calculated_zones[z_name] = {"from": z_from, "to": z_to}
        
    # VO2 Max (estimated from HR: 15.3 * (max_hr / resting_hr))
    resting_hr = athlete.get("resting_hr", 60)
    vo2_hr = 15.3 * (max_hr / resting_hr)
    
    analysis = config.get("analysis", {})
    
    return {
        "gender": athlete.get("gender", "male"),
        "age": age,
        "max_hr": int(max_hr),
        "resting_hr": resting_hr,
        "weight": athlete.get("weight", 70),
        "zones": calculated_zones,
        "vo2_estimate": round(vo2_hr, 1),
        "riegel_exponents": athlete.get("riegel_exponents", {"run": 1.06, "ride": 1.05}),
        "gears": athlete.get("gears", []),
        "annual_distance_target": athlete.get("annual_distance_target", 2000),
        "monthly_elevation_target": athlete.get("monthly_elevation_target", 1000),
        "weekly_frequency_target": athlete.get("weekly_frequency_target", 5),
        "analysis": {
            "calorie_factors": analysis.get("calorie_factors", {"run": 1.036, "ride": 0.5, "default": 0.8}),
            "gap_factor": analysis.get("gap_factor", 6.0),
            "gear_warning_threshold": analysis.get("gear_warning_threshold", 0.9),
            "training_load": analysis.get("training_load", {"ctl_days": 42, "atl_days": 7, "trimp_fallbacks": {"run": 8.0, "ride": 2.0}}),
            "tsb_advice": analysis.get("tsb_advice", {"peak": 10, "fresh": 0, "optimal": -10, "productive_fatigue": -25}),
            "radar_normalization": analysis.get("radar_normalization", {
                "endurance_monthly_km": 150, "climb_monthly_m": 1500, "frequency_monthly_sessions": 16, "long_run_km": 25, "speed_pace_min_km": 4.0
            }),
            "milestones": analysis.get("milestones", {}),
            "bins": analysis.get("bins", {}),
            "device_mapping": analysis.get("device_mapping", {})
        }
    }

# Aggregated stats and heatmap logic
def get_db_conn():
    db_path = os.environ.get("DB_PATH", "run_page/data.db")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    # Auto-initialize if it's a new environment or empty file
    if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
        from run_page.db import init_db
        init_db(db_path)
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/", response_class=HTMLResponse)
def read_root():
    # Serve the dashboard index.html if it exists (for production/docker)
    index_path = os.path.join("run_page", "static", "dashboard", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "TrackRecord Public Data API", "status": "online"}

@app.get("/api/v1/stats")
def get_sports_stats(sport_type: Optional[str] = Query(None)):
    """Comprehensive sports statistics for the public dashboard."""
    # Define type mappings
    RIDE_TYPES = ['Ride', 'VirtualRide', 'Velomobile', 'E-BikeRide']
    RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']
    
    # Determine active types based on param
    if sport_type == "Ride":
        active_types = RIDE_TYPES
        is_run_active = False
        is_ride_active = True
    elif sport_type == "Run":
        active_types = RUN_TYPES
        is_run_active = True
        is_ride_active = False
    else:
        active_types = RIDE_TYPES + RUN_TYPES # Default to both for now (backward compat)
        is_run_active = True
        is_ride_active = True
    
    placeholders = ','.join(['?'] * len(active_types))
    filter_sql = f"type IN ({placeholders})"
    
    try:
        conn = get_db_conn()
        if not conn:
            return {"total_distance": 0, "total_count": 0, "recent_activities": [], "heatmap": {}, "yearly": {}}
        
        cur = conn.cursor()
        athlete_metrics = get_athlete_metrics()
        
        # 1. Basic Aggregates
        cur.execute(f"SELECT COUNT(*) as count, SUM(distance) as dist FROM activities WHERE {filter_sql}", (*active_types,))
        agg = cur.fetchone()
        
        # 2. Tracks and Recent Activities (Top 50 for map/heatmap)
        cur.execute(f"""
            SELECT run_id, name, distance, moving_time, type, start_date_local, summary_polyline, 
                   average_heartrate, max_speed, location_country, location_city, commute, workout_type,
                   elevation_gain, average_cadence, average_watts
            FROM activities 
            WHERE {filter_sql}
            ORDER BY start_date_local DESC 
            LIMIT 2000
        """, (*active_types,))
        recent = []
        for row in cur.fetchall():
            d = dict(row)
            if d["moving_time"] and " " in d["moving_time"]:
                d["moving_time_display"] = d["moving_time"].split(" ")[1].split(".")[0]
            else:
                d["moving_time_display"] = d["moving_time"]
            
            # Pace/Speed Calculation for Recent Activities
            if d["distance"] > 0:
                t_str = d["moving_time"]
                t_only = t_str.split(" ")[1] if " " in t_str else t_str
                try:
                    h, m, s = map(float, t_only.split(":"))
                    total_sec = h * 3600 + m * 60 + s
                    
                    if total_sec > 0:
                        dist_km = d["distance"] / 1000.0
                        if d["type"] in ["Run", "VirtualRun", "TrailRun"]:
                            # Pace: min/km
                            pace_min_km = (total_sec / 60.0) / dist_km
                            pm = int(pace_min_km // 1)
                            ps = int((pace_min_km % 1) * 60)
                            d["gap_pace"] = f"{pm}:{ps:02d}/km"
                        elif d["type"] in ["Ride", "VirtualRide", "Velomobile", "E-BikeRide"]:
                            # Speed: km/h
                            speed_kmh = dist_km / (total_sec / 3600.0)
                            d["gap_pace"] = f"{round(speed_kmh, 1)} km/h"
                except:
                    pass
            
            # Calorie Calculation for Recent Activities
            d_km = (d["distance"] or 0) / 1000.0
            weight = athlete_metrics.get("weight", 70)
            cal_factors = athlete_metrics["analysis"]["calorie_factors"]
            if d["type"] in ["Run", "TrailRun", "VirtualRun"]:
                d["calories"] = int(d_km * weight * cal_factors.get("run", 1.036))
            elif d["type"] in ["Ride", "VirtualRide", "Velomobile"]:
                d["calories"] = int(d_km * weight * cal_factors.get("ride", 0.5))
            else:
                d["calories"] = int(d_km * weight * cal_factors.get("default", 0.8))
            
            recent.append(d)
        
        # 3. Yearly Aggregates
        cur.execute(f"""
            SELECT strftime('%Y', start_date_local) as year, 
                   COUNT(*) as count, 
                   SUM(distance) as dist 
            FROM activities 
            WHERE {filter_sql}
            GROUP BY year 
            ORDER BY year DESC
        """, (*active_types,))
        yearly = {row["year"]: {"count": row["count"], "distance": row["dist"] / 1000.0} for row in cur.fetchall()}
        
        # 4. Heatmap Data (Multi-metric per day for the last 365 days)
        cur.execute(f"""
            SELECT date(start_date_local) as date, 
                   type,
                   distance,
                   moving_time,
                   elevation_gain
            FROM activities 
            WHERE start_date_local > date('now', '-1 year')
            AND {filter_sql}
        """, (*active_types,))
        heatmap_rows = cur.fetchall()
        weight = athlete_metrics.get("weight", 70)
        heatmap_data = {}
        for r in heatmap_rows:
            d = r["date"]
            if d not in heatmap_data:
                heatmap_data[d] = {"count": 0, "dist": 0, "time": 0, "elev": 0, "cal": 0}
            
            heatmap_data[d]["count"] += 1
            heatmap_data[d]["dist"] += (r["distance"] or 0) / 1000.0
            heatmap_data[d]["time"] += row_to_seconds(r["moving_time"]) / 3600.0
            heatmap_data[d]["elev"] += r["elevation_gain"] or 0
            
            # Calorie formula
            d_km = (r["distance"] or 0) / 1000.0
            if r["type"] in ['Run', 'TrailRun', 'VirtualRun']:
                heatmap_data[d]["cal"] += d_km * weight * 1.036
            else:
                heatmap_data[d]["cal"] += d_km * weight * 0.5
        
        # Round values for clean JSON
        for d in heatmap_data:
            heatmap_data[d]["dist"] = round(heatmap_data[d]["dist"], 2)
            heatmap_data[d]["time"] = round(heatmap_data[d]["time"], 2)
            heatmap_data[d]["elev"] = round(heatmap_data[d]["elev"], 1)
            heatmap_data[d]["cal"] = round(heatmap_data[d]["cal"], 0)
            
        heatmap = heatmap_data
        
        # heatmap = {row["date"]: row["count"] for row in cur.fetchall()}
        
        # 5. Professional Analytics Enhancements
        # Monthly Trends for the last 12 months (Dynamic range)
        monthly_data = []
        import datetime
        today = datetime.date.today()
        for i in range(11, -1, -1):
            # Calculate year and month for the target month
            y = today.year
            m = today.month - i
            while m <= 0:
                m += 12
                y -= 1
            
            m_key = f"{y}-{m:02d}"
            cur.execute(f"""
                SELECT SUM(distance) as dist, COUNT(*) as count 
                FROM activities 
                WHERE strftime('%Y-%m', start_date_local) = ?
                AND {filter_sql}
            """, (m_key, *active_types))
            row = cur.fetchone()
            
            monthly_data.append({
                "month": datetime.date(y, m, 1).strftime("%b %Y"),
                "total_dist": round((row["dist"] or 0) / 1000.0, 1),
                "count": row["count"] or 0
            })
        monthly_trends = monthly_data

        # Weekly Trends for the last 12 weeks (Continuous)
        weekly_data = []
        # Start from the Monday of the current week
        current_monday = today - datetime.timedelta(days=today.weekday())
        for i in range(11, -1, -1):
            week_start = current_monday - datetime.timedelta(weeks=i)
            week_end = week_start + datetime.timedelta(days=6)
            
            cur.execute(f"""
                SELECT SUM(distance) as dist, COUNT(*) as count 
                FROM activities 
                WHERE date(start_date_local) >= ? AND date(start_date_local) <= ?
                AND {filter_sql}
            """, (str(week_start), str(week_end), *active_types))
            row = cur.fetchone()
            
            weekly_data.append({
                "week": week_start.strftime("%b %d"),
                "total_dist": round((row["dist"] or 0) / 1000.0, 1),
                "count": row["count"] or 0
            })
        weekly_trends = weekly_data

        # Breakdown by Sport Type
        cur.execute("""
            SELECT type, 
                   COUNT(*) as count, 
                   SUM(distance) as dist 
            FROM activities 
            GROUP BY type
        """)
        breakdown = {row["type"]: dict(row) for row in cur.fetchall()}

        # 5.5 Records (Best Efforts)
        records = {}
        # Best Efforts (distances for Run and Ride from settings)
        ms_config = athlete_metrics["analysis"]["milestones"]
        record_configs = []

        if is_run_active:
            for ms in ms_config.get("run", []):
                record_configs.append((ms["name"], ms["distance"], ['Run', 'TrailRun', 'VirtualRun']))
        if is_ride_active:
            for ms in ms_config.get("ride", []):
                record_configs.append((ms["name"], ms["distance"], ['Ride', 'VirtualRide', 'Velomobile']))
            
        if not record_configs: # Fallback
            if is_run_active or not is_ride_active:
                record_configs += [
                    ("5K", 5000, ['Run', 'TrailRun', 'VirtualRun']),
                    ("10K", 10000, ['Run', 'TrailRun', 'VirtualRun']),
                    ("Half Marathon", 21097, ['Run', 'TrailRun', 'VirtualRun']),
                    ("Marathon", 42195, ['Run', 'TrailRun', 'VirtualRun']),
                ]
            if is_ride_active:
                record_configs += [
                    ("30K Ride", 30000, ['Ride', 'VirtualRide', 'Velomobile']),
                    ("50K Ride", 50000, ['Ride', 'VirtualRide', 'Velomobile']),
                    ("80K Ride", 80000, ['Ride', 'VirtualRide', 'Velomobile']),
                    ("100K Ride", 100000, ['Ride', 'VirtualRide', 'Velomobile']),
                    ("150K Ride", 150000, ['Ride', 'VirtualRide', 'Velomobile']),
                ]
        
        for name, dist_m, types in record_configs:
            placeholder = ', '.join(['?'] * len(types))
            cur.execute(f"""
                SELECT run_id, name, distance, moving_time, start_date_local,
                       average_heartrate, average_cadence, average_watts, elevation_gain,
                       strftime('%H:%M:%S', moving_time) as moving_time_display
                FROM activities 
                WHERE type IN ({placeholder}) AND distance BETWEEN ? AND ? 
                ORDER BY (strftime('%H', moving_time) * 3600 + strftime('%M', moving_time) * 60 + strftime('%S', moving_time)) ASC
                LIMIT 1
            """, (*types, dist_m * 0.9, dist_m * 1.1))
            row = cur.fetchone()
            if row:
                d = dict(row)
                d["moving_time"] = d["moving_time_display"]
                # Calculate Pace
                sec = row_to_seconds(d["moving_time"])
                if sec > 0:
                    pace_min_km = (sec / 60.0) / (d["distance"] / 1000.0)
                    pm = int(pace_min_km // 1)
                    ps = int((pace_min_km % 1) * 60)
                    d["pace"] = f"{pm}:{ps:02d}/km" if "Ride" not in name else f"{round(3600.0/sec * (d['distance']/1000.0), 1)} km/h"
                records[name] = d

        # Cycling Specific: FTP Estimate (Functional Threshold Power)
        athlete_metrics["ftp_estimate"] = 0
        if is_ride_active:
            cur.execute("""
                SELECT MAX(average_watts) FROM activities 
                WHERE type IN ('Ride', 'VirtualRide', 'Velomobile') AND distance > 15000
            """)
            best_avg_power = cur.fetchone()[0] or 0
            athlete_metrics["ftp_estimate"] = int(best_avg_power * 0.95)

        # Running Specific: Threshold Pace Estimate
        athlete_metrics["threshold_pace"] = "--"
        if is_run_active:
            cur.execute("""
                SELECT MIN(strftime('%H', moving_time) * 3600 + strftime('%M', moving_time) * 60 + strftime('%S', moving_time)) 
                FROM activities 
                WHERE type IN ('Run', 'TrailRun', 'VirtualRun') AND distance BETWEEN 9500 AND 10500
            """)
            best_10k_sec = cur.fetchone()[0]
            if best_10k_sec:
                # T-Pace ≈ 10K pace (very rough estimate)
                t_pace_sec = best_10k_sec / 10.0
                pm = int(t_pace_sec // 60)
                ps = int(t_pace_sec % 60)
                athlete_metrics["threshold_pace"] = f"{pm}:{ps:02d}"

        # 5.6 Best Efforts Trends (Historical Performance)
        records_trends = {}
        trend_configs = record_configs # Reuse the same milestones
        
        for name, dist_m, types in trend_configs:
            placeholder = ', '.join(['?'] * len(types))
            cur.execute(f"""
                SELECT run_id, date(start_date_local) as date,
                       CAST(strftime('%s', moving_time) as integer) as seconds,
                       average_heartrate, average_watts
                FROM activities 
                WHERE type IN ({placeholder}) AND distance BETWEEN ? AND ? 
                ORDER BY date ASC
            """, (*types, dist_m * 0.95, dist_m * 1.1)) # Slightly wider tolerance for trends
            trends_data = [dict(row) for row in cur.fetchall()]
            if trends_data:
                records_trends[name] = trends_data

        # 5.7 Peak Performance & Yearly Breakthroughs
        peak_performance = {
            "cycling": {"max_avg_power": 0, "max_speed": 0, "max_elevation": 0},
            "running": {"max_speed": 0, "max_cadence": 0, "max_dist": 0},
            "milestones": {"pbs_this_year": 0, "total_records": len(records)}
        }
        
        # Yearly Breakthrough count (records achieved in current year)
        current_year = dt.datetime.now().year
        for r_name, r_data in records.items():
            if str(current_year) in r_data.get("start_date_local", ""):
                peak_performance["milestones"]["pbs_this_year"] += 1

        # Peak Cycling Metrics
        cur.execute("""
            SELECT MAX(average_watts), MAX(max_speed) * 3.6, MAX(elevation_gain)
            FROM activities WHERE type IN ('Ride', 'VirtualRide', 'Velomobile')
        """)
        c_row = cur.fetchone()
        if c_row:
            peak_performance["cycling"]["max_avg_power"] = int(c_row[0] or 0)
            peak_performance["cycling"]["max_speed"] = round(c_row[1] or 0, 1)
            peak_performance["cycling"]["max_elevation"] = int(c_row[2] or 0)

        # Peak Running Metrics
        cur.execute("""
            SELECT MAX(max_speed) * 3.6, MAX(average_cadence), MAX(distance) / 1000.0
            FROM activities WHERE type IN ('Run', 'TrailRun', 'VirtualRun')
        """)
        r_row = cur.fetchone()
        if r_row:
            peak_performance["running"]["max_speed"] = round(r_row[0] or 0, 1)
            peak_performance["running"]["max_cadence"] = int(r_row[1] or 0)
            peak_performance["running"]["max_dist"] = round(r_row[2] or 0, 1)

        athlete_metrics["peak_performance"] = peak_performance

        # 5.7 Daily Details (for heatmap & monthly drill-down)
        cur.execute(f"""
            SELECT date(start_date_local) as date,
                   SUM(distance) as dist,
                   SUM(moving_time) as time,
                   COALESCE(SUM(elevation_gain), 0) as elev,
                   COUNT(*) as count,
                   type
            FROM activities
            WHERE {filter_sql}
            GROUP BY date, type
            ORDER BY date ASC
        """, (*active_types,))
        daily_stats = [dict(row) for row in cur.fetchall()]

        # 5.7b Curated Records for Dashboard Summary - REFRESHED LOGIC
        dashboard_records = []
        priority_run = ["5K", "10K", "Half Marathon", "Marathon"]
        priority_ride = ["30K Ride", "50K Ride", "80K Ride", "100K Ride", "150K Ride"]
        
        # Determine which priorities to use
        if sport_type == "Run":
            active_priorities = priority_run
        elif sport_type == "Ride":
            active_priorities = priority_ride
        else:
            active_priorities = priority_run + priority_ride
            
        for name in active_priorities:
            if name in records:
                rec = records[name]
                dashboard_records.append({
                    "name": name,
                    "best": rec["moving_time"],
                    "pace": rec.get("pace", "-"), 
                    "date": rec["start_date_local"].split(' ')[0],
                    "activity": rec["name"]
                })

        # 5.8 Trophy Counts per month
        cur.execute("SELECT month FROM trophies")
        trophy_months = cur.fetchall()
        # Convert "Mar 2026" to "2026-03"
        month_map_names = {
            "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
            "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
            "January": "01", "February": "02", "March": "03", "April": "04", "May": "05", "June": "06",
            "July": "07", "August": "08", "September": "09", "October": "10", "November": "11", "December": "12"
        }
        trophies_by_month = {}
        for row in trophy_months:
            m_str = row["month"] # e.g. "Mar 2026"
            try:
                parts = m_str.split(" ")
                if len(parts) == 2:
                    m_key = f"{parts[1]}-{month_map_names.get(parts[0], '01')}"
                    trophies_by_month[m_key] = trophies_by_month.get(m_key, 0) + 1
            except:
                pass
        # Definition: Maximum integer E such that you have at least E days with >= E km.
        def calculate_eddington_detailed(sport_types):
            placeholder = ', '.join(['?'] * len(sport_types))
            cur.execute(f"""
                SELECT CAST(SUM(distance)/1000 AS INTEGER) as daily_dist
                FROM activities
                WHERE type IN ({placeholder})
                GROUP BY date(start_date_local)
                ORDER BY daily_dist DESC
            """, sport_types)
            distances = [row["daily_dist"] for row in cur.fetchall()]
            
            e_num = 0
            for i, d in enumerate(distances):
                if d >= i + 1:
                    e_num = i + 1
                else:
                    break
            
            # Gap to next: how many days of (e_num + 1) km are currently in the data
            current_next_days = sum(1 for d in distances if d >= e_num + 1)
            days_needed = (e_num + 1) - current_next_days
            
            # Chart data: distribution of days by distance
            # We want: for each distance X, how many days >= X
            chart_data = []
            if distances:
                max_dist = max(distances)
                for d_val in range(1, max_dist + 2):
                    count = sum(1 for d in distances if d >= d_val)
                    chart_data.append({"km": d_val, "days": count, "threshold": d_val})
            
            return {
                "value": e_num,
                "next_gap": days_needed,
                "chart_data": chart_data[:100] # Limit for performance
            }

        # Group related types together
        eddington_run = calculate_eddington_detailed(['Run', 'VirtualRun', 'TrailRun'])
        eddington_ride = calculate_eddington_detailed(['Ride', 'VirtualRide', 'Velomobile'])

        # 7. YoY Cumulative Stats (Distance, Time, Elevation)
        cur.execute(f"""
            SELECT strftime('%Y', start_date_local) as year,
                   CAST(strftime('%j', start_date_local) AS INTEGER) as day_of_year,
                   SUM(distance) as daily_dist,
                   SUM(moving_time) as daily_time,
                   SUM(elevation_gain) as daily_elev
            FROM activities
            WHERE {filter_sql}
            GROUP BY year, day_of_year
            ORDER BY year ASC, day_of_year ASC
        """, (*active_types,))
        yoy_raw = cur.fetchall()
        
        # Organize data into a map: year -> day -> stats
        yoy_map = {}
        all_years = []
        for r in yoy_raw:
            yr = r["year"]
            if yr not in yoy_map:
                yoy_map[yr] = {}
                all_years.append(yr)
            yoy_map[yr][r["day_of_year"]] = {
                "dist": r["daily_dist"] / 1000.0,
                "time": row_to_seconds(r["daily_time"]) / 3600.0,
                "elev": r["daily_elev"] or 0
            }
        
        # Build the final cumulative series
        yoy_cumulative = []
        current_totals = {yr: {"dist": 0, "time": 0, "elev": 0} for yr in all_years}
        
        for day in range(1, 367):
            day_data = {"day": day}
            for yr in all_years:
                stats_val = yoy_map.get(yr, {}).get(day, {"dist": 0, "time": 0, "elev": 0})
                current_totals[yr]["dist"] += stats_val["dist"]
                current_totals[yr]["time"] += stats_val["time"]
                current_totals[yr]["elev"] += stats_val["elev"]
                
                day_data[f"{yr}_dist"] = round(current_totals[yr]["dist"], 2)
                day_data[f"{yr}_time"] = round(current_totals[yr]["time"], 2)
                day_data[f"{yr}_elev"] = round(current_totals[yr]["elev"], 1)
            
            # Sampling: Take every 5th day + month starts + the very last day
            month_starts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
            if day % 5 == 0 or day in month_starts or day == 365 or day == 366:
                yoy_cumulative.append(day_data)

        # 8. Training Load (CTL/ATL/TSB) Calculation (TRIMP Based)
        # Fetch individual activities for the last 200 days to ensure stable CTL at start of 90-day chart
        cur.execute(f"""
            SELECT date(start_date_local) as date,
                   distance as dist,
                   average_heartrate as hr,
                   moving_time as time,
                   type
            FROM activities
            WHERE start_date_local > date('now', '-200 days')
            AND {filter_sql}
            ORDER BY start_date_local ASC
        """, (*active_types,))
        activities_for_load = cur.fetchall()
        
        # Group by date and calculate TRIMP for each activity
        daily_stress = {}
        max_hr = athlete_metrics.get("max_hr", 190)
        rest_hr = athlete_metrics.get("resting_hr", 60)
        hr_range = max_hr - rest_hr if max_hr > rest_hr else 100
        
        import math
        for act in activities_for_load:
            d = act["date"]
            
            # Parse time string to seconds
            t_str = act["time"]
            t_only = t_str.split(" ")[1] if " " in t_str else t_str
            t_parts = t_only.split(":")
            # Support both HH:MM:SS and MM:SS or even just SS
            try:
                if len(t_parts) == 3:
                    total_sec = int(float(t_parts[0])) * 3600 + int(float(t_parts[1])) * 60 + float(t_parts[2])
                elif len(t_parts) == 2:
                    total_sec = int(float(t_parts[0])) * 60 + float(t_parts[1])
                else:
                    total_sec = float(t_parts[0])
            except (ValueError, IndexError):
                total_sec = 0

            # TRIMP Calculation (Bannister's Formula)
            # TRIMP = duration (min) * DeltaHR * 0.64 * e^(1.92 * DeltaHR)
            stress = 0
            duration_min = total_sec / 60.0
            
            if act["hr"] and act["hr"] > rest_hr:
                avg_hr = act["hr"]
                hr_reserve_fraction = (avg_hr - rest_hr) / hr_range
                # Using 1.92 for Generic TRIMP (males), 1.67 for females. 
                gender = athlete_metrics.get("gender", "male")
                x_factor = 1.92 if gender == "male" else 1.67
                y_factor = 0.64 * math.exp(x_factor * hr_reserve_fraction)
                stress = duration_min * hr_reserve_fraction * y_factor
            else:
                # Fallback: Estimated Stress (roughly 1 TSS per km for run, 0.3 for ride)
                fallbacks = athlete_metrics["analysis"]["training_load"]["trimp_fallbacks"]
                if act["type"] in ["Run", "VirtualRun", "TrailRun"]:
                    stress = (act["dist"] / 1000.0) * fallbacks.get("run", 8.0)
                else: 
                    stress = (act["dist"] / 1000.0) * fallbacks.get("ride", 2.0)
            
            daily_stress[d] = daily_stress.get(d, 0) + stress
            
        training_series = []
        ctl, atl = 0, 0
        import datetime
        start_date = datetime.date.today() - datetime.timedelta(days=179)
        
        for i in range(180):
            curr_date_obj = (start_date + datetime.timedelta(days=i))
            curr_date = curr_date_obj.isoformat()
            stress = daily_stress.get(curr_date, 0)
            
            # Exponential Moving Averages (CTL: 42 days, ATL: 7 days - configured in settings)
            tl_conf = athlete_metrics["analysis"]["training_load"]
            ctl_decay = 1.0 / tl_conf.get("ctl_days", 42)
            atl_decay = 1.0 / tl_conf.get("atl_days", 7)
            
            ctl = ctl + (stress - ctl) * ctl_decay
            atl = atl + (stress - atl) * atl_decay
            
            if i >= 90: # Only return the last 90 days for the chart
                training_series.append({
                    "date": curr_date,
                    "ctl": round(ctl, 2),
                    "atl": round(atl, 2),
                    "tsb": round(ctl - atl, 2)
                })

        # --- Enhanced Metrics for Detail Panel ---
        # 8.1 A:C Ratio (Acute:Chronic workload ratio)
        ac_ratio = atl / (ctl if ctl > 0 else 1)
        
        # 8.2 Monotony (Last 7 days stress variety)
        last_7_days_stress = [daily_stress.get((datetime.date.today() - datetime.timedelta(days=i)).isoformat(), 0) for i in range(7)]
        avg_7d_stress = sum(last_7_days_stress) / 7.0
        variance = sum((s - avg_7d_stress)**2 for s in last_7_days_stress) / 7.0
        std_dev = math.sqrt(variance)
        monotony = avg_7d_stress / std_dev if std_dev > 0 else 0
        
        # 8.3 Recovery Forecast (Predict future status if resting)
        forecast = []
        f_ctl, f_atl = ctl, atl
        for i in range(1, 8):
            # Stress = 0 during rest days
            f_ctl = f_ctl + (0 - f_ctl) * (1.0 / 42.0)
            f_atl = f_atl + (0 - f_atl) * (1.0 / 7.0)
            forecast.append({
                "date": (datetime.date.today() + datetime.timedelta(days=i)).isoformat(),
                "ctl": round(f_ctl, 2),
                "atl": round(f_atl, 2),
                "tsb": round(f_ctl - f_atl, 2),
                "ac_ratio": round(f_atl / (f_ctl if f_ctl > 0 else 1), 2)
            })

        # Calculate rest days in past 7 days
        rest_days_7d = sum(1 for s in last_7_days_stress if s < 1) # < 1 TRIMP counts as rest
        
        # Add to smart_coach or separate object? Let's add to smart_coach
        training_details = {
            "ac_ratio": round(ac_ratio, 2),
            "monotony": round(monotony, 2),
            "forecast": forecast,
            "rest_days_7d": rest_days_7d,
            "weekly_stress": round(sum(last_7_days_stress), 1),
            "ctl": round(ctl, 1),
            "atl": round(atl, 1),
            "tsb": round(ctl - atl, 1)
        }

        # 9. Heart Rate Zones Distribution (Dynamic based on settings.yaml)
        cur.execute(f"SELECT average_heartrate as hr FROM activities WHERE average_heartrate > 0 AND {filter_sql}", (*active_types,))
        all_hr_data = cur.fetchall()
        
        zones_count = {
            "Z1 Recovery": 0,
            "Z2 Endurance": 0,
            "Z3 Tempo": 0,
            "Z4 Threshold": 0,
            "Z5 VO2 Max": 0
        }
        
        # Mapping our internal zone keys to labels
        zone_map = {
            "zone1": "Z1 Recovery",
            "zone2": "Z2 Endurance",
            "zone3": "Z3 Tempo",
            "zone4": "Z4 Threshold",
            "zone5": "Z5 VO2 Max"
        }
        
        athlete_zones = athlete_metrics.get("zones", {})
        for row in all_hr_data:
            hr = row["hr"]
            found = False
            for z_key, z_range in athlete_zones.items():
                z_from = z_range.get("from", 0)
                z_to = z_range.get("to", 999) or 999
                if z_from <= hr <= z_to:
                    label = zone_map.get(z_key)
                    if label:
                        zones_count[label] += 1
                        found = True
                        break
            if not found and hr > 0:
                # Fallback to highest zone if it exceeds max
                zones_count["Z5 VO2 Max"] += 1
                
        hr_zones = [{"zone": k, "count": v} for k, v in zones_count.items()]

        # 10. Power Distribution (Cycling focus)
        power_bins = athlete_metrics["analysis"]["bins"].get("power_ride", [])
        if power_bins:
            power_distribution = []
            for b in power_bins:
                cur.execute(f"SELECT COUNT(*) FROM activities WHERE average_watts BETWEEN ? AND ? AND {filter_sql}", (b["min"], b["max"], *active_types))
                power_distribution.append({"power_zone": b["label"], "count": cur.fetchone()[0]})
        else:
            cur.execute(f"""
                SELECT 
                    CASE 
                        WHEN average_watts < 150 THEN 'Low Intensity'
                        WHEN average_watts BETWEEN 150 AND 250 THEN 'Moderate'
                        ELSE 'High Intensity'
                    END as power_zone,
                    COUNT(*) as count
                FROM activities
                WHERE average_watts > 0 AND {filter_sql}
                GROUP BY power_zone
            """, (*active_types,))
            power_distribution = [dict(row) for row in cur.fetchall()]

        # 11. Period Comparison (This Year vs Last Year Monthly)
        cur.execute(f"""
            SELECT strftime('%m', start_date_local) as month,
                   strftime('%Y', start_date_local) as year,
                   SUM(distance) as dist
            FROM activities
            WHERE year IN (strftime('%Y', 'now'), strftime('%Y', 'now', '-1 year'))
            AND {filter_sql}
            GROUP BY year, month
            ORDER BY month ASC
        """, (*active_types,))
        period_raw = cur.fetchall()
        period_comparison = []
        this_year = str(datetime.date.today().year)
        last_year = str(datetime.date.today().year - 1)
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        for m_idx in range(1, 13):
            m_str = f"{m_idx:02d}"
            period_comparison.append({
                "month": months[m_idx-1],
                "this_year": round(sum(r["dist"] for r in period_raw if r["month"] == m_str and r["year"] == this_year) / 1000, 1),
                "last_year": round(sum(r["dist"] for r in period_raw if r["month"] == m_str and r["year"] == last_year) / 1000, 1)
            })

        # 11.5 Recent Form Pre-calculation
        today = datetime.date.today()
        seven_days_ago = today - datetime.timedelta(days=7)
        fourteen_days_ago = today - datetime.timedelta(days=14)
        
        # Calculate stress for this week and last week using daily_stress dictionary
        tw_stress = sum(daily_stress.get((seven_days_ago + datetime.timedelta(days=i)).isoformat(), 0) for i in range(7))
        lw_stress = sum(daily_stress.get((fourteen_days_ago + datetime.timedelta(days=i)).isoformat(), 0) for i in range(7))
        
        # Distance and count from DB
        cur.execute(f"""
            SELECT SUM(distance) as dist, COUNT(*) as count
            FROM activities 
            WHERE date(start_date_local) >= ? AND {filter_sql}
        """, (seven_days_ago.isoformat(), *active_types))
        tw_row = cur.fetchone()
        
        cur.execute(f"""
            SELECT SUM(distance) as dist, COUNT(*) as count
            FROM activities 
            WHERE date(start_date_local) >= ? AND date(start_date_local) < ? AND {filter_sql}
        """, (fourteen_days_ago.isoformat(), seven_days_ago.isoformat(), *active_types))
        lw_row = cur.fetchone()

        # Monthly Elevation Gain
        cur.execute(f"""
            SELECT SUM(elevation_gain) as elev
            FROM activities
            WHERE strftime('%Y-%m', start_date_local) = strftime('%Y-%m', 'now') AND {filter_sql}
        """, (*active_types,))
        mtd_row = cur.fetchone()
        mtd_elev = mtd_row["elev"] if mtd_row and mtd_row["elev"] else 0
        tw_count = tw_row["count"] or 0
        
        # Pull targets based on active mode
        if sport_type == "Run":
            target_dist = athlete_metrics.get("run_annual_distance_target", 1000)
            target_elev = athlete_metrics.get("run_monthly_elevation_target", 500)
            target_freq = athlete_metrics.get("run_weekly_frequency_target", 4)
        elif sport_type == "Ride":
            target_dist = athlete_metrics.get("ride_annual_distance_target", 5000)
            target_elev = athlete_metrics.get("ride_monthly_elevation_target", 3000)
            target_freq = athlete_metrics.get("ride_weekly_frequency_target", 3)
        else: # All/Combined
            target_dist = athlete_metrics.get("run_annual_distance_target", 1000) + athlete_metrics.get("ride_annual_distance_target", 5000)
            target_elev = athlete_metrics.get("run_monthly_elevation_target", 500) + athlete_metrics.get("ride_monthly_elevation_target", 3000)
            target_freq = max(athlete_metrics.get("run_weekly_frequency_target", 4), athlete_metrics.get("ride_weekly_frequency_target", 3))

        goals = [
            {"title": f"Annual Distance {this_year}", "target": target_dist, "current": round(yearly.get(this_year, {}).get("distance", 0), 1), "unit": "km"},
            {"title": "Monthly Elevation", "target": target_elev, "current": round(mtd_elev), "unit": "m"},
            {"title": "Activities per Week", "target": target_freq, "current": tw_count, "unit": "sessions"}
        ]

        # 13. Recent Form (Weekly comparison)
        # Calculate consistency bitmap for last 7 days
        consistency = []
        for i in range(7):
            d_str = (seven_days_ago + datetime.timedelta(days=i)).isoformat()
            has_activity = any(r["date"] == d_str for r in daily_stats)
            consistency.append(has_activity)

        recent_form = {
            "this_week": {
                "distance": round((tw_row["dist"] or 0) / 1000.0, 1),
                "stress": round(tw_stress, 1),
                "count": tw_count,
                "consistency": consistency
            },
            "last_week": {
                "distance": round((lw_row["dist"] or 0) / 1000.0, 1),
                "stress": round(lw_stress, 1),
                "count": lw_row["count"] or 0
            }
        }

        # 11. Athlete Metrics (Already fetched at start)

        # 15. Time & Weekday Preferences
        time_raw = cur.execute(f"""
            SELECT (CAST(strftime('%H', start_date_local) AS INTEGER) / 2) * 2 as slot,
                   COUNT(*) as count
            FROM activities
            WHERE {filter_sql}
            GROUP BY slot
            ORDER BY slot ASC
        """, (*active_types,)).fetchall()
        
        time_labels = {i: f"{i:02d}:00" for i in range(0, 24, 2)}
        time_preference = []
        for i in range(0, 24, 2):
            count = next((r["count"] for r in time_raw if r["slot"] == i), 0)
            time_preference.append({"slot": time_labels[i], "count": count})
        
        weekday_raw = cur.execute(f"""
            SELECT CAST(strftime('%w', start_date_local) AS INTEGER) as weekday,
                   COUNT(*) as count
            FROM activities
            WHERE {filter_sql}
            GROUP BY weekday
            ORDER BY weekday ASC
        """, (*active_types,)).fetchall()
        
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        weekday_preference = []
        for i in range(7):
            count = next((r["count"] for r in weekday_raw if r["weekday"] == i), 0)
            weekday_preference.append({"day": day_names[i], "count": count, "weekday": i})

        # 15.2 Activity Pattern Heatmap Matrix (Weekday vs Hour)
        pattern_raw = cur.execute(f"""
            SELECT CAST(strftime('%w', start_date_local) AS INTEGER) as weekday,
                   (CAST(strftime('%H', start_date_local) AS INTEGER) / 2) * 2 as slot,
                   COUNT(*) as count
            FROM activities
            WHERE {filter_sql}
            GROUP BY weekday, slot
        """, (*active_types,)).fetchall()
        
        activity_pattern = []
        for h in range(0, 24, 2):
            slot_name = f"{h:02d}:00"
            for d in range(7):
                count = next((r["count"] for r in pattern_raw if r["weekday"] == d and r["slot"] == h), 0)
                activity_pattern.append({
                    "day": d, 
                    "dayName": day_names[d],
                    "hour": h,
                    "hourName": slot_name,
                    "value": count
                })

        # 15.5 Distance Breakdown Histogram
        dist_raw = [r["dist"] / 1000.0 for r in cur.execute(f"SELECT distance as dist FROM activities WHERE {filter_sql}", (*active_types,)).fetchall()]
        
        bins_key = "distance_ride" if is_ride_active else "distance_run"
        dist_bins_config = athlete_metrics["analysis"]["bins"].get(bins_key, [])
        if dist_bins_config:
            distance_breakdown = []
            for b in dist_bins_config:
                count = sum(1 for d in dist_raw if b["min"] <= d < b["max"])
                distance_breakdown.append({"label": b["label"], "count": count})
        else:
            if is_ride_active:
                dist_bins = [
                    {"label": "0-30km", "min": 0, "max": 30, "count": 0},
                    {"label": "30-60km", "min": 30, "max": 60, "count": 0},
                    {"label": "60-100km", "min": 60, "max": 100, "count": 0},
                    {"label": "100-150km", "min": 100, "max": 150, "count": 0},
                    {"label": "150km+", "min": 150, "max": 99999, "count": 0},
                ]
            else:
                dist_bins = [
                    {"label": "0-5km", "min": 0, "max": 5, "count": 0},
                    {"label": "5-10km", "min": 5, "max": 10, "count": 0},
                    {"label": "10-21km", "min": 10, "max": 21, "count": 0},
                    {"label": "21-42km", "min": 21, "max": 42.2, "count": 0},
                    {"label": "42km+", "min": 42.2, "max": 99999, "count": 0},
                ]
            for d in dist_raw:
                for b in dist_bins:
                    if b["min"] <= d < b["max"]:
                        b["count"] += 1
                        break
            distance_breakdown = dist_bins

        # 16. Bio-Analytics (P3)
        athlete_weight = athlete_metrics.get("weight", 70)
        
        # 16.1 Cadence Distribution (Dynamic) - Sport Aware
        run_cadence_raw = cur.execute(f"""
            SELECT average_cadence FROM activities 
            WHERE type IN ('Run', 'VirtualRun', 'TrailRun') AND average_cadence > 0 AND {filter_sql}
        """, (*active_types,)).fetchall()
        
        ride_cadence_raw = cur.execute(f"""
            SELECT average_cadence FROM activities 
            WHERE type IN ('Ride', 'VirtualRide') AND average_cadence > 0 AND {filter_sql}
        """, (*active_types,)).fetchall()
        
        # Decide which cadence to show based on active mode
        if is_ride_active and not is_run_active:
             show_run_cadence = False
        elif is_run_active:
             show_run_cadence = True
        else:
             show_run_cadence = len(run_cadence_raw) >= len(ride_cadence_raw)
        
        if show_run_cadence:
            cadence_bins_config = athlete_metrics["analysis"]["bins"].get("cadence_run", [])
            if cadence_bins_config:
                cadence_bins = []
                for b in cadence_bins_config:
                    count = sum(1 for r in run_cadence_raw if b["min"] <= (r["average_cadence"] if r["average_cadence"] >= 120 else r["average_cadence"]*2) < b["max"])
                    cadence_bins.append({"label": b["label"], "count": count})
            else:
                cadence_bins = [
                    {"label": "<150", "min": 0, "max": 150, "count": 0},
                    {"label": "150-160", "min": 150, "max": 160, "count": 0},
                    {"label": "160-170", "min": 160, "max": 170, "count": 0},
                    {"label": "170-180", "min": 170, "max": 180, "count": 0},
                    {"label": "180-190", "min": 180, "max": 190, "count": 0},
                    {"label": "190+", "min": 190, "max": 999, "count": 0}
                ]
                for row in run_cadence_raw:
                    c = row["average_cadence"]
                    if c < 120: c = c * 2
                    for b in cadence_bins:
                        if b["min"] <= c < b["max"]:
                            b["count"] += 1
                            break
            cadence_type = "RUNNING (SPM)"
        else:
            cadence_bins_config = athlete_metrics["analysis"]["bins"].get("cadence_ride", [])
            if cadence_bins_config:
                cadence_bins = []
                for b in cadence_bins_config:
                    count = sum(1 for r in ride_cadence_raw if b["min"] <= r["average_cadence"] < b["max"])
                    cadence_bins.append({"label": b["label"], "count": count})
            else:
                cadence_bins = [
                    {"label": "<70", "min": 0, "max": 70, "count": 0},
                    {"label": "70-80", "min": 70, "max": 80, "count": 0},
                    {"label": "80-90", "min": 80, "max": 90, "count": 0},
                    {"label": "90-100", "min": 90, "max": 100, "count": 0},
                    {"label": "100-110", "min": 100, "max": 110, "count": 0},
                    {"label": "110+", "min": 110, "max": 999, "count": 0}
                ]
                for row in ride_cadence_raw:
                    c = row["average_cadence"]
                    for b in cadence_bins:
                        if b["min"] <= c < b["max"]:
                            b["count"] += 1
                            break
            cadence_type = "CYCLING (RPM)"
        
        # 16.2 Total Energy Output (Calories) & Steps
        cur.execute(f"SELECT average_cadence, moving_time, type FROM activities WHERE average_cadence > 0 AND {filter_sql}", (*active_types,))
        rows = cur.fetchall()
        total_steps = 0
        for r in rows:
            c = r["average_cadence"]
            if r["type"] in ["Run", "TrailRun", "VirtualRun"] and c < 120: c = c * 2
            sec = row_to_seconds(r["moving_time"])
            total_steps += (c * sec / 60.0)
            
        # 16.3 Estimated Calories
        total_calories = 0
        cur.execute(f"SELECT distance, type FROM activities WHERE {filter_sql}", (*active_types,))
        for row in cur.fetchall():
            d_km = row["distance"] / 1000.0
            if row["type"] in ["Run", "TrailRun", "VirtualRun"]:
                total_calories += d_km * athlete_weight * 1.036
            else:
                total_calories += d_km * athlete_weight * 0.5
        
        # 16.4 Cadence Trend
        cur.execute(f"SELECT AVG(average_cadence) as avg_c FROM activities WHERE average_cadence > 0 AND {filter_sql} AND date(start_date_local) >= date('now', '-30 days')", (*active_types,))
        recent_c = cur.fetchone()["avg_c"] or 0
        cur.execute(f"SELECT AVG(average_cadence) as avg_c FROM activities WHERE average_cadence > 0 AND {filter_sql} AND date(start_date_local) >= date('now', '-60 days') AND date(start_date_local) < date('now', '-30 days')", (*active_types,))
        prev_c = cur.fetchone()["avg_c"] or 0
        
        if sport_type == "Run" and recent_c < 120: recent_c *= 2
        if sport_type == "Run" and prev_c < 120: prev_c *= 2
        
        c_trend = round(((recent_c - prev_c) / prev_c * 100), 1) if prev_c > 0 else 0

        bio_stats = {
            "estimated_steps": int(total_steps),
            "total_calories": int(total_calories),
            "cadence_distribution": cadence_bins,
            "cadence_type": cadence_type,
            "weight": athlete_weight,
            "avg_cadence": round(recent_c, 1),
            "cadence_trend": c_trend
        }

        # 12. Dynamic Gear & Equipment Calculation
        gear_stats = []
        # Filter gears by selected sport type if global filter is active
        configured_gears = athlete_metrics.get("gears", [])
        if sport_type == "Ride":
            configured_gears = [g for g in configured_gears if g.get("type") == "Ride"]
        elif sport_type == "Run":
            configured_gears = [g for g in configured_gears if g.get("type") == "Run"]
            
        gear_alerts = []
        for g in configured_gears:
            g_name = g.get("name", "Unknown")
            g_type = g.get("type", "Run")
            g_limit = g.get("limit", 800)
            g_from = g.get("active_from", "2000-01-01")
            g_to = g.get("active_to", "2099-12-31")
            g_icon = g.get("icon", "Footprints")
            
            # Sub-types mapping
            type_map = {
                "Run": ["Run", "VirtualRun", "TrailRun"],
                "Ride": ["Ride", "VirtualRide", "Velomobile", "E-BikeRide"]
            }
            types = type_map.get(g_type, [g_type])
            
            placeholders = ','.join(['?'] * len(types))
            cur.execute(f"""
                SELECT SUM(distance) as dist, COUNT(*) as count, SUM(elevation_gain) as elev, SUM(moving_time) as time
                FROM activities 
                WHERE type IN ({placeholders}) 
                AND date(start_date_local) >= ? 
                AND date(start_date_local) <= ?
            """, (*types, g_from, g_to))
            g_row = cur.fetchone()
            
            total_dist_km = round((g_row["dist"] or 0) / 1000.0, 1)
            total_count = g_row["count"] or 0
            total_elev = round(g_row["elev"] or 0)
            
            # Handle time format
            total_sec = row_to_seconds(g_row["time"])
            days = total_sec // 86400
            hours = (total_sec % 86400) // 3600
            mins = (total_sec % 3600) // 60
            time_str = f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"
            
            # Check for gear-level alert
            if total_dist_km >= g_limit:
                gear_alerts.append(f"Your {g_name} has exceeded its {g_limit}km limit.")
            
            # Monthly distance for this specific gear
            cur.execute(f"""
                SELECT strftime('%Y-%m', start_date_local) as month, SUM(distance) as dist 
                FROM activities 
                WHERE type IN ({placeholders}) 
                AND date(start_date_local) >= ? 
                AND date(start_date_local) <= ?
                GROUP BY month
                ORDER BY month DESC
                LIMIT 6
            """, (*types, g_from, g_to))
            m_rows = cur.fetchall()
            monthly_dist = [{"month": r["month"], "dist": round((r["dist"] or 0) / 1000.0, 1)} for r in m_rows]
            monthly_dist.reverse()

            # Components
            g_components = []
            for comp in g.get("components", []):
                c_limit = comp.get("limit", 1000)
                c_dist = total_dist_km % c_limit if c_limit < g_limit else total_dist_km
                g_components.append({
                    "name": comp.get("name"),
                    "distance": round(c_dist, 1),
                    "limit": c_limit
                })
                if c_dist >= c_limit:
                    gear_alerts.append(f"Component '{comp.get('name')}' on {g_name} needs inspection/replacement.")
                
            gear_stats.append({
                "name": g_name,
                "type": g_type,
                "distance": total_dist_km,
                "count": total_count,
                "elevation": total_elev,
                "time": time_str,
                "limit": g_limit,
                "purchase_date": g.get("purchase_date"),
                "icon": g_icon,
                "components": g_components,
                "monthly_mileage": monthly_dist
            })

        # 14. Smart Coach Advice
        tsb = training_series[-1]["tsb"] if training_series else 0
        tsb_conf = athlete_metrics["analysis"]["tsb_advice"]
        
        if tsb > tsb_conf.get("peak", 10):
            advice = f"You are in peak {sport_type or ''} form! Perfect for a PB attempt."
        elif tsb > tsb_conf.get("fresh", 0):
            advice = "Feeling fresh. Ready for high-intensity intervals."
        elif tsb > tsb_conf.get("optimal", -10):
            advice = "Optimal training zone. Balancing load and recovery perfectly."
        elif tsb > tsb_conf.get("productive_fatigue", -25):
            advice = "Productive fatigue. You are building fitness, keep the consistency."
        else:
            advice = "High fatigue! Risk of overtraining. Take a rest day."
        
        # Append Gear Advice if any
        if gear_alerts:
            advice += " | ATTENTION: " + " ".join(gear_alerts[:2]) # Keep it concise
        
        smart_coach = {
            "advice": advice,
            "efficiency": round(ctl / (atl if atl > 0 else 1), 2),
            "status": "Peak" if tsb > 10 else ("Fresh" if tsb > 0 else ("Optimal" if tsb > -10 else "Fatigued"))
        }

        # 13. Recording Devices Calculation (Dynamic mapping from settings)
        recording_stats = []
        device_mapping = athlete_metrics["analysis"].get("device_mapping", {})
        
        # Build dynamic Case Statement
        case_parts = []
        for pattern, label in device_mapping.items():
            case_parts.append(f"WHEN name LIKE '%{pattern}%' THEN '{label}'")
        
        if not case_parts:
            case_stmt = """
                CASE 
                    WHEN name LIKE 'Zwift%' THEN 'Zwift'
                    WHEN type = 'VirtualRide' THEN 'Virtual Platform'
                    WHEN type = 'Ride' THEN 'Cycling Computer'
                    WHEN type = 'Run' THEN 'Running Watch'
                    ELSE 'Other App/Device'
                END
            """
        else:
            case_stmt = f"CASE {' '.join(case_parts)} ELSE 'Other Device' END"

        cur.execute(f"""
            SELECT 
                ({case_stmt}) as device,
                COUNT(*) as count,
                SUM(distance) as dist,
                SUM(elevation_gain) as elev,
                SUM(moving_time) as time
            FROM activities
            WHERE {filter_sql}
            GROUP BY device
            ORDER BY count DESC
        """, (*active_types,))
        recording_rows = cur.fetchall()
        for row in recording_rows:
            # moving_time in database is INTERVAL (which sqlite treats as numeric seconds usually if inserted that way)
            # or it might be string. Let's handle both.
            try:
                # If it's a string like '01:23:45', we need to parse. 
                # But in many of these schemas it's stored as seconds.
                val = row["time"]
                if isinstance(val, str) and ":" in val:
                    # simplistic parser for HH:MM:SS
                    parts = val.split(':')
                    total_sec = int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
                else:
                    total_sec = int(val or 0)
            except:
                total_sec = 0

            days = total_sec // 86400
            hours = (total_sec % 86400) // 3600
            mins = (total_sec % 3600) // 60
            time_str = f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"
            
            recording_stats.append({
                "name": row["device"],
                "count": row["count"],
                "distance": round((row["dist"] or 0) / 1000.0),
                "elevation": round(row["elev"] or 0),
                "time": time_str
            })

        # 16. Streak Calculation
        streak_dates = sorted(list(set(r["date"] for r in daily_stats)))
        cur_streak = 0
        max_streak = 0
        if streak_dates:
            today_str = dt.date.today().isoformat()
            yesterday_str = (dt.date.today() - dt.timedelta(days=1)).isoformat()
            
            # Check if current streak exists (today or yesterday active)
            if streak_dates[-1] == today_str or streak_dates[-1] == yesterday_str:
                temp_s = 1
                for i in range(len(streak_dates) - 1, 0, -1):
                    d1 = dt.datetime.strptime(streak_dates[i], "%Y-%m-%d").date()
                    d2 = dt.datetime.strptime(streak_dates[i-1], "%Y-%m-%d").date()
                    if (d1 - d2).days == 1:
                        temp_s += 1
                    else:
                        break
                cur_streak = temp_s
            
            # Max streak
            temp_s = 1
            for i in range(len(streak_dates) - 1):
                d1 = dt.datetime.strptime(streak_dates[i], "%Y-%m-%d").date()
                d2 = dt.datetime.strptime(streak_dates[i+1], "%Y-%m-%d").date()
                if (d2 - d1).days == 1:
                    temp_s += 1
                else:
                    max_streak = max(max_streak, temp_s)
                    temp_s = 1
            max_streak = max(max_streak, temp_s)

        # 17. Athlete Radar Chart Data
        last_30_days = (dt.date.today() - dt.timedelta(days=30)).isoformat()
        cur.execute(f"""
            SELECT 
                COUNT(*) as count, 
                SUM(distance) as dist, 
                SUM(elevation_gain) as elev,
                MAX(distance) as max_dist
            FROM activities 
            WHERE date(start_date_local) >= ? AND {filter_sql}
        """, (last_30_days, *active_types))
        r30 = cur.fetchone()
        
        # Normalization from settings
        radar_norm = athlete_metrics["analysis"]["radar_normalization"]
          # Custom Radar Thresholds based on Sport
        if is_ride_active:
            # Cycling thresholds (much higher volume)
            norm_dist = radar_norm.get("endurance_ride_monthly_km", 600)
            norm_long = radar_norm.get("long_ride_km", 100)
            norm_elev = radar_norm.get("climb_ride_monthly_m", 5000)
            
            # Speed for Cycling (km/h)
            best_speed = 0
            speed_rows = cur.execute(f"""
                SELECT moving_time, distance FROM activities 
                WHERE type IN ('Ride', 'VirtualRide', 'Velomobile') AND date(start_date_local) >= ? AND {filter_sql}
            """, (last_30_days, *active_types)).fetchall()
            for sr in speed_rows:
                sec = row_to_seconds(sr["moving_time"])
                if sec > 0:
                    kmh = (sr["distance"] / 1000.0) / (sec / 3600.0)
                    best_speed = max(best_speed, kmh)
            # 30 km/h = 75 score, 40 km/h = 100 score
            max_speed_score = max(20, min(100, int((best_speed / 40.0) * 100)))
        else:
            # Running specific thresholds
            norm_dist = radar_norm.get("endurance_run_monthly_km", radar_norm.get("endurance_monthly_km", 150))
            norm_long = radar_norm.get("long_run_km", 25)
            norm_elev = radar_norm.get("climb_run_monthly_m", radar_norm.get("climb_monthly_m", 1500))
            
            best_pace = 999
            speed_rows = cur.execute(f"""
                SELECT moving_time, distance FROM activities 
                WHERE type IN ('Run', 'TrailRun') AND date(start_date_local) >= ? AND {filter_sql}
            """, (last_30_days, *active_types)).fetchall()
            for sr in speed_rows:
                sec = row_to_seconds(sr["moving_time"])
                if sec > 0 and sr["distance"] > 0:
                    pace_min_km = (sec / 60.0) / (sr["distance"] / 1000.0)
                    best_pace = min(best_pace, pace_min_km)
            speed_base = radar_norm.get("speed_pace_min_km", 4.0)
            max_speed_score = max(20, min(100, int(100 - (best_pace - speed_base) * 25))) if best_pace < 999 else 50

        athlete_radar = [
            { "subject": "Endurance", "A": min(100, int((r30["dist"] or 0) / (norm_dist * 10))), "fullMark": 100 }, 
            { "subject": "Climb", "A": min(100, int((r30["elev"] or 0) / (norm_elev / 100))), "fullMark": 100 },      
            { "subject": "Frequency", "A": min(100, int((r30["count"] or 0) * (100/radar_norm.get("frequency_monthly_sessions", 16)))), "fullMark": 100 },  
            { "subject": "Distance", "A": min(100, int((r30["max_dist"] or 0) / (norm_long * 10))), "fullMark": 100 },
            { "subject": "Speed", "A": max_speed_score, "fullMark": 100 }
        ]

        # Final Return Object
        out_data = {
            "sport_type": sport_type or "All",
            "primary_metric": "Pace" if sport_type == "Run" else "Speed",
            "total_distance": (agg["dist"] or 0) / 1000.0,
            "total_count": agg["count"] or 0,
            "recent_activities": recent,
            "yearly": yearly,
            "heatmap": heatmap,
            "monthly_trends": monthly_trends,
            "breakdown": breakdown,
            "eddington": {
                "Run": eddington_run,
                "Ride": eddington_ride
            },
            "streaks": {
                "current": cur_streak,
                "max": max_streak
            },
            "yoy_cumulative": yoy_cumulative,
            "available_years": all_years,
            "weekly_trends": weekly_trends,
            "recent_form": recent_form,
            "smart_coach": smart_coach,
            "recording_stats": recording_stats,
            "training_series": training_series,
            "hr_zones": hr_zones,
            "power_distribution": power_distribution,
            "records": records,
            "gear_stats": gear_stats,
            "time_preference": time_preference,
            "weekday_preference": weekday_preference,
            "distance_breakdown": distance_breakdown,
            "training_load": training_series,
            "records_trends": records_trends,
            "daily_stats": daily_stats,
            "bio_stats": bio_stats,
            "trophies_by_month": trophies_by_month,
            "period_comparison": period_comparison,
            "goals": goals,
            "photos_count": cur.execute("SELECT COUNT(*) FROM photos").fetchone()[0] if conn else 0,
            "gear_count": len(gear_stats),
            "athlete_metrics": athlete_metrics,
            "athlete_profile": get_strava_athlete_cached(load_creds()),
            "athlete_radar": athlete_radar,
            "dashboard_records": dashboard_records,
            "training_details": training_details,
            "activity_pattern": activity_pattern
        }
        return out_data
        
    except sqlite3.OperationalError as e:
        print(f"[{dt_mod.datetime.now()}] Database operational error (likely missing table): {e}")
        return {"total_distance": 0, "total_count": 0, "recent_activities": [], "heatmap": {}, "yearly": {}}
    except Exception as e:
        import traceback
        print(f"[{dt_mod.datetime.now()}] Error in get_sports_stats: {e}")
        traceback.print_exc()
        return {"total_distance": 0, "total_count": 0, "recent_activities": [], "heatmap": {}, "yearly": {}}
    finally:
        if 'conn' in locals() and conn:
            conn.close()

@app.get("/api/v1/photos")
def get_activity_photos(background_tasks: BackgroundTasks, sport_type: Optional[str] = Query(None)):
    """Fetch photos from local DB, trigger background sync if empty, with sport filtering."""
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor()
        
        RIDE_TYPES = ['Ride', 'VirtualRide', 'Velomobile', 'E-BikeRide']
        RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']
        
        if sport_type == "Ride":
            active_types = RIDE_TYPES
        elif sport_type == "Run":
            active_types = RUN_TYPES
        else:
            active_types = RIDE_TYPES + RUN_TYPES
            
        placeholders = ','.join(['?'] * len(active_types))
        query = f"SELECT * FROM photos WHERE type IN ({placeholders}) ORDER BY date DESC LIMIT 500"
        
        cur.execute(query, (*active_types,))
        rows = cur.fetchall()
        
        if not rows and not sport_type: # Only sync if specifically no filters and empty
            background_tasks.add_task(sync_strava_photos)
            return []
            
        photos = []
        for r in rows:
            photos.append({
                "id": r["id"],
                "url": f"/static/photos/{os.path.basename(r['local_path'])}" if r["local_path"] else r["remote_url"],
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
    """Background task to download photos from Strava."""
    import datetime as dt_mod
    print(f"[{dt_mod.datetime.now()}] Starting photo sync (limit={limit})...")
    
    # Use get_credential to support both credentials.json and environment variables
    client_id = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")
    
    if not all([client_id, client_secret, refresh_token]):
        print(f"[{dt_mod.datetime.now()}] Missing Strava credentials (ID, Secret, or Refresh Token). Skipping photo sync.")
        return

    client = Client()
    try:
        print(f"[{dt_mod.datetime.now()}] Refreshing access token...")
        response = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token
        )
        client.access_token = response["access_token"]

        
        conn = get_db_conn()
        cur = conn.cursor()
        
        # Ensure static folder exists locally
        static_photos_dir = "run_page/static/photos"
        os.makedirs(static_photos_dir, exist_ok=True)
        
        activities = list(client.get_activities(limit=limit))
        print(f"[{dt_mod.datetime.now()}] Scanned {len(activities)} activities for photos.")
        
        photo_activities_count = 0
        for activity in activities:
            if getattr(activity, 'total_photo_count', 0) > 0:
                photo_activities_count += 1
                
                # Check DB for existing records
                cur.execute("SELECT local_path FROM photos WHERE activity_id = ?", (activity.id,))
                row = cur.fetchone()
                if row and row[0] and os.path.exists(row[0]):
                    # We have both the record and the file
                    continue
                
                print(f"Syncing photos for activity {activity.id} (Found {activity.total_photo_count} photos)")
                activity_photos = client.get_activity_photos(activity.id, only_instagram=False, size=800)
                for idx, photo in enumerate(activity_photos):
                    if hasattr(photo, 'urls') and photo.urls:
                        remote_url = photo.urls.get('800') or photo.urls.get('original') or list(photo.urls.values())[0]
                        
                        # Fix ID: Strava ActivityPhoto often has ID=None in public API results
                        # We use unique_id or a content-based fallback
                        photo_id = getattr(photo, 'unique_id', None) or f"{activity.id}_{idx}"
                        
                        # Download locally
                        local_name = f"{photo_id}.jpg"
                        local_path = f"run_page/static/photos/{local_name}"
                        
                        if not os.path.exists(local_path):
                            try:
                                print(f"  - Downloading photo {photo_id} from {remote_url[:50]}...")
                                r = requests.get(remote_url, timeout=15)
                                if r.status_code == 200:
                                    with open(local_path, "wb") as f:
                                        f.write(r.content)
                                    print(f"  - Successfully saved to {local_path}")
                                else:
                                    print(f"  - Download failed with status {r.status_code}")
                                    local_path = None
                            except Exception as e:
                                print(f"  - Download failed with error: {e}")
                                local_path = None
                        
                        # Save to DB
                        cur.execute("""
                            INSERT OR REPLACE INTO photos (id, activity_id, local_path, remote_url, title, date, type, location_country)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            str(photo_id), 
                            activity.id, 
                            local_path, 
                            remote_url, 
                            activity.name, 
                            str(activity.start_date_local).split(' ')[0], 
                            activity.type,
                            getattr(activity, 'location_country', '')
                        ))
        conn.commit()
        
        print(f"[{dt_mod.datetime.now()}] Photo sync finished. Found {photo_activities_count} activities with photos.")
    except Exception as e:
        print(f"[{dt_mod.datetime.now()}] Photo sync error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

@app.get("/api/v1/challenges")
def get_challenges_derived():
    """Derived 'Challenges' and real 'Clubs' from Strava."""
    creds = load_creds()
    clubs_data = get_strava_clubs_cached(creds)
    imported_trophies = get_imported_challenges_from_db()
    
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor()
        # 2. Add Club section if exists
        challenges = []
        if clubs_data:
            challenges.append({
                "month": "CLUBS & ORGANIZATIONS",
                "items": clubs_data
            })

        # 3. Look for milestones in the data
        cur.execute("""
            SELECT strftime('%Y-%m', start_date_local) as month,
                   SUM(distance) as total_dist,
                   MAX(distance) as max_dist,
                   type
            FROM activities
            GROUP BY month, type
            ORDER BY month DESC
            LIMIT 24
        """)
        milestones = cur.fetchall()
        
        month_map = {}
        
        # Helper to format month names
        def format_month(m_str):
            try:
                dt_obj = dt.datetime.strptime(m_str, "%Y-%m")
                return dt_obj.strftime("%B %Y")
            except:
                return m_str
        
        for m in milestones:
            month = m["month"]
            if month not in month_map:
                month_map[month] = []
            
            # Merge with imported trophies for this month if any
            # Note: imported_trophies keys might be "Jun 2025" while month here is "2025-06"
            # We transform month here to "Jun 2025" for lookup
            try:
                dt_obj = dt.datetime.strptime(month, "%Y-%m")
                month_key = dt_obj.strftime("%b %Y")
                if month_key in imported_trophies:
                    month_map[month].extend(imported_trophies.pop(month_key))
            except:
                pass
            
            # 1. Monthly distance badges
            if m["total_dist"] >= 100000: # 100km
                month_map[month].append({
                    "id": f"dist-100-{month}-{m['type']}",
                    "name": f"{month} {m['type']} 100km Challenge",
                    "icon": "🚴" if m['type'] == 'Ride' else "🏃",
                    "color": "#3b82f6" if m['type'] == 'Ride' else "#ef4444",
                    "progress": "Complete"
                })
            
            # 2. Single activity milestones
            if m["type"] == 'Ride' and m["max_dist"] >= 100000: # Imperial Century / Gran Fondo
                month_map[month].append({
                    "id": f"gran-fondo-{month}",
                    "name": "Gran Fondo Badge",
                    "icon": "🏔️",
                    "color": "#8b5cf6",
                    "progress": "100km+"
                })
            elif m["type"] == 'Run' and m["max_dist"] >= 21097: # Half Marathon
                month_map[month].append({
                    "id": f"half-mara-{month}",
                    "name": "Half Marathon Badge",
                    "icon": "🏅",
                    "color": "#10b981",
                    "progress": "21.1km"
                })

        # 4. Integrate imported trophies and deduplicate
        all_month_keys = set(month_map.keys())
        for mk in imported_trophies.keys():
            try:
                d_val = dt.datetime.strptime(mk, "%b %Y")
                all_month_keys.add(d_val.strftime("%Y-%m"))
            except:
                all_month_keys.add(mk)

        for mk, items in imported_trophies.items():
            try:
                d_val = dt.datetime.strptime(mk, "%b %Y")
                m_slug = d_val.strftime("%Y-%m")
            except:
                m_slug = mk
            if m_slug not in month_map:
                month_map[m_slug] = []
            month_map[m_slug].extend(items)

        final_challenges = []
        months_sorted = sorted(month_map.keys(), reverse=True)
        for m_key in months_sorted:
            seen_names = set()
            dedup_items = []
            for it in month_map[m_key]:
                name = it.get("name", "Unknown")
                if name in seen_names: continue
                seen_names.add(name)
                
                img = it.get("image", "")
                if img and not img.startswith("http"):
                    it["image"] = f"/static/trophy_icons/{os.path.basename(img)}"
                dedup_items.append(it)
            
            if dedup_items:
                final_challenges.append({
                    "month": format_month(m_key).upper(),
                    "items": dedup_items
                })
        return final_challenges
    finally:
        conn.close()

@app.post("/api/v1/challenges/import")
def import_challenges(req: TrophyImportRequest):
    count = parse_and_save_trophies(req.html)
    if count == 0:
        raise HTTPException(status_code=400, detail="No valid trophies found in the provided HTML.")
    return {"status": "success", "count": count}

@app.get("/api/v1/stats/rewind")
def get_rewind_report(year: Optional[str] = None, compare_year: Optional[str] = None, sport_type: Optional[str] = Query(None)):
    """Detailed annual report data for the Rewind page with comparison support."""
    conn = get_db_conn()
    if not conn: return {}
    
    RIDE_TYPES = ['Ride', 'VirtualRide', 'Velomobile', 'E-BikeRide']
    RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']
    
    if sport_type == "Ride":
        active_types = RIDE_TYPES
    elif sport_type == "Run":
        active_types = RUN_TYPES
    else:
        active_types = RIDE_TYPES + RUN_TYPES
        
    placeholders = ','.join(['?'] * len(active_types))
    type_filter = f"type IN ({placeholders})"

    try:
        cur = conn.cursor()
        athlete = get_athlete_metrics()
        weight = athlete.get("weight", 70)
        
        # Determine target year
        target_year = year if year else "ALL"
        
        # Get Available Years
        cur.execute(f"SELECT DISTINCT strftime('%Y', start_date_local) as yr FROM activities WHERE yr IS NOT NULL AND {type_filter} ORDER BY yr DESC", (*active_types,))
        available_years = [r["yr"] for r in cur.fetchall()]

        def fetch_year_stats(yr):
            if not yr or yr == "ALL":
                cur.execute(f"""
                    SELECT SUM(distance) as dist, SUM(moving_time) as time, 
                           SUM(elevation_gain) as elev, COUNT(*) as count
                    FROM activities
                    WHERE {type_filter}
                """, (*active_types,))
            else:
                cur.execute(f"""
                    SELECT SUM(distance) as dist, SUM(moving_time) as time, 
                           SUM(elevation_gain) as elev, COUNT(*) as count
                    FROM activities
                    WHERE strftime('%Y', start_date_local) = ? AND {type_filter}
                """, (str(yr), *active_types))
            row = cur.fetchone()
            if not row or row["count"] == 0:
                return {"distance": 0, "hours": 0, "elevation": 0, "count": 0, "calories": 0}
            
            dist_km = (row["dist"] or 0) / 1000.0
            return {
                "distance": round(dist_km, 1),
                "hours": round(row_to_seconds(row["time"]) / 3600.0, 1),
                "elevation": round(row["elev"] or 0),
                "count": row["count"] or 0,
                "calories": int(dist_km * weight * 0.82) # Adjusted factor
            }

        main_stats = fetch_year_stats(target_year)
        comp_stats = fetch_year_stats(compare_year) if compare_year else None
        
        def fetch_carbon(yr):
            sql = f"SELECT type, SUM(distance) as dist FROM activities WHERE {type_filter}"
            params = [*active_types]
            if yr and yr != "ALL":
                sql += " AND strftime('%Y', start_date_local) = ?"
                params.append(str(yr))
            sql += " GROUP BY type"
            cur.execute(sql, params)
            total = 0
            for r in cur.fetchall():
                if r["type"] in RUN_TYPES:
                    total += (r["dist"] / 1000.0) * 0.16 
                elif r["type"] in RIDE_TYPES:
                    total += (r["dist"] / 1000.0) * 0.12
            return round(total, 1)

        carbon_total = fetch_carbon(target_year)
        comp_carbon = fetch_carbon(compare_year) if compare_year else None

        # Calculate comparison deltas
        comparison = None
        if comp_stats and main_stats["count"] > 0:
            comparison = {
                "dist_diff": round(main_stats["distance"] - comp_stats["distance"], 1),
                "count_diff": main_stats["count"] - comp_stats["count"],
                "elev_diff": main_stats["elevation"] - comp_stats["elevation"],
                "time_diff": round(main_stats["hours"] - comp_stats["hours"], 1),
                "cal_diff": main_stats["calories"] - comp_stats["calories"],
                "carbon_diff": round(carbon_total - comp_carbon, 1) if comp_carbon is not None else 0,
                "dist_percent": round((main_stats["distance"] / comp_stats["distance"] * 100 - 100), 1) if comp_stats["distance"] > 0 else 100
            }

        # 2. Gear Usage Hours (Target Year / ALL)
        gears = athlete.get("gears", [])
        gear_usage = []
        for g in gears:
            g_from = g.get("active_from", "2000-01-01")
            g_to = g.get("active_to", "2099-12-31")
            g_original_type = g.get("type", "Run")
            types = ["Run", "VirtualRun", "TrailRun"] if g_original_type == "Run" else ["Ride", "VirtualRide", "Velomobile"]
            
            # Intersection with active_types
            actual_types = [t for t in types if t in active_types]
            if not actual_types: continue
            
            p = ",".join(["?"] * len(actual_types))
            if target_year == "ALL":
                cur.execute(f"SELECT SUM(moving_time) FROM activities WHERE type IN ({p}) AND date(start_date_local) BETWEEN ? AND ?", (*actual_types, g_from, g_to))
            else:
                cur.execute(f"SELECT SUM(moving_time) FROM activities WHERE type IN ({p}) AND strftime('%Y', start_date_local) = ? AND date(start_date_local) BETWEEN ? AND ?", (*actual_types, str(target_year), g_from, g_to))
            
            t_res = cur.fetchone()[0]
            hours = row_to_seconds(t_res) / 3600.0
            if hours > 0:
                gear_usage.append({"name": g.get("name"), "hours": round(hours, 1)})
            
        # 3. Monthly Metrics Matrix
        mon_filter = f"strftime('%Y', start_date_local) = ? AND {type_filter}" if target_year != "ALL" else type_filter
        mon_params = (str(target_year), *active_types) if target_year != "ALL" else (*active_types,)
        
        cur.execute(f"""
            SELECT strftime('%m', start_date_local) as month_num,
                   COUNT(*) as count, SUM(distance) as dist, SUM(elevation_gain) as elev, SUM(moving_time) as time
            FROM activities
            WHERE {mon_filter}
            GROUP BY month_num
        """, mon_params)
        res_map = {r["month_num"]: r for r in cur.fetchall()}
        
        # Fetch PRs
        month_prs = {f"{m:02d}": 0 for m in range(1, 13)}
        record_configs = [5000, 10000, 21097, 42195, 30000, 50000, 80000, 100000]
        for dist_m in record_configs:
            if target_year == "ALL":
                cur.execute(f"""
                    SELECT strftime('%m', start_date_local) as month
                    FROM activities WHERE distance >= ? AND {type_filter}
                    ORDER BY moving_time ASC LIMIT 1
                """, (dist_m, *active_types))
            else:
                cur.execute(f"""
                    SELECT strftime('%m', start_date_local) as month
                    FROM activities 
                    WHERE distance >= ? AND strftime('%Y', start_date_local) = ? AND {type_filter}
                    ORDER BY moving_time ASC LIMIT 1
                """, (dist_m, str(target_year), *active_types))
            row = cur.fetchone()
            if row:
                month_prs[row["month"]] += 1

        monthly_matrix = []
        months_short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for i in range(1, 13):
            m_num = f"{i:02d}"
            r = res_map.get(m_num, {"count": 0, "dist": 0, "elev": 0, "time": 0})
            monthly_matrix.append({
                "month": months_short[i-1],
                "count": r["count"],
                "dist": round((r["dist"] or 0) / 1000.0, 1),
                "elev": round(r["elev"] or 0),
                "time": round(row_to_seconds(r["time"]) / 3600.0, 1),
                "prs": month_prs.get(m_num, 0)
            })

        # 4. Longest Session
        if target_year == "ALL":
            cur.execute(f"SELECT name, moving_time, distance, date(start_date_local) as date, summary_polyline FROM activities WHERE {type_filter} ORDER BY moving_time DESC LIMIT 1", (*active_types,))
        else:
            cur.execute(f"SELECT name, moving_time, distance, date(start_date_local) as date, summary_polyline FROM activities WHERE strftime('%Y', start_date_local) = ? AND {type_filter} ORDER BY moving_time DESC LIMIT 1", (str(target_year), *active_types))
        row = cur.fetchone()
        longest = dict(row) if row else {"name": "None", "moving_time": "0", "distance": 0, "date": ""}
        longest["hours"] = round(row_to_seconds(longest.get("moving_time", "0")) / 3600.0, 1)
        longest["dist_km"] = round((longest.get("distance", 0) or 0) / 1000.0, 1)

        # 5. Streaks (Dynamic based on selected year)
        if target_year == "ALL":
            cur.execute(f"SELECT date(start_date_local) as date FROM activities WHERE {type_filter}", (*active_types,))
        else:
            cur.execute(f"SELECT date(start_date_local) as date FROM activities WHERE strftime('%Y', start_date_local) = ? AND {type_filter}", (str(target_year), *active_types))
        filtered_dates = [r["date"] for r in cur.fetchall()]
        streaks = calculate_streaks_detailed(filtered_dates)
        
        # 6. Habit Stats
        if target_year == "ALL":
            cur.execute(f"SELECT COUNT(DISTINCT date(start_date_local)) as active_days FROM activities WHERE {type_filter}", (*active_types,))
            active_days = cur.fetchone()["active_days"] or 0
            cur.execute(f"SELECT MIN(date(start_date_local)), MAX(date(start_date_local)) FROM activities WHERE {type_filter}", (*active_types,))
            row = cur.fetchone()
            if row and row[0]:
                d1 = dt.date.fromisoformat(row[0])
                d2 = dt.date.today()
                total_days = (d2 - d1).days + 1
            else:
                total_days = 365
        else:
            cur.execute(f"SELECT COUNT(DISTINCT date(start_date_local)) as active_days FROM activities WHERE strftime('%Y', start_date_local) = ? AND {type_filter}", (str(target_year), *active_types))
            active_days = cur.fetchone()["active_days"] or 0
            i_year = int(target_year)
            total_days = 366 if (i_year % 4 == 0 and (i_year % 100 != 0 or i_year % 400 == 0)) else 365
            today = dt.date.today()
            if i_year == today.year:
                total_days = (today - dt.date(i_year, 1, 1)).days + 1

        # 8. Time of Day
        tod_sql = f"SELECT strftime('%H', start_date_local) as hour, COUNT(*) as count FROM activities WHERE {type_filter}"
        tod_params = [*active_types]
        if target_year != "ALL":
            tod_sql += " AND strftime('%Y', start_date_local) = ?"
            tod_params.append(str(target_year))
        tod_sql += " GROUP BY hour"
        
        cur.execute(tod_sql, tod_params)
        hours_data = {f"{h:02d}:00": 0 for h in range(24)}
        for r in cur.fetchall():
            hours_data[f"{r['hour']}:00"] = r["count"]

        # 9. Locations & Polylines
        loc_sql = f"SELECT location_city, COUNT(*) as count FROM activities WHERE location_city IS NOT NULL AND {type_filter}"
        poly_sql = f"SELECT summary_polyline FROM activities WHERE summary_polyline IS NOT NULL AND {type_filter}"
        loc_params = [*active_types]
        poly_params = [*active_types]
        
        if target_year != "ALL":
            loc_sql += " AND strftime('%Y', start_date_local) = ?"
            poly_sql += " AND strftime('%Y', start_date_local) = ?"
            loc_params.append(str(target_year))
            poly_params.append(str(target_year))
            
        loc_sql += " GROUP BY location_city ORDER BY count DESC LIMIT 10"
        poly_sql += " ORDER BY start_date_local DESC LIMIT 300"
        
        cur.execute(loc_sql, loc_params)
        locations = [dict(r) for r in cur.fetchall()]
        
        cur.execute(poly_sql, poly_params)
        polylines = [r[0] for r in cur.fetchall()]

        # 10. Photos
        photo_sql = "SELECT id, local_path, remote_url, title, date, type FROM photos WHERE 1=1"
        photo_params = []
        if target_year != "ALL":
            photo_sql += " AND strftime('%Y', date) = ?"
            photo_params.append(str(target_year))
        
        if sport_type:
            placeholders = ','.join(['?'] * len(active_types))
            photo_sql += f" AND type IN ({placeholders})"
            photo_params.extend(active_types)

        photo_sql += " ORDER BY date DESC LIMIT 5"
        
        cur.execute(photo_sql, photo_params)
        photo_rows = cur.fetchall()
        photos = []
        for p in photo_rows:
            photos.append({
                "id": p["id"],
                "url": f"/static/photos/{os.path.basename(p['local_path'])}" if p['local_path'] else p["remote_url"],
                "title": p["title"],
                "date": p["date"]
            })
        
        return {
            "year": target_year,
            "compare_year": compare_year,
            "available_years": available_years,
            "overall": main_stats,
            "comparison": comparison,
            "carbon": round(carbon_total, 1),
            "passed_cars": int(carbon_total / 20) if carbon_total > 0 else 0,
            "google_searches": int(main_stats["calories"] / 0.2) if main_stats["calories"] > 0 else 0,
            "longest": longest,
            "streaks": streaks,
            "habit": {
                "active_days": active_days,
                "rest_days": max(0, total_days - active_days),
                "total_days": total_days
            },
            "gear": gear_usage,
            "monthly": monthly_matrix,
            "time_of_day": [{"hour": k, "count": v} for k, v in hours_data.items()],
            "locations": locations,
            "polylines": polylines,
            "photos": photos
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/v1/segments")
def get_segments(sport_type: Optional[str] = Query(None)):
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        base_query = """
            SELECT s.*, 
                   (SELECT MIN(se.kom_rank) FROM segment_efforts se WHERE se.segment_id = s.id) as best_rank
            FROM segments s
        """
        if sport_type == "Ride":
            cur.execute(f"{base_query} WHERE activity_type IN ('Ride', 'VirtualRide', 'Velomobile') ORDER BY effort_count DESC")
        elif sport_type == "Run":
            cur.execute(f"{base_query} WHERE activity_type IN ('Run', 'TrailRun', 'VirtualRun') ORDER BY effort_count DESC")
        else:
            cur.execute(f"{base_query} ORDER BY effort_count DESC")
        rows = cur.fetchall()
        
        # Only provide mock data if the entire table is empty to avoid confusion when filtering
        cur.execute("SELECT COUNT(*) FROM segments")
        total_in_db = cur.fetchone()[0]
        
        if total_in_db == 0:
            return [
                {
                    "id": 123, "name": "Sprint Finish Line", "distance": 1100, "city": "Hangzhou",
                    "effort_count": 42, "best_time": "0:01:42", "best_date": "2024-03-12", "average_grade": 2.5
                },
                {
                    "id": 124, "name": "Central Park Loop", "distance": 6200, "city": "Shanghai",
                    "effort_count": 15, "best_time": "0:24:15", "best_date": "2023-11-05", "average_grade": 0.5
                }
            ]
            
        return [dict(r) for r in rows]
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.get("/api/v1/segment_efforts/{segment_id}")
def get_segment_efforts(segment_id: int):
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM segment_efforts WHERE segment_id = ? ORDER BY start_date_local DESC", (segment_id,))
        efforts = [dict(r) for r in cur.fetchall()]
        
        # Mock history if empty
        if not efforts:
            import random
            from datetime import timedelta
            efforts = []
            for i in range(10):
                d = datetime.now() - timedelta(days=i*14)
                efforts.append({
                    "id": 1000 + i,
                    "segment_id": segment_id,
                    "activity_id": 9999 - i,
                    "name": "Evening Run",
                    "moving_time": str(timedelta(seconds=random.randint(400, 600))),
                    "start_date_local": d.strftime("%Y-%m-%d %H:%M:%S"),
                    "average_heartrate": random.randint(140, 165),
                    "average_watts": random.randint(200, 300)
                })
        
        return efforts
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

@app.post("/api/v1/sync_segments")
def sync_segments_endpoint(background_tasks: BackgroundTasks, limit: int = 20):
    def run_sync():
        from run_page.generator import Generator
        from run_page.core.auth import get_credential
        db_path = os.environ.get("DB_PATH", "run_page/data.db")
        gen = Generator(db_path)
        
        cid = get_credential("strava_client_id")
        secret = get_credential("strava_client_secret")
        refresh = get_credential("strava_refresh_token")
        
        if cid and secret and refresh:
            gen.set_strava_config(cid, secret, refresh)
            gen.sync_segments(limit=limit)
        gen.close()

    background_tasks.add_task(run_sync)
    return {"status": "Syncing segments in background", "limit": limit}

@app.post("/api/v1/sync")
def full_sync_endpoint(background_tasks: BackgroundTasks, force: bool = False):
    def run_full_sync(force_val: bool):
        from run_page.generator import Generator
        from run_page.core.auth import get_credential
        db_path = os.environ.get("DB_PATH", "run_page/data.db")
        gen = Generator(db_path)
        
        cid = get_credential("strava_client_id")
        secret = get_credential("strava_client_secret")
        refresh = get_credential("strava_refresh_token")
        
        if cid and secret and refresh:
            gen.set_strava_config(cid, secret, refresh)
            gen.sync(force=force_val)
        gen.close()

    background_tasks.add_task(run_full_sync, force)
    return {"status": "Full data sync started in background", "force": force}

# --- Self-Contained Auto-Sync Scheduler ---
async def schedule_auto_sync():
    """Background loop to sync data at 00:00 (SGT/CCT) every day."""
    # Wait 30 seconds after startup for safety
    await asyncio.sleep(30)
    
    while True:
        # Calculate seconds until next 00:00 in East-8
        import datetime as dt_mod
        from datetime import timezone, timedelta
        
        # Current time in UTC, then convert to East-8
        tz_e8 = timezone(timedelta(hours=8))
        now_e8 = dt_mod.datetime.now(tz_e8)
        
        # Targeted 00:00 tomorrow
        tomorrow = now_e8 + dt_mod.timedelta(days=1)
        next_sync = dt_mod.datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=tz_e8)
        
        delay_seconds = (next_sync - now_e8).total_seconds()
        
        # If distance to midnight is too large (like we just started at 10 AM), 
        # let's do one sync now and THEN wait for midnight.
        print(f"[{dt_mod.datetime.now()}] Next automatic sync scheduled for {next_sync} (in {delay_seconds/3600:.1f}h)")
        
        # Initial sync on startup if enabled
        sync_on_start = os.environ.get("SYNC_ON_STARTUP", "true").lower() == "true"
        if sync_on_start:
            print(f"[{dt_mod.datetime.now()}] Performing initial startup sync (async thread)...")
            await asyncio.to_thread(perform_sync_logic)
            # Disable for the next loops
            os.environ["SYNC_ON_STARTUP"] = "false"

        await asyncio.sleep(delay_seconds)
        
        print(f"[{dt_mod.datetime.now()}] Scheduled midnight sync starting...")
        await asyncio.to_thread(perform_sync_logic)

def perform_sync_logic():
    import datetime as dt_mod
    try:
        from run_page.generator import Generator
        from run_page.core.auth import get_credential
        
        db_path = os.environ.get("DB_PATH", "run_page/data.db")
        gen = Generator(db_path)
        cid = get_credential("strava_client_id")
        secret = get_credential("strava_client_secret")
        refresh = get_credential("strava_refresh_token")
        
        if cid and secret and refresh:
            gen.set_strava_config(cid, secret, refresh)
            gen.sync(force=False)
            gen.sync_segments(limit=20)
            
            # Also sync photos
            try:
                sync_strava_photos(limit=1000)
            except Exception as pe:
                print(f"[{dt_mod.datetime.now()}] Photo sync failed: {pe}")

            print(f"[{dt_mod.datetime.now()}] Sync completed successfully.")
        gen.close()
    except Exception as e:
        print(f"[{dt_mod.datetime.now()}] Sync failed: {e}")

# (startup scheduler moved to lifespan)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("run_page.web_api:app", host="0.0.0.0", port=8000, reload=True)
# Reload trigger
