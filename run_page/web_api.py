import os
import sys
import subprocess
import json
import sqlite3
import asyncio
import time
import yaml
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

app = FastAPI(
    title="TrackRecord Engine API", 
    description="Headless driver for multi-platform running data sync, powered by the core metadata system."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def row_to_seconds(val):
    if not val:
        return 0
    try:
        if isinstance(val, str) and ":" in val:
            parts = val.split(':')
            if len(parts) == 3:
                return int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
            elif len(parts) == 2:
                return int(parts[0])*60 + int(parts[1])
        return int(val)
    except:
        return 0

# Global Cache for Strava Clubs (Solves Slowness)
CLUBS_CACHE = {"data": None, "expiry": 0}

def get_strava_clubs_cached(creds):
    global CLUBS_CACHE
    if CLUBS_CACHE["data"] and time.time() < CLUBS_CACHE["expiry"]:
        return CLUBS_CACHE["data"]
    
    if "strava_client_id" not in creds:
        return []
        
    try:
        from stravalib.client import Client
        client = Client()
        response = client.refresh_access_token(
            client_id=creds["strava_client_id"],
            client_secret=creds["strava_client_secret"],
            refresh_token=creds["strava_refresh_token"]
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
        CLUBS_CACHE["expiry"] = time.time() + 3600 # 1 hour cache
        return clubs_data
    except Exception as e:
        print(f"Club fetch error: {e}")
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
                    
                    if not os.path.exists(local_path):
                        r = requests.get(img_url, stream=True, timeout=10)
                        if r.status_code == 200:
                            with open(local_path, 'wb') as f:
                                for chunk in r.iter_content(1024):
                                    f.write(chunk)
                    local_img_url = f"/static/trophy_icons/{filename}"
                except Exception as img_e:
                    print(f"Failed to download trophy icon {name}: {img_e}")

                date_str = date_tag.get_text(strip=True) if date_tag else "Special"
                month_match = re.search(r'([A-Za-z]+ \d{4})', date_str)
                month_key = month_match.group(1) if month_match else "HISTORICAL"
                
                tid = f"strava-trophy-{abs(hash(name))}"
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

# Create static directory for photos
os.makedirs("run_page/static/photos", exist_ok=True)
app.mount("/static", StaticFiles(directory="run_page/static"), name="static")

# Simple localization for API
def L(key):
    return I18N.get("en", {}).get(key, key)

# Professional Athletics Metrics
def get_athlete_metrics():
    config_path = "run_page/settings.yaml"
    if not os.path.exists(config_path):
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
            "vo2_estimate": 45.0
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
    
    return {
        "gender": athlete.get("gender", "male"),
        "age": age,
        "max_hr": int(max_hr),
        "resting_hr": resting_hr,
        "weight": athlete.get("weight"),
        "zones": calculated_zones,
        "vo2_estimate": round(vo2_hr, 1),
        "riegel_exponents": athlete.get("riegel_exponents", {"run": 1.06, "ride": 1.05}),
        "gears": athlete.get("gears", [])
    }

# Aggregated stats and heatmap logic
def get_db_conn():
    db_path = "run_page/data.db"
    if not os.path.exists(db_path):
        return None
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/")
def read_root():
    return {"message": "TrackRecord Public Data API", "status": "online"}

@app.get("/api/v1/stats")
def get_sports_stats():
    """Comprehensive sports statistics for the public dashboard."""
    conn = get_db_conn()
    if not conn:
        return {"total_distance": 0, "total_count": 0, "recent_activities": [], "heatmap": {}, "yearly": {}}
    
    try:
        cur = conn.cursor()
        athlete_metrics = get_athlete_metrics()
        
        # 1. Basic Aggregates
        cur.execute("SELECT COUNT(*) as count, SUM(distance) as dist FROM activities")
        agg = cur.fetchone()
        
        # 2. Tracks and Recent Activities (Top 50 for map/heatmap)
        cur.execute("""
            SELECT run_id, name, distance, moving_time, type, start_date_local, summary_polyline, 
                   average_heartrate, max_speed, location_country, location_city, commute, workout_type,
                   elevation_gain
            FROM activities 
            ORDER BY start_date_local DESC 
            LIMIT 2000
        """)
        recent = []
        for row in cur.fetchall():
            d = dict(row)
            if d["moving_time"] and " " in d["moving_time"]:
                d["moving_time_display"] = d["moving_time"].split(" ")[1].split(".")[0]
            else:
                d["moving_time_display"] = d["moving_time"]
            
            # GAP Calculation (Grade Adjusted Pace) for Running
            if d["type"] in ["Run", "VirtualRun", "TrailRun"] and d["distance"] > 0 and d["elevation_gain"]:
                # Convert moving_time to seconds
                t_str = d["moving_time"]
                t_only = t_str.split(" ")[1] if " " in t_str else t_str
                h, m, s = map(float, t_only.split(":"))
                total_sec = h * 3600 + m * 60 + s
                
                if total_sec > 0:
                    grade = d["elevation_gain"] / d["distance"]
                    # Simplified GAP model: Every 1% grade adds ~6% effort uphill
                    # For summary data, we assume elevation_gain is the total climb level.
                    # RIEGEL-like or Minetti-like adjustment
                    if grade > 0:
                        # factor calculation: 1 + 9 * grade is a common aggressive estimate
                        # Let's use 1 + 6 * grade for a more conservative average
                        factor = 1.0 + (6.0 * grade)
                        gap_sec_per_km = (total_sec / (d["distance"] / 1000.0)) / factor
                        
                        # Format GAP Pace
                        gm = int(gap_sec_per_km // 60)
                        gs = int(gap_sec_per_km % 60)
                        d["gap_pace"] = f"{gm}:{gs:02d}/km"
            
            recent.append(d)
        
        # 3. Yearly Aggregates
        cur.execute("""
            SELECT strftime('%Y', start_date_local) as year, 
                   COUNT(*) as count, 
                   SUM(distance) as dist 
            FROM activities 
            GROUP BY year 
            ORDER BY year DESC
        """)
        yearly = {row["year"]: {"count": row["count"], "distance": row["dist"] / 1000.0} for row in cur.fetchall()}
        
        # 4. Heatmap Data (Activity count per day for the last 365 days)
        cur.execute("""
            SELECT date(start_date_local) as date, COUNT(*) as count 
            FROM activities 
            WHERE start_date_local > date('now', '-1 year')
            GROUP BY date
        """)
        heatmap = {row["date"]: row["count"] for row in cur.fetchall()}
        
        # heatmap = {row["date"]: row["count"] for row in cur.fetchall()}
        
        # 5. Professional Analytics Enhancements
        # Monthly Trends for the last 12 months
        cur.execute("""
            SELECT strftime('%Y-%m', start_date_local) as month,
                   SUM(distance) as total_dist,
                   COUNT(*) as count
            FROM activities
            WHERE start_date_local > date('now', '-365 days')
            GROUP BY month
            ORDER BY month ASC
        """)
        monthly_trends = [dict(row) for row in cur.fetchall()]

        # Weekly Trends for the last 12 weeks
        cur.execute("""
            SELECT strftime('%Y-%W', start_date_local) as week,
                   SUM(distance) as total_dist,
                   COUNT(*) as count
            FROM activities
            WHERE start_date_local > date('now', '-84 days')
            GROUP BY week
            ORDER BY week ASC
        """)
        weekly_trends = [dict(row) for row in cur.fetchall()]

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
        # Best Efforts (sampled distances for Run and Ride)
        record_configs = [
            ("5K", 5000, ['Run', 'TrailRun', 'VirtualRun']),
            ("10K", 10000, ['Run', 'TrailRun', 'VirtualRun']),
            ("Half Marathon", 21097, ['Run', 'TrailRun', 'VirtualRun']),
            ("Marathon", 42195, ['Run', 'TrailRun', 'VirtualRun']),
            ("20K Ride", 20000, ['Ride', 'VirtualRide', 'Velomobile']),
            ("50K Ride", 50000, ['Ride', 'VirtualRide', 'Velomobile']),
            ("100K Ride", 100000, ['Ride', 'VirtualRide', 'Velomobile']),
            ("160K Ride", 160934, ['Ride', 'VirtualRide', 'Velomobile']),
        ]
        
        for name, dist_m, types in record_configs:
            placeholder = ', '.join(['?'] * len(types))
            cur.execute(f"""
                SELECT name, distance, moving_time, start_date_local,
                       strftime('%H:%M:%S', moving_time) as moving_time_display
                FROM activities 
                WHERE type IN ({placeholder}) AND distance >= ? 
                ORDER BY strftime('%s', moving_time) ASC
                LIMIT 1
            """, (*types, dist_m))
            row = cur.fetchone()
            if row:
                d = dict(row)
                d["moving_time"] = d["moving_time_display"] # Use the clean version
                records[name] = d

        # 5.6 Best Efforts Trends (Historical Performance)
        records_trends = {}
        trend_configs = [
            ("5K", 5000, ['Run', 'TrailRun', 'VirtualRun']),
            ("10K", 10000, ['Run', 'TrailRun', 'VirtualRun']),
            ("21K", 21097, ['Run', 'TrailRun', 'VirtualRun']),
            ("42K", 42195, ['Run', 'TrailRun', 'VirtualRun']),
            ("50K Ride", 50000, ['Ride', 'VirtualRide', 'Velomobile']),
            ("100K Ride", 100000, ['Ride', 'VirtualRide', 'Velomobile']),
        ]
        
        for name, dist_m, types in trend_configs:
            placeholder = ', '.join(['?'] * len(types))
            cur.execute(f"""
                SELECT date(start_date_local) as date,
                       CAST(strftime('%s', moving_time) as integer) as seconds
                FROM activities 
                WHERE type IN ({placeholder}) AND distance BETWEEN ? AND ? 
                ORDER BY date ASC
            """, (*types, dist_m * 0.95, dist_m * 1.1)) # Slightly wider tolerance for trends
            trends_data = [dict(row) for row in cur.fetchall()]
            if trends_data:
                records_trends[name] = trends_data

        # 5.7 Daily Details (for heatmap & monthly drill-down)
        cur.execute("""
            SELECT date(start_date_local) as date,
                   SUM(distance) as dist,
                   SUM(moving_time) as time,
                   COUNT(*) as count,
                   type
            FROM activities
            WHERE start_date_local > date('now', '-365 days')
            GROUP BY date, type
            ORDER BY date ASC
        """)
        daily_stats = [dict(row) for row in cur.fetchall()]
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

        # 7. YoY Cumulative Distance (Year-over-Year)
        cur.execute("""
            SELECT strftime('%Y', start_date_local) as year,
                   CAST(strftime('%j', start_date_local) AS INTEGER) as day_of_year,
                   SUM(distance) as daily_dist
            FROM activities
            GROUP BY year, day_of_year
            ORDER BY year ASC, day_of_year ASC
        """)
        yoy_raw = cur.fetchall()
        
        # Organize data into a map: year -> day -> distance
        yoy_map = {}
        all_years = []
        for r in yoy_raw:
            yr = r["year"]
            if yr not in yoy_map:
                yoy_map[yr] = {}
                all_years.append(yr)
            yoy_map[yr][r["day_of_year"]] = r["daily_dist"] / 1000.0
        
        # Build the final cumulative series
        yoy_cumulative = []
        current_totals = {yr: 0 for yr in all_years}
        
        # Iterate through every day of the year (1-366)
        for day in range(1, 367):
            day_data = {"day": day}
            has_data = False
            for yr in all_years:
                # Add today's distance to this year's running total
                current_totals[yr] += yoy_map.get(yr, {}).get(day, 0)
                # Only include in chart if this day is within the current year's progress
                # or it's a past year (complete)
                day_data[yr] = round(current_totals[yr], 2)
                has_data = True
            
            # Sampling: Take every 5th day + the very last day to reduce payload size
            if day % 5 == 0 or day == 1 or day == 365 or day == 366:
                yoy_cumulative.append(day_data)

        # 8. Training Load (CTL/ATL/TSB) Calculation (TRIMP Based)
        # Fetch individual activities for the last 200 days to ensure stable CTL at start of 90-day chart
        cur.execute("""
            SELECT date(start_date_local) as date,
                   distance as dist,
                   average_heartrate as hr,
                   moving_time as time,
                   type
            FROM activities
            WHERE start_date_local > date('now', '-200 days')
            ORDER BY start_date_local ASC
        """)
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
                if act["type"] in ["Run", "VirtualRun", "TrailRun"]:
                    stress = (act["dist"] / 1000.0) * 8.0 # Roughly 8 stress per km
                else: 
                    stress = (act["dist"] / 1000.0) * 2.0 # Roughly 2 stress per km
            
            daily_stress[d] = daily_stress.get(d, 0) + stress
            
        training_series = []
        ctl, atl = 0, 0
        import datetime
        start_date = datetime.date.today() - datetime.timedelta(days=179)
        
        for i in range(180):
            curr_date_obj = (start_date + datetime.timedelta(days=i))
            curr_date = curr_date_obj.isoformat()
            stress = daily_stress.get(curr_date, 0)
            
            # Exponential Moving Averages (CTL: 42 days, ATL: 7 days)
            # Formula: EMA_today = EMA_yesterday + (today_stress - EMA_yesterday) * (2 / (N + 1))
            # Traditional Fitness/Fatigue uses 1/N for decaying factor
            ctl = ctl + (stress - ctl) * (1.0 / 42.0)
            atl = atl + (stress - atl) * (1.0 / 7.0)
            
            if i >= 90: # Only return the last 90 days for the chart
                training_series.append({
                    "date": curr_date,
                    "ctl": round(ctl, 2),
                    "atl": round(atl, 2),
                    "tsb": round(ctl - atl, 2)
                })

        # 9. Heart Rate Zones Distribution (Dynamic based on settings.yaml)
        cur.execute("SELECT average_heartrate as hr FROM activities WHERE average_heartrate > 0")
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
        cur.execute("""
            SELECT 
                CASE 
                    WHEN average_watts < 150 THEN 'Low Intensity'
                    WHEN average_watts BETWEEN 150 AND 250 THEN 'Moderate'
                    ELSE 'High Intensity'
                END as power_zone,
                COUNT(*) as count
            FROM activities
            WHERE average_watts > 0
            GROUP BY power_zone
        """)
        power_distribution = [dict(row) for row in cur.fetchall()]

        # 11. Period Comparison (This Year vs Last Year Monthly)
        cur.execute("""
            SELECT strftime('%m', start_date_local) as month,
                   strftime('%Y', start_date_local) as year,
                   SUM(distance) as dist
            FROM activities
            WHERE year IN (strftime('%Y', 'now'), strftime('%Y', 'now', '-1 year'))
            GROUP BY year, month
            ORDER BY month ASC
        """)
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
        cur.execute("""
            SELECT SUM(distance) as dist, COUNT(*) as count
            FROM activities 
            WHERE date(start_date_local) >= ?
        """, (seven_days_ago.isoformat(),))
        tw_row = cur.fetchone()
        
        cur.execute("""
            SELECT SUM(distance) as dist, COUNT(*) as count
            FROM activities 
            WHERE date(start_date_local) >= ? AND date(start_date_local) < ?
        """, (fourteen_days_ago.isoformat(), seven_days_ago.isoformat()))
        lw_row = cur.fetchone()

        # 12. Real Goals (Derived from live data)
        cur.execute("""
            SELECT SUM(elevation_gain) as elev 
            FROM activities 
            WHERE strftime('%Y-%m', start_date_local) = strftime('%Y-%m', 'now')
        """)
        mtd_elev = cur.fetchone()["elev"] or 0
        
        tw_count = tw_row["count"] or 0
        goals = [
            {"title": f"Annual Distance {this_year}", "target": 2000, "current": round(yearly.get(this_year, {}).get("distance", 0), 1), "unit": "km"},
            {"title": "Monthly Elevation", "target": mtd_elev + 500 if mtd_elev < 1000 else round(mtd_elev * 1.5, -2), "current": round(mtd_elev), "unit": "m"},
            {"title": "Activities per Week", "target": max(5, tw_count + 1), "current": tw_count, "unit": "sessions"}
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

        # 11. Athlete Metrics
        athlete_metrics = get_athlete_metrics()

        # 15. Time & Weekday Preferences
        time_preference = [
            dict(row) for row in cur.execute("""
                SELECT (CAST(strftime('%H', start_date_local) AS INTEGER) / 2) * 2 as slot,
                       COUNT(*) as count
                FROM activities
                GROUP BY slot
                ORDER BY slot ASC
            """).fetchall()
        ]
        
        weekday_preference = [
            dict(row) for row in cur.execute("""
                SELECT CAST(strftime('%w', start_date_local) AS INTEGER) as weekday,
                       COUNT(*) as count
                FROM activities
                GROUP BY weekday
                ORDER BY weekday ASC
            """).fetchall()
        ]

        # 12. Dynamic Gear & Equipment Calculation
        gear_stats = []
        configured_gears = athlete_metrics.get("gears", [])
        
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
        if tsb > 10:
            advice = "You are in peak form! This is the perfect window to attempt a Personal Best (PB) or a high-intensity race."
        elif tsb > 0:
            advice = "Feeling fresh. You have recovered well and are ready for quality interval training or a long effort."
        elif tsb > -10:
            advice = "Optimal training zone. You are maintaining a solid balance between load and recovery. Keep it up."
        elif tsb > -25:
            advice = "Productive fatigue. You are building significant fitness, but expect to feel some leg heaviness. Rest is coming soon."
        else:
            advice = "High fatigue detected. Your risk of injury is elevated. Consider an active recovery day or complete rest."
        
        # Append Gear Advice if any
        if gear_alerts:
            advice += " | ATTENTION: " + " ".join(gear_alerts[:2]) # Keep it concise
        
        smart_coach = {
            "advice": advice,
            "efficiency": round(ctl / (atl if atl > 0 else 1), 2),
            "status": "Peak" if tsb > 10 else ("Fresh" if tsb > 0 else ("Optimal" if tsb > -10 else "Fatigued"))
        }

        # 13. Recording Devices Calculation (Dynamic)
        recording_stats = []
        cur.execute("""
            SELECT 
                CASE 
                    WHEN name LIKE 'Zwift%' THEN 'Zwift'
                    WHEN type = 'VirtualRide' THEN 'Virtual Platform'
                    WHEN type = 'Ride' THEN 'Cycling Computer'
                    WHEN type = 'Run' THEN 'Running Watch'
                    ELSE 'Other App/Device'
                END as device,
                COUNT(*) as count,
                SUM(distance) as dist,
                SUM(elevation_gain) as elev,
                SUM(moving_time) as time
            FROM activities
            GROUP BY device
            ORDER BY count DESC
        """)
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

        # Final Return Object
        return {
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
            "training_load": training_series,
            "records_trends": records_trends,
            "daily_stats": daily_stats,
            "period_comparison": period_comparison,
            "goals": goals,
            "photos_count": cur.execute("SELECT COUNT(*) FROM photos").fetchone()[0] if conn else 0,
            "gear_count": len(gear_stats),
            "athlete_metrics": athlete_metrics
        }
    finally:
        if conn: conn.close()

@app.get("/api/v1/photos")
def get_activity_photos(background_tasks: BackgroundTasks):
    """Fetch photos from local DB, trigger background sync if empty."""
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM photos ORDER BY date DESC LIMIT 50")
        rows = cur.fetchall()
        
        if not rows:
            # Trigger initial sync
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

def sync_strava_photos():
    """Background task to download photos from Strava."""
    print("Starting photo sync...")
    creds = load_creds()
    if "strava_client_id" not in creds: return

    client = Client()
    try:
        response = client.refresh_access_token(
            client_id=creds["strava_client_id"],
            client_secret=creds["strava_client_secret"],
            refresh_token=creds["strava_refresh_token"]
        )
        client.access_token = response["access_token"]
        
        conn = get_db_conn()
        cur = conn.cursor()
        
        for activity in client.get_activities(limit=50):
            if activity.total_photo_count > 0:
                # Check if we already have photos for this activity
                cur.execute("SELECT id FROM photos WHERE activity_id = ?", (activity.id,))
                if cur.fetchone(): continue
                
                print(f"Syncing photos for activity {activity.id}")
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
                                r = requests.get(remote_url, timeout=10)
                                if r.status_code == 200:
                                    with open(local_path, "wb") as f:
                                        f.write(r.content)
                                else:
                                    local_path = None
                            except Exception as e:
                                print(f"Download failed: {e}")
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
    except Exception as e:
        print(f"Photo sync error: {e}")
    finally:
        if conn: conn.close()

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
                from datetime import datetime
                dt = datetime.strptime(m_str, "%Y-%m")
                return dt.strftime("%B %Y")
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
                dt_obj = datetime.strptime(month, "%Y-%m")
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

        # Format into monthly sections for UI
        months_ordered = sorted(month_map.keys(), reverse=True)
        
        # Add any remaining imported trophies (that didn't match an activity month)
        for month_key, items in imported_trophies.items():
            # Try to push them to the right chronological spot
            found = False
            for m_str in months_ordered:
                if format_month(m_str).startswith(month_key.split(' ')[0]): # Monthly match
                    month_map[m_str].extend(items)
                    found = True
                    break
            if not found:
                # Add to a new entry if not found
                month_map[month_key] = items
        
        # Final assembly in reverse chronological order
        final_months = sorted(month_map.keys(), reverse=True)
        for m_str in final_months:
            challenges.append({
                "month": format_month(m_str),
                "items": month_map[m_str]
            })
            
        return challenges
    finally:
        conn.close()

@app.post("/api/v1/challenges/import")
def import_challenges(req: TrophyImportRequest):
    count = parse_and_save_trophies(req.html)
    if count == 0:
        raise HTTPException(status_code=400, detail="No valid trophies found in the provided HTML.")
    return {"status": "success", "count": count}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("run_page.web_api:app", host="0.0.0.0", port=8000, reload=True)
