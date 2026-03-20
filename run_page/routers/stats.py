"""
run_page/routers/stats.py  —  /api/v1/stats 主路由
计算并返回 Dashboard、Analytics、MonthlyStats、Eddington 等页面所需的所有字段。
"""

import os
import math
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Query

from run_page.services.db_service import get_db_conn, row_to_seconds, resolve_active_types, format_location
from run_page.services.cache_service import cache
from run_page.auth import load_creds

router = APIRouter(prefix="/api/v1", tags=["stats"])

# ─── 常量 ─────────────────────────────────────────────────────────────────────
_RUN_TYPES  = {"Run", "VirtualRun", "TrailRun"}
_RIDE_TYPES = {"Ride", "VirtualRide", "Velomobile", "E-BikeRide"}


# ─── 辅助：运动员配置 ──────────────────────────────────────────────────────────

def get_athlete_metrics() -> dict:
    import yaml
    defaults = {
        "weight": 70, "age": 30, "max_hr": 190, "resting_hr": 55,
        "ftp": 200, "vo2max": 50,
        "analysis": {
            "calorie_factors": {"run": 1.036, "ride": 0.5, "default": 0.8},
            "gear_warning_threshold": 0.9,
            "training_load": {"ctl_days": 42, "atl_days": 7,
                              "trimp_fallbacks": {"run": 8.0, "ride": 2.0}},
            "tsb_advice": {"peak": 10, "fresh": 0, "optimal": -10, "productive_fatigue": -25},
            "radar_normalization": {
                "endurance_monthly_km": 150, "climb_monthly_m": 1500,
                "frequency_monthly_sessions": 16, "long_run_km": 25,
                "speed_pace_min_km": 4.0,
            },
            "milestones": {}, "bins": {}, "device_mapping": {},
        },
        "gears": [],
    }
    try:
        cfg_path = os.environ.get("CONFIG_PATH", "config.yaml")
        if not os.path.exists(cfg_path):
            cfg_path = os.environ.get("CONFIG_PATH", "run_page/settings.yaml")
        if os.path.exists(cfg_path):
            with open(cfg_path) as f:
                cfg = yaml.safe_load(f) or {}
            athlete = cfg.get("athlete", {})
            for k, v in athlete.items():
                defaults[k] = v
    except Exception:
        pass

    # Compute max_hr from formula if not set (0 or missing)
    raw_hr = defaults.get("max_hr", 0)
    if not raw_hr:
        formula = defaults.get("max_hr_formula", "fox")
        try:
            birthday = defaults.get("birthday", "1990-01-01")
            age = (dt.date.today() - dt.date.fromisoformat(birthday)).days // 365
        except Exception:
            age = defaults.get("age", 30)
        if formula == "tanaka":
            defaults["max_hr"] = int(208 - 0.7 * age)
        elif formula == "gellish":
            defaults["max_hr"] = int(192 - 0.007 * age ** 2)
        else:  # fox (default)
            defaults["max_hr"] = max(160, 220 - age)

    return defaults


# ─── 辅助：连胜 ───────────────────────────────────────────────────────────────

def calculate_streaks_detailed(dates: list) -> dict:
    if not dates:
        return {"day": 0, "week": 0, "month": 0, "current": 0}

    date_objs = sorted(set(
        dt.datetime.strptime(d, "%Y-%m-%d").date() for d in dates if d
    ))

    # Day streak
    max_day = temp = 1
    for i in range(len(date_objs) - 1):
        if (date_objs[i + 1] - date_objs[i]).days == 1:
            temp += 1
        else:
            max_day = max(max_day, temp)
            temp = 1
    max_day = max(max_day, temp)

    # Week streak (ISO)
    weeks = sorted(set(d.isocalendar()[:2] for d in date_objs))
    max_week = temp = 1
    for i in range(len(weeks) - 1):
        y1, w1 = weeks[i]; y2, w2 = weeks[i + 1]
        if (y1 == y2 and w2 == w1 + 1) or (y2 == y1 + 1 and w1 >= 52 and w2 == 1):
            temp += 1
        else:
            max_week = max(max_week, temp); temp = 1
    max_week = max(max_week, temp)

    # Month streak
    months = sorted(set((d.year, d.month) for d in date_objs))
    max_month = temp = 1
    for i in range(len(months) - 1):
        y1, m1 = months[i]; y2, m2 = months[i + 1]
        if (y1 == y2 and m2 == m1 + 1) or (y2 == y1 + 1 and m1 == 12 and m2 == 1):
            temp += 1
        else:
            max_month = max(max_month, temp); temp = 1
    max_month = max(max_month, temp)

    # Current streak (ongoing, from today or yesterday)
    today = dt.date.today()
    dates_set = set(date_objs)
    current = 0
    if today in dates_set or (today - dt.timedelta(days=1)) in dates_set:
        check = today if today in dates_set else today - dt.timedelta(days=1)
        while check in dates_set:
            current += 1
            check -= dt.timedelta(days=1)

    return {"day": max_day, "week": max_week, "month": max_month, "current": current}


# ─── 辅助：Eddington ──────────────────────────────────────────────────────────

def _compute_eddington(conn, active_types: list) -> dict:
    result = {}
    for sport_key, sport_set in [("Run", _RUN_TYPES), ("Ride", _RIDE_TYPES)]:
        types = [t for t in active_types if t in sport_set]
        if not types:
            result[sport_key] = {"value": 0, "next_gap": 0, "chart_data": []}
            continue
        ph = ",".join(["?"] * len(types))
        cur = conn.cursor()
        cur.execute(
            f"SELECT date(start_date_local) as d, MAX(distance) as mx "
            f"FROM activities WHERE type IN ({ph}) AND distance > 0 GROUP BY d",
            tuple(types),
        )
        day_kms = sorted([r["mx"] / 1000.0 for r in cur.fetchall()], reverse=True)

        e_val = 0
        for i, km in enumerate(day_kms):
            if km >= i + 1:
                e_val = i + 1
            else:
                break

        next_target = e_val + 1
        days_with_next = sum(1 for km in day_kms if km >= next_target)
        next_gap = max(0, next_target - days_with_next)

        max_km = min(int(day_kms[0]) + 5 if day_kms else 10, 150)
        chart_data = []
        for km in range(1, max_km + 1):
            days = sum(1 for d in day_kms if d >= km)
            chart_data.append({"km": km, "days": days, "threshold": km})
            if days == 0:
                break

        result[sport_key] = {"value": e_val, "next_gap": next_gap, "chart_data": chart_data}
    return result


# ─── 辅助：YoY 累积 ───────────────────────────────────────────────────────────

def _compute_yoy_cumulative(conn, active_types: list, available_years: list) -> list:
    if not available_years:
        return []
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"""SELECT strftime('%Y', start_date_local) AS yr,
                   CAST(strftime('%j', start_date_local) AS INTEGER) AS doy,
                   COALESCE(SUM(distance), 0) AS dist,
                   SUM(moving_time) AS time,
                   COALESCE(SUM(elevation_gain), 0) AS elev
            FROM activities WHERE type IN ({ph}) AND yr IS NOT NULL
            GROUP BY yr, doy ORDER BY yr, doy""",
        tuple(active_types),
    )
    # Build per-year daily totals
    year_daily: dict = {}
    for row in cur.fetchall():
        yr, doy = row["yr"], row["doy"]
        year_daily.setdefault(yr, {})[doy] = {
            "dist": (row["dist"] or 0) / 1000.0,
            "time": row_to_seconds(row["time"]) / 3600.0,
            "elev": row["elev"] or 0,
        }

    # Build cumulative per year
    cumulative: dict = {}
    for yr in year_daily:
        cum_d = cum_t = cum_e = 0.0
        cumulative[yr] = {}
        for doy in range(1, 367):
            v = year_daily[yr].get(doy, {"dist": 0, "time": 0, "elev": 0})
            cum_d += v["dist"]; cum_t += v["time"]; cum_e += v["elev"]
            cumulative[yr][doy] = {
                "dist": round(cum_d, 1),
                "time": round(cum_t, 1),
                "elev": round(cum_e),
            }

    result = []
    for doy in range(1, 366):
        entry: dict = {"day": doy}
        for yr in available_years:
            vals = cumulative.get(yr, {}).get(doy, {"dist": 0, "time": 0, "elev": 0})
            entry[f"{yr}_dist"] = vals["dist"]
            entry[f"{yr}_time"] = vals["time"]
            entry[f"{yr}_elev"] = vals["elev"]
        result.append(entry)
    return result


# ─── 辅助：训练负荷 CTL/ATL/TSB ───────────────────────────────────────────────

def _compute_training_load(conn, active_types: list, athlete_metrics: dict):
    max_hr = athlete_metrics.get("max_hr", 190)
    tl_cfg = athlete_metrics["analysis"]["training_load"]
    ctl_days = tl_cfg.get("ctl_days", 42)
    atl_days_cfg = tl_cfg.get("atl_days", 7)
    fallbacks = tl_cfg.get("trimp_fallbacks", {"run": 8.0, "ride": 2.0})

    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT date(start_date_local) AS d, type, moving_time, average_heartrate "
        f"FROM activities WHERE type IN ({ph}) AND d IS NOT NULL ORDER BY d ASC",
        tuple(active_types),
    )

    daily_trimp: dict = {}
    for row in cur.fetchall():
        d = row["d"]
        if not d:
            continue
        dur_min = row_to_seconds(row["moving_time"] or "") / 60.0
        avg_hr = row["average_heartrate"]
        if avg_hr and avg_hr > 0 and max_hr > 0:
            hr_ratio = avg_hr / max_hr
            trimp = dur_min * hr_ratio * 0.64 * math.exp(1.92 * hr_ratio)
        else:
            fb = fallbacks.get("run", 8.0) if row["type"] in _RUN_TYPES else fallbacks.get("ride", 2.0)
            trimp = dur_min * fb / 60.0
        daily_trimp[d] = daily_trimp.get(d, 0.0) + trimp

    if not daily_trimp:
        empty = {"ctl": 0, "atl": 0, "ac_ratio": 0, "tsb": 0,
                 "monotony": 0, "rest_days_7d": 7, "weekly_stress": 0, "forecast": []}
        return [], empty

    first_date = dt.date.fromisoformat(min(daily_trimp.keys()))
    today = dt.date.today()
    ninety_days_ago = today - dt.timedelta(days=90)

    ctl_decay = math.exp(-1 / ctl_days)
    atl_decay = math.exp(-1 / atl_days_cfg)
    ctl = atl = 0.0

    load_history = []
    current = first_date
    while current <= today:
        ds = current.isoformat()
        trimp = daily_trimp.get(ds, 0.0)
        ctl = ctl * ctl_decay + trimp * (1 - ctl_decay)
        atl = atl * atl_decay + trimp * (1 - atl_decay)
        if current >= ninety_days_ago:
            load_history.append({
                "date": ds,
                "ctl": round(ctl, 1),
                "atl": round(atl, 1),
                "tsb": round(ctl - atl, 1),
            })
        current += dt.timedelta(days=1)

    # Details
    last7 = [(today - dt.timedelta(days=i)).isoformat() for i in range(7)]
    weekly_stress = round(sum(daily_trimp.get(d, 0) for d in last7), 1)
    rest_days_7d = sum(1 for d in last7 if daily_trimp.get(d, 0) == 0)
    trimps_7 = [daily_trimp.get(d, 0) for d in last7]
    mean_t = sum(trimps_7) / 7.0
    std_t = math.sqrt(sum((t - mean_t) ** 2 for t in trimps_7) / 7.0)
    monotony = round(mean_t / (std_t + 0.001), 2) if mean_t > 0 else 0

    # 7-day rest forecast
    forecast = []
    p_ctl, p_atl = ctl, atl
    for i in range(1, 8):
        p_ctl *= ctl_decay
        p_atl *= atl_decay
        forecast.append({
            "date": (today + dt.timedelta(days=i)).isoformat(),
            "tsb": round(p_ctl - p_atl, 1),
            "ac_ratio": round(p_atl / p_ctl, 2) if p_ctl > 0 else 0,
        })

    details = {
        "ctl": round(ctl, 1), "atl": round(atl, 1),
        "ac_ratio": round(atl / ctl, 2) if ctl > 0 else 0,
        "tsb": round(ctl - atl, 1),
        "monotony": monotony, "rest_days_7d": rest_days_7d,
        "weekly_stress": weekly_stress, "forecast": forecast,
    }
    return load_history, details


# ─── 辅助：近期状态（本周 vs 上周） ───────────────────────────────────────────

def _compute_recent_form(conn, active_types: list, athlete_metrics: dict) -> dict:
    max_hr = athlete_metrics.get("max_hr", 190)
    fallbacks = athlete_metrics["analysis"]["training_load"].get("trimp_fallbacks", {"run": 8.0, "ride": 2.0})
    today = dt.date.today()
    start_this = today - dt.timedelta(days=today.weekday())
    start_last = start_this - dt.timedelta(days=7)
    ph = ",".join(["?"] * len(active_types))

    def week_stats(start, end):
        cur = conn.cursor()
        cur.execute(
            f"SELECT distance, moving_time, average_heartrate, type, "
            f"date(start_date_local) AS d "
            f"FROM activities WHERE type IN ({ph}) "
            f"AND d >= ? AND d < ?",
            (*active_types, start.isoformat(), end.isoformat()),
        )
        rows = cur.fetchall()
        dist = sum(r["distance"] or 0 for r in rows) / 1000.0
        count = len(rows)
        stress = 0.0
        active_days = set()
        for r in rows:
            active_days.add(r["d"])
            dur_min = row_to_seconds(r["moving_time"] or "") / 60.0
            if r["average_heartrate"] and r["average_heartrate"] > 0:
                hr_ratio = r["average_heartrate"] / max_hr
                stress += dur_min * hr_ratio * 0.64 * math.exp(1.92 * hr_ratio)
            else:
                fb = fallbacks.get("run", 8.0) if r["type"] in _RUN_TYPES else fallbacks.get("ride", 2.0)
                stress += dur_min * fb / 60.0
        consistency = [
            1 if (start + dt.timedelta(days=i)).isoformat() in active_days else 0
            for i in range(7)
        ]
        return {"distance": round(dist, 1), "stress": round(stress, 1),
                "count": count, "consistency": consistency}

    this_w = week_stats(start_this, start_this + dt.timedelta(days=7))
    last_w = week_stats(start_last, start_this)
    return {
        "this_week": this_w,
        "last_week": {"distance": last_w["distance"], "stress": last_w["stress"], "count": last_w["count"]},
    }


# ─── 辅助：距离分布 ───────────────────────────────────────────────────────────

def _compute_distance_breakdown(conn, active_types: list, is_run: bool) -> list:
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(f"SELECT distance FROM activities WHERE type IN ({ph}) AND distance > 0", tuple(active_types))
    kms = [r["distance"] / 1000.0 for r in cur.fetchall()]

    if is_run:
        bins = [(0, 5, "0-5km"), (5, 10, "5-10km"), (10, 15, "10-15km"),
                (15, 21.1, "15-21km"), (21.1, 30, "21-30km"), (30, 42.2, "30-42km"), (42.2, 9999, "42+km")]
    else:
        bins = [(0, 20, "0-20km"), (20, 40, "20-40km"), (40, 60, "40-60km"),
                (60, 80, "60-80km"), (80, 100, "80-100km"), (100, 9999, "100+km")]

    result = []
    for lo, hi, label in bins:
        count = sum(1 for k in kms if lo <= k < hi)
        result.append({"label": label, "count": count})
    return result


# ─── 辅助：心率区间 ───────────────────────────────────────────────────────────

def _compute_hr_zones(conn, active_types: list, max_hr: int) -> list:
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT average_heartrate FROM activities WHERE type IN ({ph}) AND average_heartrate > 0",
        tuple(active_types),
    )
    hrs = [r["average_heartrate"] for r in cur.fetchall()]
    zones = [
        ("Z1 <60%", 0, max_hr * 0.60),
        ("Z2 60-70%", max_hr * 0.60, max_hr * 0.70),
        ("Z3 70-80%", max_hr * 0.70, max_hr * 0.80),
        ("Z4 80-90%", max_hr * 0.80, max_hr * 0.90),
        ("Z5 90%+", max_hr * 0.90, 9999),
    ]
    return [{"zone": z, "count": sum(1 for h in hrs if lo <= h < hi)} for z, lo, hi in zones]


# ─── 辅助：月度同比 ───────────────────────────────────────────────────────────

def _compute_period_comparison(conn, active_types: list) -> list:
    today = dt.date.today()
    this_yr = str(today.year)
    last_yr = str(today.year - 1)
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT strftime('%Y', start_date_local) AS yr, "
        f"strftime('%m', start_date_local) AS mo, "
        f"COALESCE(SUM(distance), 0) AS dist "
        f"FROM activities WHERE type IN ({ph}) AND yr IN (?, ?) "
        f"GROUP BY yr, mo",
        (*active_types, this_yr, last_yr),
    )
    data = {(r["yr"], r["mo"]): r["dist"] / 1000.0 for r in cur.fetchall()}
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return [
        {"month": m, "this_year": round(data.get((this_yr, f"{i+1:02d}"), 0), 1),
         "last_year": round(data.get((last_yr, f"{i+1:02d}"), 0), 1)}
        for i, m in enumerate(months)
    ]


# ─── 辅助：生物统计 ───────────────────────────────────────────────────────────

def _compute_bio_stats(conn, active_types: list, athlete_metrics: dict) -> dict:
    weight = athlete_metrics.get("weight", 70)
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()

    cur.execute(
        f"SELECT type, COALESCE(SUM(distance), 0) AS dist FROM activities WHERE type IN ({ph}) GROUP BY type",
        tuple(active_types),
    )
    total_cal = 0
    run_dist_km = 0.0
    for r in cur.fetchall():
        dk = (r["dist"] or 0) / 1000.0
        if r["type"] in _RUN_TYPES:
            total_cal += int(dk * weight * 1.036)
            run_dist_km += dk
        else:
            total_cal += int(dk * weight * 0.5)

    is_run = any(t in _RUN_TYPES for t in active_types)
    estimated_steps = int(run_dist_km * 1350) if is_run else 0

    # Average cadence
    cur.execute(
        f"SELECT AVG(average_cadence) AS cad FROM activities WHERE type IN ({ph}) AND average_cadence > 0",
        tuple(active_types),
    )
    r = cur.fetchone()
    avg_cad = round(r["cad"]) if r and r["cad"] else 0

    # Cadence trend (last month vs month before)
    today = dt.date.today()
    m1_start = today.replace(day=1).isoformat()
    prev = (today.replace(day=1) - dt.timedelta(days=1))
    m2_start = prev.replace(day=1).isoformat()
    m3_start = ((prev.replace(day=1) - dt.timedelta(days=1)).replace(day=1)).isoformat()

    def avg_cad_range(start, end):
        cur2 = conn.cursor()
        cur2.execute(
            f"SELECT AVG(average_cadence) AS c FROM activities "
            f"WHERE type IN ({ph}) AND date(start_date_local) >= ? AND date(start_date_local) < ? AND average_cadence > 0",
            (*active_types, start, end),
        )
        r2 = cur2.fetchone()
        return r2["c"] if r2 and r2["c"] else 0

    last_c = avg_cad_range(m2_start, m1_start)
    prev_c = avg_cad_range(m3_start, m2_start)
    cadence_trend = round(((last_c - prev_c) / prev_c * 100) if prev_c > 0 else 0, 1)

    # Cadence distribution
    cur.execute(
        f"SELECT average_cadence FROM activities WHERE type IN ({ph}) AND average_cadence > 0",
        tuple(active_types),
    )
    cad_vals = [r["average_cadence"] for r in cur.fetchall()]

    if is_run:
        bins = [(140, 160, "140-160"), (160, 170, "160-170"), (170, 175, "170-175"),
                (175, 180, "175-180"), (180, 190, "180-190"), (190, 999, "190+")]
        cad_type = "STEP FREQUENCY"
    else:
        bins = [(50, 70, "50-70"), (70, 80, "70-80"), (80, 90, "80-90"),
                (90, 100, "90-100"), (100, 110, "100-110"), (110, 999, "110+")]
        cad_type = "PEDAL CADENCE"

    cad_dist = [{"label": lbl, "count": sum(1 for c in cad_vals if lo <= c < hi)}
                for lo, hi, lbl in bins]

    cur.execute(
        f"SELECT COALESCE(SUM(elevation_gain), 0) AS total_elev FROM activities WHERE type IN ({ph})",
        tuple(active_types),
    )
    elev_r = cur.fetchone()
    total_elevation_m = round(elev_r["total_elev"] or 0)

    return {
        "estimated_steps": estimated_steps, "total_calories": total_cal,
        "weight": weight, "avg_cadence": avg_cad,
        "cadence_trend": cadence_trend, "cadence_distribution": cad_dist,
        "cadence_type": cad_type,
        "total_elevation_m": total_elevation_m,
    }


# ─── 辅助：活动时间模式 ───────────────────────────────────────────────────────

def _compute_activity_pattern(conn, active_types: list) -> list:
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT CAST(strftime('%w', start_date_local) AS INTEGER) AS day, "
        f"CAST(strftime('%H', start_date_local) AS INTEGER) AS hour, "
        f"COUNT(*) AS value "
        f"FROM activities WHERE type IN ({ph}) AND start_date_local IS NOT NULL "
        f"GROUP BY day, hour ORDER BY day, hour",
        tuple(active_types),
    )
    return [{"day": r["day"], "hour": r["hour"], "value": r["value"]} for r in cur.fetchall()]


# ─── 辅助：运动员雷达图 ───────────────────────────────────────────────────────

def _compute_athlete_radar(conn, active_types: list, athlete_metrics: dict, recent_activities: list) -> list:
    norms = athlete_metrics["analysis"]["radar_normalization"]
    today = dt.date.today()
    month_ago = (today - dt.timedelta(days=30)).isoformat()
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT COALESCE(SUM(distance), 0) / 1000.0 AS dist, "
        f"COALESCE(SUM(elevation_gain), 0) AS elev, COUNT(*) AS cnt, "
        f"COALESCE(MAX(distance), 0) / 1000.0 AS max_dist, "
        f"COALESCE(AVG(average_heartrate), 0) AS avg_hr, "
        f"COUNT(DISTINCT date(start_date_local)) AS active_days "
        f"FROM activities WHERE type IN ({ph}) AND date(start_date_local) >= ?",
        (*active_types, month_ago),
    )
    r = cur.fetchone()
    monthly_km = (r["dist"] or 0) if r else 0
    monthly_count = (r["cnt"] or 0) if r else 0
    avg_hr = (r["avg_hr"] or 0) if r else 0
    active_days = (r["active_days"] or 0) if r else 0

    # Avg session duration from recent_activities in last 30 days
    recent_30 = [a for a in (recent_activities or []) if (a.get("start_date_local") or "")[:10] >= month_ago]
    total_sec_30 = sum(row_to_seconds(a.get("moving_time", "")) for a in recent_30)
    avg_session_hrs = (total_sec_30 / 3600.0 / max(monthly_count, 1)) if monthly_count > 0 else 0

    # Sport variety in last 30 days
    cur.execute(
        f"SELECT COUNT(DISTINCT type) AS variety FROM activities WHERE type IN ({ph}) AND date(start_date_local) >= ?",
        (*active_types, month_ago),
    )
    r2 = cur.fetchone()
    sport_variety_raw = (r2["variety"] or 1) if r2 else 1

    max_hr_val = athlete_metrics.get("max_hr", 190)

    # 6 axes: Volume, Consistency, Intensity, Duration, Density, Variety
    volume      = min(100, int((monthly_km / norms.get("endurance_monthly_km", 150)) * 100))
    consistency = min(100, int((active_days / 20) * 100))
    intensity   = min(100, int((avg_hr / max_hr_val) * 200)) if avg_hr > 0 else 30
    duration    = min(100, int((avg_session_hrs / 1.5) * 100))
    density     = min(100, int((monthly_km / max(active_days, 1) / 15) * 100))
    variety     = min(100, int((sport_variety_raw / 3) * 100))

    return [
        {"subject": "Volume",      "A": volume},
        {"subject": "Consistency", "A": consistency},
        {"subject": "Intensity",   "A": intensity},
        {"subject": "Duration",    "A": duration},
        {"subject": "Density",     "A": density},
        {"subject": "Variety",     "A": variety},
    ]


# ─── 辅助：装备统计 ───────────────────────────────────────────────────────────

def _compute_gear_stats(conn, active_types: list, athlete_metrics: dict) -> list:
    gears = athlete_metrics.get("gears", [])
    if not gears:
        return []
    today = dt.date.today()
    result = []
    for gear in gears:
        name = gear.get("name", "Gear")
        g_type = gear.get("type", "Run")
        limit = gear.get("limit", 1000)
        g_from = gear.get("active_from", "2000-01-01")
        g_to = gear.get("active_to", "2099-12-31")

        types = [t for t in active_types if
                 (g_type == "Run" and t in _RUN_TYPES) or
                 (g_type == "Ride" and t in _RIDE_TYPES)]
        if not types:
            continue

        ph = ",".join(["?"] * len(types))
        cur = conn.cursor()
        cur.execute(
            f"SELECT COALESCE(SUM(distance), 0) / 1000.0 AS dk, COUNT(*) AS cnt, "
            f"COALESCE(SUM(elevation_gain), 0) AS elev, SUM(moving_time) AS time "
            f"FROM activities WHERE type IN ({ph}) AND date(start_date_local) BETWEEN ? AND ?",
            (*types, g_from, g_to),
        )
        r = cur.fetchone()
        distance = round(r["dk"], 1) if r else 0
        count = r["cnt"] if r else 0
        elevation = round(r["elev"] or 0)
        
        # Format time
        total_sec = row_to_seconds(r["time"]) if r else 0
        days = total_sec // 86400
        hours = (total_sec % 86400) // 3600
        mins = (total_sec % 3600) // 60
        time_str = f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"

        # Monthly distance for this gear (last 6 months)
        monthly = []
        for mo in range(5, -1, -1):
            d = today - dt.timedelta(days=mo * 30)
            ms = d.strftime("%Y-%m")
            cur.execute(
                f"SELECT COALESCE(SUM(distance), 0) / 1000.0 AS dk FROM activities "
                f"WHERE type IN ({ph}) AND strftime('%Y-%m', start_date_local) = ? "
                f"AND date(start_date_local) BETWEEN ? AND ?",
                (*types, ms, g_from, g_to),
            )
            mr = cur.fetchone()
            monthly.append({"month": d.strftime("%b"), "dist": round(mr["dk"], 1) if mr else 0})

        # Components logic
        g_components = []
        for comp in gear.get("components", []):
            c_limit = comp.get("limit", 1000)
            # Simplistic estimate: current distance % limit if smaller than gear limit
            c_dist = distance % c_limit if c_limit < limit else distance
            g_components.append({
                "name": comp.get("name"),
                "distance": round(c_dist, 1),
                "limit": c_limit
            })

        purchase_price = gear.get("purchase_price", 0)
        cost_per_km = round(purchase_price / distance, 2) if distance > 0 and purchase_price > 0 else None

        result.append({
            "name": name,
            "type": g_type,
            "icon": gear.get("icon", "Footprints" if g_type == "Run" else "Bike"),
            "distance": distance,
            "limit": limit,
            "count": count,
            "elevation": elevation,
            "time": time_str,
            "purchase_date": gear.get("purchase_date"),
            "purchase_price": purchase_price,
            "cost_per_km": cost_per_km,
            "monthly_mileage": monthly,
            "components": g_components
        })
    return result


def _compute_recording_stats(conn, active_types: list, athlete_metrics: dict) -> list:
    device_mapping = athlete_metrics["analysis"].get("device_mapping", {})
    
    # Build CASE statement for SQL based on device_mapping
    case_parts = []
    for pattern, label in device_mapping.items():
        case_parts.append(f"WHEN name LIKE '%{pattern}%' THEN '{label}'")
    
    if not case_parts:
        case_stmt = """
            CASE 
                WHEN name LIKE 'Zwift%' THEN 'Zwift'
                WHEN type = 'VirtualRide' THEN 'Virtual Platform'
                WHEN type IN ('Ride', 'VirtualRide', 'Velomobile', 'E-BikeRide') THEN 'Cycling Computer'
                WHEN type IN ('Run', 'TrailRun', 'VirtualRun') THEN 'Running Watch'
                ELSE 'Other App/Device'
            END
        """
    else:
        case_stmt = f"CASE {' '.join(case_parts)} ELSE 'Other Device' END"

    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(f"""
        SELECT 
            ({case_stmt}) as device,
            COUNT(*) as count,
            COALESCE(SUM(distance), 0) / 1000.0 as dist,
            COALESCE(SUM(elevation_gain), 0) as elev,
            SUM(moving_time) as time
        FROM activities
        WHERE type IN ({ph})
        GROUP BY device
        ORDER BY count DESC
    """, (*active_types,))
    
    rows = cur.fetchall()
    result = []
    for r in rows:
        total_sec = row_to_seconds(r["time"])
        days = total_sec // 86400
        hours = (total_sec % 86400) // 3600
        mins = (total_sec % 3600) // 60
        time_str = f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"
        
        result.append({
            "name": r["device"],
            "count": r["count"],
            "distance": round(r["dist"]),
            "elevation": round(r["elev"]),
            "time": time_str
        })
    return result


# ─── 辅助：个人记录 ───────────────────────────────────────────────────────────

def _compute_records(conn, active_types: list) -> tuple:
    records: dict = {}
    dashboard_records: list = []

    run_types = [t for t in active_types if t in _RUN_TYPES]
    ride_types = [t for t in active_types if t in _RIDE_TYPES]

    def format_time(secs):
        h = int(secs // 3600)
        m = int((secs % 3600) // 60)
        s = int(secs % 60)
        return f"{h}:{m:02d}:{s:02d}" if h >= 1 else f"{m}:{s:02d}"

    if run_types:
        ph = ",".join(["?"] * len(run_types))
        for label, target, tol in [("5K", 5000, 250), ("10K", 10000, 400),
                                    ("Half", 21097, 800), ("Marathon", 42195, 1500)]:
            cur = conn.cursor()
            cur.execute(
                f"SELECT run_id, name, moving_time, distance, start_date_local, average_speed "
                f"FROM activities WHERE type IN ({ph}) AND distance BETWEEN ? AND ? "
                f"ORDER BY moving_time ASC LIMIT 1",
                (*run_types, target - tol, target + tol),
            )
            row = cur.fetchone()
            if row:
                secs = row_to_seconds(row["moving_time"])
                dk = (row["distance"] or 0) / 1000.0
                p_sec_km = secs / dk if dk > 0 else 0
                pace = f"{int(p_sec_km // 60)}:{int(p_sec_km % 60):02d}/km"
                date_str = (row["start_date_local"] or "")[:10]
                records[label] = {"moving_time": format_time(secs), "pace": pace,
                                   "name": row["name"], "start_date_local": row["start_date_local"]}
                dashboard_records.append({"name": label, "date": date_str,
                                           "best": format_time(secs), "pace": pace})

    if ride_types:
        ph = ",".join(["?"] * len(ride_types))
        # Labels include " Ride" so Records.jsx filter `name.includes('Ride')` matches them.
        # "30K Ride" / "50K Ride" are also used as predictor baseKey/fallbackKey in Records.jsx.
        for label, target, tol in [
            ("30K Ride", 30000, 500), ("50K Ride", 50000, 1000),
            ("80K Ride", 80000, 2000), ("100K Ride", 100000, 5000),
            ("150K Ride", 150000, 8000),
        ]:
            cur = conn.cursor()
            cur.execute(
                f"SELECT run_id, name, moving_time, distance, start_date_local "
                f"FROM activities WHERE type IN ({ph}) AND distance BETWEEN ? AND ? "
                f"ORDER BY moving_time ASC LIMIT 1",
                (*ride_types, target - tol, target + tol),
            )
            row = cur.fetchone()
            if row:
                secs = row_to_seconds(row["moving_time"])
                dk = (row["distance"] or 0) / 1000.0
                spd = round(dk / (secs / 3600), 1) if secs > 0 else 0
                pace = f"{spd} km/h"
                date_str = (row["start_date_local"] or "")[:10]
                records[label] = {"moving_time": format_time(secs), "pace": pace,
                                   "name": row["name"], "start_date_local": row["start_date_local"]}
                dashboard_records.append({"name": label, "date": date_str,
                                           "best": format_time(secs), "pace": pace})

    return records, dashboard_records[:5]


# ─── 辅助：训练目标 ───────────────────────────────────────────────────────────

def _compute_goals(conn, active_types: list, athlete_metrics: dict) -> list:
    today = dt.date.today()
    year_start = today.replace(month=1, day=1)
    days_elapsed = max((today - year_start).days + 1, 1)
    days_in_year = 366 if today.year % 4 == 0 else 365
    milestones = athlete_metrics["analysis"].get("milestones", {})

    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT COALESCE(SUM(distance), 0) AS dist, COUNT(*) AS cnt "
        f"FROM activities WHERE type IN ({ph}) AND strftime('%Y', start_date_local) = ?",
        (*active_types, str(today.year)),
    )
    r = cur.fetchone()
    cur_dist = (r["dist"] or 0) / 1000.0
    cur_count = r["cnt"] or 0

    if "annual_distance_km" in milestones:
        dist_target = milestones["annual_distance_km"]
    else:
        projected = cur_dist * (days_in_year / days_elapsed)
        dist_target = max(round(projected / 500) * 500, 1000)

    if "annual_activities" in milestones:
        count_target = milestones["annual_activities"]
    else:
        projected_count = cur_count * (days_in_year / days_elapsed)
        count_target = max(round(projected_count / 10) * 10, 50)

    return [
        {"title": f"{today.year} Distance Goal", "current": round(cur_dist),
         "target": int(dist_target), "unit": "km"},
        {"title": "Activity Count", "current": cur_count,
         "target": int(count_target), "unit": "sessions"},
    ]


# ─── 辅助：智能教练建议 ───────────────────────────────────────────────────────

def _compute_smart_coach(training_details: dict):
    if not training_details or training_details.get("ctl", 0) == 0:
        return None
    tsb = training_details["tsb"]
    ac_ratio = training_details["ac_ratio"]
    ctl = training_details["ctl"]

    if ac_ratio > 1.5:
        advice = "⚠️ ATTENTION — A:C ratio dangerously high. Mandatory rest day."
        status = "warning"
    elif tsb > 15:
        advice = "Race Ready — TSB is high. Peak performance window open."
        status = "peak"
    elif tsb > 5:
        advice = "Feeling Fresh — Good time for quality sessions or a race."
        status = "fresh"
    elif tsb > -10:
        advice = "Optimal Build — Training effectively. Maintain consistency."
        status = "optimal"
    elif tsb > -25:
        advice = "Productive Fatigue — Building fitness. Prioritize sleep & nutrition."
        status = "productive"
    else:
        advice = "⚠️ ATTENTION — High fatigue detected. Recovery day strongly advised."
        status = "recovery"

    return {"advice": advice, "status": status, "efficiency": f"{ctl:.0f} CTL"}


# ─── 辅助：daily_stats ────────────────────────────────────────────────────────

def _compute_daily_stats(conn, active_types: list) -> list:
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT date(start_date_local) AS date, type, "
        f"COALESCE(SUM(distance), 0) AS dist, SUM(moving_time) AS time, "
        f"COUNT(*) AS count, COALESCE(SUM(elevation_gain), 0) AS elev "
        f"FROM activities WHERE type IN ({ph}) "
        f"GROUP BY date, type ORDER BY date",
        tuple(active_types),
    )
    return [
        {"date": r["date"], "type": r["type"],
         "dist": r["dist"], "time": row_to_seconds(r["time"]),
         "count": r["count"], "elev": round(r["elev"] or 0)}
        for r in cur.fetchall()
    ]


# ─── 辅助：月度趋势 ───────────────────────────────────────────────────────────

def _compute_monthly_trends(conn, active_types: list) -> list:
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT strftime('%Y-%m', start_date_local) AS month, COUNT(*) AS count, "
        f"COALESCE(SUM(distance), 0) AS dist, COALESCE(SUM(elevation_gain), 0) AS elev, "
        f"SUM(moving_time) AS time "
        f"FROM activities WHERE type IN ({ph}) GROUP BY month ORDER BY month",
        tuple(active_types),
    )
    return [
        {"month": r["month"], "count": r["count"],
         "distance": round((r["dist"] or 0) / 1000.0, 1),
         "elevation": round(r["elev"] or 0),
         "time": round(row_to_seconds(r["time"]) / 3600.0, 1)}
        for r in cur.fetchall()
    ]


# ─── 辅助：年度完整统计 ───────────────────────────────────────────────────────

def _compute_yearly_full(conn, active_types: list) -> list:
    """Per-year totals: distance, elevation, hours, count — with YoY deltas."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT strftime('%Y', start_date_local) AS yr, COUNT(*) AS cnt, "
        f"COALESCE(SUM(distance), 0) / 1000.0 AS dist, "
        f"COALESCE(SUM(elevation_gain), 0) AS elev, "
        f"SUM(moving_time) AS time "
        f"FROM activities WHERE type IN ({ph}) AND yr IS NOT NULL "
        f"GROUP BY yr ORDER BY yr DESC",
        tuple(active_types),
    )
    rows = cur.fetchall()
    result = []
    for i, r in enumerate(rows):
        total_sec = row_to_seconds(r["time"])
        hours = round(total_sec / 3600.0, 1)
        dist = round(r["dist"], 1)
        elev = round(r["elev"] or 0)
        cnt = r["cnt"]
        prev = rows[i + 1] if i + 1 < len(rows) else None
        prev_dist = round(prev["dist"], 1) if prev else 0
        prev_elev = round(prev["elev"] or 0) if prev else 0
        prev_hours = round(row_to_seconds(prev["time"]) / 3600.0, 1) if prev else 0
        result.append({
            "year": r["yr"],
            "count": cnt,
            "distance": dist,
            "elevation": elev,
            "hours": hours,
            "dist_delta": round(dist - prev_dist, 1) if prev else None,
            "elev_delta": elev - prev_elev if prev else None,
            "hours_delta": round(hours - prev_hours, 1) if prev else None,
        })
    return result


# ─── 辅助：每月PB数量 ─────────────────────────────────────────────────────────

def _compute_pbs_per_month(conn, active_types: list) -> list:
    """Count new personal bests set per month (run distances only)."""
    run_types = [t for t in active_types if t in _RUN_TYPES]
    if not run_types:
        return []
    distance_configs = [
        (4750, 5250), (9600, 10400), (20297, 21897), (40695, 43695),
    ]
    pb_months: dict = {}
    ph = ",".join(["?"] * len(run_types))
    cur = conn.cursor()
    for lo, hi in distance_configs:
        cur.execute(
            f"SELECT strftime('%Y-%m', start_date_local) AS month, "
            f"MIN(moving_time) AS best_time "
            f"FROM activities WHERE type IN ({ph}) AND distance BETWEEN ? AND ? "
            f"GROUP BY month ORDER BY month",
            (*run_types, lo, hi),
        )
        best_so_far = None
        for row in cur.fetchall():
            t = row_to_seconds(row["best_time"])
            if t > 0 and (best_so_far is None or t < best_so_far):
                best_so_far = t
                m = row["month"]
                pb_months[m] = pb_months.get(m, 0) + 1
    return [{"month": m, "pbs": c} for m, c in sorted(pb_months.items())]


# ─── 辅助：HR恢复 / 有氧效率趋势 ────────────────────────────────────────────

def _compute_hr_recovery(conn, active_types: list, max_hr: int) -> list:
    """Monthly aerobic efficiency: avg HR % of max + pace/speed per HR beat."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT strftime('%Y-%m', start_date_local) AS month, type, "
        f"AVG(average_heartrate) AS avg_hr, AVG(distance) AS avg_dist, "
        f"AVG(moving_time) AS avg_time, COUNT(*) AS cnt "
        f"FROM activities WHERE type IN ({ph}) AND average_heartrate > 0 "
        f"GROUP BY month ORDER BY month",
        tuple(active_types),
    )
    rows = cur.fetchall()
    result = []
    for r in rows:
        avg_hr = r["avg_hr"] or 0
        hr_pct = round(avg_hr / max_hr * 100, 1) if max_hr > 0 else 0
        avg_dist_km = (r["avg_dist"] or 0) / 1000.0
        avg_sec = row_to_seconds(r["avg_time"] or "")
        # HR efficiency: km per % HR (higher = better aerobic fitness)
        hr_eff = round(avg_dist_km / hr_pct, 3) if hr_pct > 0 else 0
        result.append({
            "month": r["month"],
            "avg_hr": round(avg_hr, 1),
            "hr_pct": hr_pct,
            "hr_efficiency": hr_eff,
            "count": r["cnt"],
        })
    return result


# ─── 辅助：重复路线追踪 ───────────────────────────────────────────────────────

def _compute_repeat_routes(conn, active_types: list) -> list:
    """Group similar activities (same city, similar distance) as 'repeat routes'."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT name, location_city, location_country, distance, "
        f"date(start_date_local) AS d, type "
        f"FROM activities WHERE type IN ({ph}) AND distance > 1000 "
        f"ORDER BY d DESC",
        tuple(active_types),
    )
    rows = cur.fetchall()

    buckets: dict = {}
    for r in rows:
        city = r["location_city"] or r["location_country"] or "Unknown"
        dist_km = (r["distance"] or 0) / 1000.0
        bucket_km = round(dist_km)  # round to nearest km
        key = (city, bucket_km, r["type"])
        if key not in buckets:
            buckets[key] = {"city": city, "distance_km": bucket_km, "type": r["type"],
                            "count": 0, "dates": [], "names": []}
        b = buckets[key]
        b["count"] += 1
        if r["d"] and len(b["dates"]) < 3:
            b["dates"].append(r["d"])
        if r["name"] and r["name"] not in b["names"] and len(b["names"]) < 2:
            b["names"].append(r["name"])

    # Return routes done at least 3 times, sorted by count
    repeated = [v for v in buckets.values() if v["count"] >= 3]
    repeated.sort(key=lambda x: x["count"], reverse=True)
    return repeated[:20]


# ─── 辅助：训练DNA ────────────────────────────────────────────────────────────

def _compute_training_dna(conn, active_types: list, athlete_metrics: dict,
                          weekday_preference: list, time_preference: list) -> dict:
    """Build a personalised training identity card."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()

    # Dominant sport
    cur.execute(f"SELECT type, COUNT(*) AS cnt FROM activities WHERE type IN ({ph}) GROUP BY type ORDER BY cnt DESC LIMIT 1", tuple(active_types))
    r = cur.fetchone()
    dominant_sport = r["type"] if r else (active_types[0] if active_types else "Run")

    # Favourite weekday
    fav_wd = max(weekday_preference, key=lambda x: x["count"]) if weekday_preference else {"day": "—", "weekday": -1}
    days_full = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    fav_day = days_full[fav_wd["weekday"]] if 0 <= fav_wd.get("weekday", -1) <= 6 else "—"

    # Favourite time slot
    tp_sorted = sorted(time_preference, key=lambda x: x["count"], reverse=True)
    fav_hour = tp_sorted[0]["slot"] if tp_sorted else 0
    if 5 <= fav_hour < 10: time_label = "Early Bird"
    elif 10 <= fav_hour < 14: time_label = "Midday Runner"
    elif 14 <= fav_hour < 18: time_label = "Afternoon Crusher"
    else: time_label = "Night Owl"

    # Avg distance
    cur.execute(f"SELECT AVG(distance) AS avg_d FROM activities WHERE type IN ({ph}) AND distance > 0", tuple(active_types))
    r2 = cur.fetchone()
    avg_dist = round((r2["avg_d"] or 0) / 1000.0, 1) if r2 else 0

    # Style: based on avg distance + avg HR availability
    cur.execute(f"SELECT AVG(distance) AS d, AVG(moving_time) AS t FROM activities WHERE type IN ({ph})", tuple(active_types))
    r3 = cur.fetchone()
    avg_d_m = r3["d"] or 0
    avg_t_s = row_to_seconds(r3["t"] or "") if r3 else 0

    if avg_d_m > 15000:
        style = "Long Distance Endurance"
    elif avg_d_m > 8000 and avg_t_s > 2400:
        style = "Balanced All-Rounder"
    elif avg_d_m < 5000:
        style = "Speed & Short Efforts"
    else:
        style = "Mid-Distance Builder"

    # Total years active
    cur.execute(f"SELECT MIN(date(start_date_local)) AS first, MAX(date(start_date_local)) AS last FROM activities WHERE type IN ({ph})", tuple(active_types))
    r4 = cur.fetchone()
    first_date = r4["first"] if r4 else None
    years_active = 0
    if first_date:
        try:
            years_active = round((dt.date.today() - dt.date.fromisoformat(first_date)).days / 365.25, 1)
        except Exception:
            pass

    # Total activities
    cur.execute(f"SELECT COUNT(*) AS cnt FROM activities WHERE type IN ({ph})", tuple(active_types))
    total = cur.fetchone()["cnt"] or 0

    # Consistency grade based on active weeks / total weeks
    if first_date:
        try:
            total_weeks = max(1, (dt.date.today() - dt.date.fromisoformat(first_date)).days // 7)
            cur.execute(
                f"SELECT COUNT(DISTINCT strftime('%Y-%W', start_date_local)) AS active_wks "
                f"FROM activities WHERE type IN ({ph})", tuple(active_types)
            )
            aw = cur.fetchone()["active_wks"] or 0
            consistency_pct = min(100, int(aw / total_weeks * 100))
            if consistency_pct >= 80: grade = "A"
            elif consistency_pct >= 65: grade = "B"
            elif consistency_pct >= 50: grade = "C"
            elif consistency_pct >= 35: grade = "D"
            else: grade = "F"
        except Exception:
            grade = "—"
            consistency_pct = 0
    else:
        grade = "—"
        consistency_pct = 0

    return {
        "dominant_sport": dominant_sport,
        "fav_day": fav_day,
        "fav_hour": fav_hour,
        "time_label": time_label,
        "avg_distance": avg_dist,
        "style": style,
        "years_active": years_active,
        "total_activities": total,
        "consistency_grade": grade,
        "consistency_pct": consistency_pct,
    }


# ─── 辅助：海拔成就墙 ─────────────────────────────────────────────────────────

def _compute_elevation_trophies(conn, active_types: list) -> dict:
    """Top elevation achievements: single activity, best week, best month."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()

    # Top 5 activities by elevation
    cur.execute(
        f"SELECT name, elevation_gain, distance, date(start_date_local) AS d, type "
        f"FROM activities WHERE type IN ({ph}) AND elevation_gain > 0 "
        f"ORDER BY elevation_gain DESC LIMIT 5",
        tuple(active_types),
    )
    top_activities = [
        {"name": r["name"], "elevation": round(r["elevation_gain"]),
         "distance": round((r["distance"] or 0) / 1000.0, 1),
         "date": r["d"], "type": r["type"]}
        for r in cur.fetchall()
    ]

    # Best week (7-day rolling)
    cur.execute(
        f"SELECT strftime('%Y-%W', start_date_local) AS wk, "
        f"SUM(elevation_gain) AS total_elev "
        f"FROM activities WHERE type IN ({ph}) AND elevation_gain > 0 "
        f"GROUP BY wk ORDER BY total_elev DESC LIMIT 1",
        tuple(active_types),
    )
    bw = cur.fetchone()
    best_week_elev = round(bw["total_elev"]) if bw else 0
    best_week_label = bw["wk"] if bw else "—"

    # Best month
    cur.execute(
        f"SELECT strftime('%Y-%m', start_date_local) AS mo, "
        f"SUM(elevation_gain) AS total_elev "
        f"FROM activities WHERE type IN ({ph}) AND elevation_gain > 0 "
        f"GROUP BY mo ORDER BY total_elev DESC LIMIT 1",
        tuple(active_types),
    )
    bm = cur.fetchone()
    best_month_elev = round(bm["total_elev"]) if bm else 0
    best_month_label = bm["mo"] if bm else "—"

    # Monthly elevation trend (last 12 months)
    cur.execute(
        f"SELECT strftime('%Y-%m', start_date_local) AS mo, "
        f"COALESCE(SUM(elevation_gain), 0) AS total_elev "
        f"FROM activities WHERE type IN ({ph}) "
        f"AND start_date_local >= date('now', '-12 months') "
        f"GROUP BY mo ORDER BY mo",
        tuple(active_types),
    )
    monthly_trend = [{"month": r["mo"], "elevation": round(r["total_elev"])} for r in cur.fetchall()]

    return {
        "top_activities": top_activities,
        "best_week_elev": best_week_elev,
        "best_week_label": best_week_label,
        "best_month_elev": best_month_elev,
        "best_month_label": best_month_label,
        "monthly_trend": monthly_trend,
    }


# ─── 辅助：竞赛就绪评分 ───────────────────────────────────────────────────────

def _compute_race_readiness(training_details: dict) -> dict:
    """Composite race readiness score 0-100 from training metrics."""
    if not training_details or training_details.get("ctl", 0) == 0:
        return {"score": 0, "label": "No Data", "color": "#6b7280", "components": []}

    tsb = training_details.get("tsb", 0)
    ac_ratio = training_details.get("ac_ratio", 1.0)
    ctl = training_details.get("ctl", 0)
    monotony = training_details.get("monotony", 0)

    # TSB score (form window)
    if 5 < tsb <= 20: tsb_score = 100
    elif 0 < tsb <= 5: tsb_score = 85
    elif -10 < tsb <= 0: tsb_score = 70
    elif -25 < tsb <= -10: tsb_score = 45
    else: tsb_score = 20

    # A:C ratio score
    if 0.8 <= ac_ratio <= 1.3: ac_score = 100
    elif 0.6 <= ac_ratio < 0.8: ac_score = 65
    elif 1.3 < ac_ratio <= 1.5: ac_score = 60
    else: ac_score = 25

    # CTL fitness score (normalised to 100 scale, 70 CTL = 100)
    ctl_score = min(100, int(ctl / 70 * 100))

    # Monotony score
    if monotony < 1.0: mono_score = 100
    elif monotony < 1.5: mono_score = 80
    elif monotony < 2.0: mono_score = 55
    else: mono_score = 25

    overall = int(tsb_score * 0.40 + ac_score * 0.30 + ctl_score * 0.20 + mono_score * 0.10)

    if overall >= 80: label, color = "Race Ready", "#10b981"
    elif overall >= 65: label, color = "On Track", "#06b6d4"
    elif overall >= 45: label, color = "Building", "#f59e0b"
    else: label, color = "Recovery", "#ef4444"

    return {
        "score": overall,
        "label": label,
        "color": color,
        "components": [
            {"name": "Form (TSB)", "score": tsb_score, "value": f"{tsb:+.1f}", "weight": 40},
            {"name": "Load Balance", "score": ac_score, "value": f"{ac_ratio:.2f}", "weight": 30},
            {"name": "Fitness (CTL)", "score": ctl_score, "value": f"{ctl:.0f}", "weight": 20},
            {"name": "Variety", "score": mono_score, "value": f"{monotony:.1f}", "weight": 10},
        ]
    }


# ─── 辅助：4周训练块 ──────────────────────────────────────────────────────────

def _compute_weekly_blocks(conn, active_types: list, athlete_metrics: dict) -> list:
    """Last 4 complete weeks + current partial week, with per-week stats."""
    max_hr = athlete_metrics.get("max_hr", 190)
    fallbacks = athlete_metrics["analysis"]["training_load"].get("trimp_fallbacks", {"run": 8.0, "ride": 2.0})
    today = dt.date.today()
    ph = ",".join(["?"] * len(active_types))
    result = []

    for wi in range(4, -1, -1):
        if wi == 0:
            # Current week (partial): Mon–today
            week_start = today - dt.timedelta(days=today.weekday())
            week_end = today
            label = "This Week"
        else:
            week_end = today - dt.timedelta(days=today.weekday() + 1 + (wi - 1) * 7)
            week_start = week_end - dt.timedelta(days=6)
            label = f"W-{wi}"

        cur = conn.cursor()
        cur.execute(
            f"SELECT distance, moving_time, elevation_gain, type, average_heartrate "
            f"FROM activities WHERE type IN ({ph}) "
            f"AND date(start_date_local) BETWEEN ? AND ?",
            (*active_types, week_start.isoformat(), week_end.isoformat()),
        )
        rows = cur.fetchall()

        dist = sum((r["distance"] or 0) for r in rows) / 1000.0
        elev = sum((r["elevation_gain"] or 0) for r in rows)
        count = len(rows)
        trimp = 0.0
        for r in rows:
            dur_min = row_to_seconds(r["moving_time"] or "") / 60.0
            if r["average_heartrate"] and r["average_heartrate"] > 0:
                hr_ratio = r["average_heartrate"] / max_hr
                trimp += dur_min * hr_ratio * 0.64 * math.exp(1.92 * hr_ratio)
            else:
                fb = fallbacks.get("run", 8.0) if r["type"] in _RUN_TYPES else fallbacks.get("ride", 2.0)
                trimp += dur_min * fb / 60.0

        result.append({
            "label": label,
            "start": week_start.isoformat(),
            "end": week_end.isoformat(),
            "distance": round(dist, 1),
            "elevation": round(elev),
            "count": count,
            "trimp": round(trimp, 1),
        })

    return result


# ─── 辅助：季节性表现 ─────────────────────────────────────────────────────────

def _compute_seasonal_performance(conn, active_types: list) -> list:
    """Quarterly performance averages — used as weather/season proxy."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT CAST(strftime('%m', start_date_local) AS INTEGER) AS mo, "
        f"COUNT(*) AS cnt, "
        f"COALESCE(SUM(distance), 0) / 1000.0 AS dist, "
        f"MIN(CASE WHEN distance BETWEEN 4750 AND 5250 THEN moving_time ELSE NULL END) AS best_5k "
        f"FROM activities WHERE type IN ({ph}) AND distance > 0 "
        f"GROUP BY mo ORDER BY mo",
        tuple(active_types),
    )
    months = {r["mo"]: r for r in cur.fetchall()}
    quarter_map = {1: "Q1 Winter", 2: "Q1 Winter", 3: "Q2 Spring",
                   4: "Q2 Spring", 5: "Q2 Spring", 6: "Q3 Summer",
                   7: "Q3 Summer", 8: "Q3 Summer", 9: "Q4 Autumn",
                   10: "Q4 Autumn", 11: "Q4 Autumn", 12: "Q1 Winter"}
    quarters: dict = {}
    for mo in range(1, 13):
        q = quarter_map[mo]
        r = months.get(mo, {})
        if q not in quarters:
            quarters[q] = {"quarter": q, "count": 0, "distance": 0.0, "best_5k_sec": None}
        quarters[q]["count"] += r.get("cnt", 0) or 0
        quarters[q]["distance"] = round(quarters[q]["distance"] + (r.get("dist", 0) or 0), 1)
        raw_5k = r.get("best_5k") if r else None
        if raw_5k:
            sec = row_to_seconds(raw_5k)
            if sec > 0 and (quarters[q]["best_5k_sec"] is None or sec < quarters[q]["best_5k_sec"]):
                quarters[q]["best_5k_sec"] = sec

    result = []
    for q_label in ["Q1 Winter", "Q2 Spring", "Q3 Summer", "Q4 Autumn"]:
        d = quarters.get(q_label, {"quarter": q_label, "count": 0, "distance": 0.0, "best_5k_sec": None})
        pace_str = None
        if d["best_5k_sec"]:
            pace_per_km = d["best_5k_sec"] / 5.0
            pace_str = f"{int(pace_per_km // 60)}:{int(pace_per_km % 60):02d}"
        result.append({
            "quarter": q_label,
            "count": d["count"],
            "distance": d["distance"],
            "best_5k_pace": pace_str,
            "best_5k_sec": d["best_5k_sec"],
        })
    return result


# ─── 辅助：里程碑时间轴 ───────────────────────────────────────────────────────

def _compute_milestones_timeline(conn, active_types: list) -> list:
    """Generate a timeline of achievement milestones."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT date(start_date_local) AS d, distance, type, location_country "
        f"FROM activities WHERE type IN ({ph}) AND d IS NOT NULL "
        f"ORDER BY d ASC",
        tuple(active_types),
    )
    rows = cur.fetchall()
    if not rows:
        return []

    milestones = []
    cum_dist = 0.0
    cum_count = 0
    next_dist_milestone = 500
    next_count_milestone = 100
    countries_seen: set = set()

    for row in rows:
        d = row["d"]
        cum_dist += (row["distance"] or 0) / 1000.0
        cum_count += 1
        country = row["location_country"] or ""

        # First activity ever
        if cum_count == 1:
            milestones.append({
                "date": d, "type": "first", "icon": "🚀",
                "title": "First Activity",
                "description": f"Logged your very first {row['type']} activity."
            })

        # Country firsts
        if country and country not in countries_seen:
            countries_seen.add(country)
            if len(countries_seen) > 1:
                milestones.append({
                    "date": d, "type": "country", "icon": "🌍",
                    "title": f"New Country: {country}",
                    "description": f"First activity recorded in {country}."
                })

        # Cumulative distance milestones
        while cum_dist >= next_dist_milestone:
            milestones.append({
                "date": d, "type": "distance", "icon": "🏅",
                "title": f"{next_dist_milestone:,} km Total",
                "description": f"Reached {next_dist_milestone:,} km lifetime distance."
            })
            next_dist_milestone += 500 if next_dist_milestone < 2000 else (1000 if next_dist_milestone < 10000 else 5000)

        # Activity count milestones
        while cum_count >= next_count_milestone:
            milestones.append({
                "date": d, "type": "count", "icon": "🎯",
                "title": f"{next_count_milestone} Activities",
                "description": f"Completed {next_count_milestone} activities."
            })
            next_count_milestone += 100 if next_count_milestone < 500 else (250 if next_count_milestone < 1000 else 500)

    # Sort by date descending for display
    milestones.sort(key=lambda x: x["date"], reverse=True)
    return milestones[:50]


# ─── 辅助：配速演变 ───────────────────────────────────────────────────────────

def _compute_pace_evolution(conn, active_types: list) -> dict:
    """Monthly best pace for standard race distances (run types only)."""
    run_types = [t for t in active_types if t in _RUN_TYPES]
    if not run_types:
        return {}
    ph = ",".join(["?"] * len(run_types))
    result = {}
    for label, target, tol in [("5K", 5000, 250), ("10K", 10000, 400),
                                 ("Half", 21097, 800), ("Marathon", 42195, 1500)]:
        cur = conn.cursor()
        cur.execute(
            f"SELECT strftime('%Y-%m', start_date_local) AS month, "
            f"MIN(moving_time) AS best_time, distance "
            f"FROM activities WHERE type IN ({ph}) AND distance BETWEEN ? AND ? "
            f"GROUP BY month ORDER BY month",
            (*run_types, target - tol, target + tol),
        )
        rows = cur.fetchall()
        data = []
        for row in rows:
            secs = row_to_seconds(row["best_time"])
            dk = (row["distance"] or target) / 1000.0
            if secs > 0 and dk > 0:
                pace_sec = secs / dk  # sec/km
                data.append({
                    "month": row["month"],
                    "pace_sec": round(pace_sec),
                    "pace_str": f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}",
                    "time_str": f"{int(secs // 60)}:{int(secs % 60):02d}",
                })
        if data:
            result[label] = data
    return result


# ─── 辅助：活动版图（国家/地区统计） ─────────────────────────────────────────

def _compute_activity_world(conn, active_types: list) -> list:
    """Count activities and distance per country."""
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT location_country AS country, COUNT(*) AS count, "
        f"COALESCE(SUM(distance), 0) / 1000.0 AS dist "
        f"FROM activities WHERE type IN ({ph}) AND location_country IS NOT NULL AND location_country != '' "
        f"GROUP BY country ORDER BY count DESC",
        tuple(active_types),
    )
    return [
        {"country": r["country"], "count": r["count"], "distance": round(r["dist"], 1)}
        for r in cur.fetchall()
    ]


# ─── 辅助：功率历史 ───────────────────────────────────────────────────────────

def _compute_power_history(conn, active_types: list) -> list:
    """Annual best average power and estimated FTP for ride activities."""
    ride_types = [t for t in active_types if t in _RIDE_TYPES]
    if not ride_types:
        return []
    ph = ",".join(["?"] * len(ride_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT strftime('%Y', start_date_local) AS yr, "
        f"MAX(average_watts) AS best_watts, AVG(average_watts) AS avg_watts "
        f"FROM activities WHERE type IN ({ph}) AND average_watts > 0 "
        f"GROUP BY yr ORDER BY yr ASC",
        tuple(ride_types),
    )
    result = []
    for r in cur.fetchall():
        best = int(r["best_watts"] or 0)
        ftp_est = int(best * 0.95)  # FTP ≈ 95% of best avg watts
        result.append({
            "year": r["yr"],
            "best_watts": best,
            "avg_watts": round(r["avg_watts"] or 0),
            "ftp_estimate": ftp_est,
        })
    return result


# ─── 辅助：breakdown ─────────────────────────────────────────────────────────

def _compute_breakdown(conn, active_types: list) -> dict:
    ph = ",".join(["?"] * len(active_types))
    cur = conn.cursor()
    cur.execute(
        f"SELECT type, COUNT(*) AS cnt, COALESCE(SUM(distance), 0) AS dist "
        f"FROM activities WHERE type IN ({ph}) GROUP BY type",
        tuple(active_types),
    )
    return {r["type"]: {"count": r["cnt"], "dist": r["dist"]} for r in cur.fetchall()}


# ─── 辅助：records_trends ────────────────────────────────────────────────────

def _compute_records_trends(conn, active_types: list) -> dict:
    """每个标准距离各年度最佳成绩（用于 Records 页年度趋势图）。"""
    result: dict = {}

    run_types = [t for t in active_types if t in _RUN_TYPES]
    if run_types:
        ph = ",".join(["?"] * len(run_types))
        for label, target, tol in [("5K", 5000, 250), ("10K", 10000, 400),
                                    ("Half", 21097, 800), ("Marathon", 42195, 1500)]:
            cur = conn.cursor()
            cur.execute(
                f"SELECT strftime('%Y', start_date_local) AS year, MIN(moving_time) AS best_time "
                f"FROM activities WHERE type IN ({ph}) AND distance BETWEEN ? AND ? "
                f"GROUP BY year ORDER BY year ASC",
                (*run_types, target - tol, target + tol),
            )
            rows = cur.fetchall()
            if rows:
                result[label] = [{"date": r["year"], "seconds": row_to_seconds(r["best_time"])} for r in rows]

    ride_types = [t for t in active_types if t in _RIDE_TYPES]
    if ride_types:
        ph = ",".join(["?"] * len(ride_types))
        for label, target, tol in [
            ("30K Ride", 30000, 500), ("50K Ride", 50000, 1000),
            ("80K Ride", 80000, 2000), ("100K Ride", 100000, 5000),
            ("150K Ride", 150000, 8000),
        ]:
            cur = conn.cursor()
            cur.execute(
                f"SELECT strftime('%Y', start_date_local) AS year, MIN(moving_time) AS best_time "
                f"FROM activities WHERE type IN ({ph}) AND distance BETWEEN ? AND ? "
                f"GROUP BY year ORDER BY year ASC",
                (*ride_types, target - tol, target + tol),
            )
            rows = cur.fetchall()
            if rows:
                result[label] = [{"date": r["year"], "seconds": row_to_seconds(r["best_time"])} for r in rows]

    return result


# ─── Strava 运动员缓存（代理到 strava_service 统一实现） ──────────────────────
# 原本此处有独立的 _ATHLETE_CACHE + token refresh 逻辑，
# 现统一使用 strava_service.get_strava_athlete_cached，避免双份缓存。

from run_page.services.strava_service import get_strava_athlete_cached  # noqa: F401


# ─── Main Route ───────────────────────────────────────────────────────────────

@router.get("/stats")
def get_sports_stats(sport_type: Optional[str] = Query(None)):
    cache_key = f"stats:{sport_type or 'all'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    active_types, is_run_active, is_ride_active = resolve_active_types(sport_type)
    ph = ",".join(["?"] * len(active_types))
    filter_sql = f"type IN ({ph})"

    conn = get_db_conn()
    if not conn:
        return {"total_distance": 0, "total_count": 0, "recent_activities": [],
                "heatmap": {}, "yearly": {}}

    try:
        cur = conn.cursor()
        athlete_metrics = get_athlete_metrics()
        max_hr = athlete_metrics.get("max_hr", 190)
        weight = athlete_metrics.get("weight", 70)
        cal_factors = athlete_metrics["analysis"]["calorie_factors"]

        # 1. Basic aggregates
        cur.execute(
            f"SELECT COUNT(*) AS count, COALESCE(SUM(distance), 0) AS dist "
            f"FROM activities WHERE {filter_sql}",
            (*active_types,),
        )
        agg = cur.fetchone()
        total_count = agg["count"] or 0
        total_distance = (agg["dist"] or 0) / 1000.0

        # 2. Recent activities (up to 2000)
        cur.execute(
            f"SELECT run_id, name, distance, moving_time, type, start_date_local, "
            f"summary_polyline, average_heartrate, max_speed, location_country, "
            f"location_city, commute, workout_type, elevation_gain, average_cadence, average_watts "
            f"FROM activities WHERE {filter_sql} "
            f"ORDER BY start_date_local DESC LIMIT 2000",
            (*active_types,),
        )
        recent = []
        for row in cur.fetchall():
            d = dict(row)
            mt = d.get("moving_time", "")
            d["moving_time_display"] = mt.split(" ")[1].split(".")[0] if mt and " " in mt else mt
            if d["distance"] and d["distance"] > 0:
                try:
                    t_str = mt.split(" ")[1] if " " in mt else mt
                    h, m, s = map(float, t_str.split(":"))
                    tsec = h * 3600 + m * 60 + s
                    if tsec > 0:
                        dk = d["distance"] / 1000.0
                        if d["type"] in _RUN_TYPES:
                            pace = (tsec / 60.0) / dk
                            d["gap_pace"] = f"{int(pace)}:{int((pace % 1) * 60):02d}/km"
                        elif d["type"] in _RIDE_TYPES:
                            d["gap_pace"] = f"{round(dk / (tsec / 3600.0), 1)} km/h"
                except Exception:
                    pass
            dk2 = (d["distance"] or 0) / 1000.0
            if d["type"] in _RUN_TYPES:
                d["calories"] = int(dk2 * weight * cal_factors.get("run", 1.036))
            elif d["type"] in _RIDE_TYPES:
                d["calories"] = int(dk2 * weight * cal_factors.get("ride", 0.5))
            else:
                d["calories"] = int(dk2 * weight * cal_factors.get("default", 0.8))
            d["location_city"] = format_location(d.get("location_city"), d.get("location_country")) or d.get("location_country") or "—"
            recent.append(d)

        # 3. Yearly
        cur.execute(
            f"SELECT strftime('%Y', start_date_local) AS year, "
            f"COUNT(*) AS count, COALESCE(SUM(distance), 0) AS dist "
            f"FROM activities WHERE {filter_sql} GROUP BY year ORDER BY year DESC",
            (*active_types,),
        )
        yearly = {r["year"]: {"count": r["count"], "distance": r["dist"] / 1000.0}
                  for r in cur.fetchall()}

        # 4. Heatmap (last 365 days)
        cur.execute(
            f"SELECT date(start_date_local) AS date, type, distance, moving_time, elevation_gain "
            f"FROM activities WHERE start_date_local > date('now', '-1 year') AND {filter_sql}",
            (*active_types,),
        )
        heatmap_data: dict = {}
        for r in cur.fetchall():
            d = r["date"]
            if d not in heatmap_data:
                heatmap_data[d] = {"count": 0, "dist": 0.0, "time": 0.0, "elev": 0.0, "cal": 0.0}
            heatmap_data[d]["count"] += 1
            heatmap_data[d]["dist"] += (r["distance"] or 0) / 1000.0
            heatmap_data[d]["time"] += row_to_seconds(r["moving_time"]) / 3600.0
            heatmap_data[d]["elev"] += r["elevation_gain"] or 0
            dk3 = (r["distance"] or 0) / 1000.0
            heatmap_data[d]["cal"] += dk3 * weight * (1.036 if r["type"] in _RUN_TYPES else 0.5)
        for d in heatmap_data:
            heatmap_data[d] = {k: round(v, 2 if k in ("dist", "time") else (1 if k == "elev" else 0))
                               for k, v in heatmap_data[d].items()}

        # 5. Streaks + current
        cur.execute(
            f"SELECT date(start_date_local) AS activity_date "
            f"FROM activities WHERE {filter_sql} GROUP BY activity_date ORDER BY activity_date",
            (*active_types,),
        )
        streak_dates = [r["activity_date"] for r in cur.fetchall()]
        streaks = calculate_streaks_detailed(streak_dates)

        # 6. Available years
        cur.execute(
            f"SELECT DISTINCT strftime('%Y', start_date_local) AS yr "
            f"FROM activities WHERE yr IS NOT NULL AND {filter_sql} ORDER BY yr DESC",
            (*active_types,),
        )
        available_years = [r["yr"] for r in cur.fetchall()]

        # 7. Photos count
        try:
            photos_count = cur.execute("SELECT COUNT(*) FROM photos").fetchone()[0]
        except Exception:
            photos_count = 0

        # 8. Athlete profile
        try:
            athlete_profile = get_strava_athlete_cached(load_creds())
        except Exception:
            athlete_profile = {"username": "Athlete", "profile": None}

        # ── Computed fields ───────────────────────────────────────────────────
        breakdown = _compute_breakdown(conn, active_types)
        daily_stats = _compute_daily_stats(conn, active_types)
        monthly_trends = _compute_monthly_trends(conn, active_types)
        weekday_preference = []
        cur.execute(
            f"SELECT CAST(strftime('%w', start_date_local) AS INTEGER) AS wd, COUNT(*) AS cnt "
            f"FROM activities WHERE {filter_sql} AND start_date_local IS NOT NULL GROUP BY wd ORDER BY wd",
            (*active_types,),
        )
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        wd_map = {r["wd"]: r["cnt"] for r in cur.fetchall()}
        weekday_preference = [{"day": day_names[i], "weekday": i, "count": wd_map.get(i, 0)} for i in range(7)]

        cur.execute(
            f"SELECT CAST(strftime('%H', start_date_local) AS INTEGER) AS hr, COUNT(*) AS cnt "
            f"FROM activities WHERE {filter_sql} AND start_date_local IS NOT NULL GROUP BY hr ORDER BY hr",
            (*active_types,),
        )
        tp_map = {r["hr"]: r["cnt"] for r in cur.fetchall()}
        time_preference = [{"slot": h, "count": tp_map.get(h, 0)} for h in range(24)]

        yoy_cumulative = _compute_yoy_cumulative(conn, active_types, available_years)
        eddington = _compute_eddington(conn, active_types)
        training_load, training_details = _compute_training_load(conn, active_types, athlete_metrics)
        recent_form = _compute_recent_form(conn, active_types, athlete_metrics)
        distance_breakdown = _compute_distance_breakdown(conn, active_types, is_run_active)
        hr_zones = _compute_hr_zones(conn, active_types, max_hr)
        period_comparison = _compute_period_comparison(conn, active_types)
        bio_stats = _compute_bio_stats(conn, active_types, athlete_metrics)
        activity_pattern = _compute_activity_pattern(conn, active_types)
        athlete_radar = _compute_athlete_radar(conn, active_types, athlete_metrics, recent)
        gear_stats = _compute_gear_stats(conn, active_types, athlete_metrics)
        recording_stats = _compute_recording_stats(conn, active_types, athlete_metrics)
        records, dashboard_records = _compute_records(conn, active_types)
        records_trends = _compute_records_trends(conn, active_types)
        goals = _compute_goals(conn, active_types, athlete_metrics)
        smart_coach = _compute_smart_coach(training_details)
        yearly_full = _compute_yearly_full(conn, active_types)
        pbs_per_month = _compute_pbs_per_month(conn, active_types)
        milestones_timeline = _compute_milestones_timeline(conn, active_types)
        pace_evolution = _compute_pace_evolution(conn, active_types)
        activity_world = _compute_activity_world(conn, active_types)
        power_history = _compute_power_history(conn, active_types)
        hr_recovery = _compute_hr_recovery(conn, active_types, max_hr)
        repeat_routes = _compute_repeat_routes(conn, active_types)
        training_dna = _compute_training_dna(conn, active_types, athlete_metrics, weekday_preference, time_preference)
        elevation_trophies = _compute_elevation_trophies(conn, active_types)
        race_readiness = _compute_race_readiness(training_details)
        weekly_blocks = _compute_weekly_blocks(conn, active_types, athlete_metrics)
        seasonal_performance = _compute_seasonal_performance(conn, active_types)

        is_run_only = is_run_active and not is_ride_active
        is_ride_only = is_ride_active and not is_run_active
        primary_metric = "PACE" if is_run_only else ("SPEED" if is_ride_only else "METRIC")

        # Athlete metrics for frontend (vo2_estimate, zones, threshold_pace, ftp_estimate)
        vo2 = athlete_metrics.get("vo2max", 50)
        zones_cfg = {}
        if max_hr > 0:
            zones_cfg = {
                "Z1": {"from": 0, "to": int(max_hr * 0.60)},
                "Z2": {"from": int(max_hr * 0.60), "to": int(max_hr * 0.70)},
                "Z3": {"from": int(max_hr * 0.70), "to": int(max_hr * 0.80)},
                "Z4": {"from": int(max_hr * 0.80), "to": int(max_hr * 0.90)},
                "Z5": {"from": int(max_hr * 0.90), "to": max_hr},
            }
        # Compute peak performance from DB
        run_ph = ",".join(["?"] * len([t for t in active_types if t in _RUN_TYPES])) if any(t in _RUN_TYPES for t in active_types) else None
        ride_ph = ",".join(["?"] * len([t for t in active_types if t in _RIDE_TYPES])) if any(t in _RIDE_TYPES for t in active_types) else None
        run_types_list = [t for t in active_types if t in _RUN_TYPES]
        ride_types_list = [t for t in active_types if t in _RIDE_TYPES]

        peak_run_speed = peak_run_cadence = 0
        if run_types_list:
            r = cur.execute(
                f"SELECT COALESCE(MAX(max_speed), 0) as ms, COALESCE(MAX(average_cadence), 0) as mc "
                f"FROM activities WHERE type IN ({','.join(['?']*len(run_types_list))})",
                (*run_types_list,)
            ).fetchone()
            if r:
                peak_run_speed = round((r["ms"] or 0) * 3.6, 1)   # m/s → km/h
                peak_run_cadence = int(r["mc"] or 0)

        peak_ride_power = peak_ride_speed = 0
        if ride_types_list:
            r = cur.execute(
                f"SELECT COALESCE(MAX(average_watts), 0) as mw, COALESCE(MAX(max_speed), 0) as ms "
                f"FROM activities WHERE type IN ({','.join(['?']*len(ride_types_list))})",
                (*ride_types_list,)
            ).fetchone()
            if r:
                peak_ride_power = int(r["mw"] or 0)
                peak_ride_speed = round((r["ms"] or 0) * 3.6, 1)

        # Estimate threshold pace from best 5K or 10K (Jack Daniels: T-pace ≈ 10K pace + 15s/km)
        threshold_pace_str = "—"
        if records.get("5K"):
            try:
                t_str = records["5K"]["moving_time"]
                parts = t_str.replace(":", " ").split()
                if len(parts) == 3:
                    secs_5k = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                elif len(parts) == 2:
                    secs_5k = int(parts[0]) * 60 + int(parts[1])
                else:
                    secs_5k = 0
                if secs_5k > 0:
                    pace_5k = secs_5k / 5.0  # sec/km
                    t_pace = pace_5k * 1.04   # T-pace is slightly slower
                    threshold_pace_str = f"{int(t_pace // 60)}:{int(t_pace % 60):02d}/km"
            except Exception:
                pass
        elif records.get("10K"):
            try:
                t_str = records["10K"]["moving_time"]
                parts = t_str.replace(":", " ").split()
                if len(parts) == 3:
                    secs_10k = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                elif len(parts) == 2:
                    secs_10k = int(parts[0]) * 60 + int(parts[1])
                else:
                    secs_10k = 0
                if secs_10k > 0:
                    pace_10k = secs_10k / 10.0
                    threshold_pace_str = f"{int(pace_10k // 60)}:{int(pace_10k % 60):02d}/km"
            except Exception:
                pass

        riegel_cfg = athlete_metrics.get("riegel_exponents", {})
        athlete_metrics_out = {
            **athlete_metrics,
            "vo2_estimate": vo2,
            "zones": zones_cfg,
            "max_hr": max_hr,
            "resting_hr": athlete_metrics.get("resting_hr", 55),
            "threshold_pace": threshold_pace_str,
            "ftp_estimate": athlete_metrics.get("ftp", 200),
            "peak_performance": {
                "running": {"max_speed": peak_run_speed, "max_cadence": peak_run_cadence},
                "cycling": {"max_avg_power": peak_ride_power, "max_speed": peak_ride_speed},
                "milestones": {"pbs_this_year": len(dashboard_records)},
            },
            "riegel_exponents": {
                "run": riegel_cfg.get("run", 1.06),
                "ride": riegel_cfg.get("ride", 1.05),
            },
        }

        result = {
            "total_distance": round(total_distance, 2),
            "total_count": total_count,
            "recent_activities": recent,
            "heatmap": heatmap_data,
            "yearly": yearly,
            "available_years": available_years,
            "streaks": streaks,
            "sport_type": sport_type,
            "photos_count": photos_count,
            "athlete_metrics": athlete_metrics_out,
            "athlete_profile": athlete_profile,
            # Computed
            "breakdown": breakdown,
            "daily_stats": daily_stats,
            "monthly_trends": monthly_trends,
            "weekday_preference": weekday_preference,
            "time_preference": time_preference,
            "yoy_cumulative": yoy_cumulative,
            "eddington": eddington,
            "training_load": training_load,
            "training_details": training_details,
            "recent_form": recent_form,
            "distance_breakdown": distance_breakdown,
            "hr_zones": hr_zones,
            "period_comparison": period_comparison,
            "bio_stats": bio_stats,
            "activity_pattern": activity_pattern,
            "athlete_radar": athlete_radar,
            "gear_stats": gear_stats,
            "recording_stats": recording_stats,
            "records": records,
            "records_trends": records_trends,
            "dashboard_records": dashboard_records,
            "goals": goals,
            "smart_coach": smart_coach,
            "yearly_full": yearly_full,
            "pbs_per_month": pbs_per_month,
            "milestones_timeline": milestones_timeline,
            "pace_evolution": pace_evolution,
            "activity_world": activity_world,
            "power_history": power_history,
            "hr_recovery": hr_recovery,
            "repeat_routes": repeat_routes,
            "training_dna": training_dna,
            "elevation_trophies": elevation_trophies,
            "race_readiness": race_readiness,
            "weekly_blocks": weekly_blocks,
            "seasonal_performance": seasonal_performance,
            "primary_metric": primary_metric,
            "weekly_trends": [],
        }

        cache.set(cache_key, result, ttl=300)
        return result

    except Exception as e:
        import traceback
        print(f"[stats router] Error: {e}")
        traceback.print_exc()
        return {"total_distance": 0, "total_count": 0, "recent_activities": [],
                "heatmap": {}, "yearly": {}}
    finally:
        conn.close()
