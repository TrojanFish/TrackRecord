"""
run_page/routers/stats.py

ARCH-1: /api/v1/stats 路由模块
从原 web_api.py 中抽离 get_sports_stats() 及相关逻辑。
"""

import os
import datetime
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Query

from run_page.services.db_service import get_db_conn, row_to_seconds, resolve_active_types
from run_page.services.cache_service import cache
from run_page.core.auth import load_creds

router = APIRouter(prefix="/api/v1", tags=["stats"])


# ── 辅助函数（原 web_api.py 顶层函数） ───────────────────────────────────────

def calculate_streaks_detailed(dates: list[str]) -> dict:
    """计算最长连续天/周/月打卡数。dates 应为已去重、升序排列的 YYYY-MM-DD 列表。"""
    if not dates:
        return {"day": 0, "week": 0, "month": 0}

    date_objs = sorted(
        set(dt.datetime.strptime(d, "%Y-%m-%d").date() for d in dates)
    )

    # 1. Day Streak
    max_day = temp = 1
    for i in range(len(date_objs) - 1):
        if (date_objs[i + 1] - date_objs[i]).days == 1:
            temp += 1
        else:
            max_day = max(max_day, temp)
            temp = 1
    max_day = max(max_day, temp)

    # 2. Week Streak (ISO weeks)
    weeks = sorted(set(d.isocalendar()[:2] for d in date_objs))
    max_week = temp = 1
    for i in range(len(weeks) - 1):
        y1, w1 = weeks[i]
        y2, w2 = weeks[i + 1]
        consecutive = (y1 == y2 and w2 == w1 + 1) or (y2 == y1 + 1 and w1 >= 52 and w2 == 1)
        if consecutive:
            temp += 1
        else:
            max_week = max(max_week, temp)
            temp = 1
    max_week = max(max_week, temp)

    # 3. Month Streak
    months = sorted(set((d.year, d.month) for d in date_objs))
    max_month = temp = 1
    for i in range(len(months) - 1):
        y1, m1 = months[i]
        y2, m2 = months[i + 1]
        consecutive = (y1 == y2 and m2 == m1 + 1) or (y2 == y1 + 1 and m1 == 12 and m2 == 1)
        if consecutive:
            temp += 1
        else:
            max_month = max(max_month, temp)
            temp = 1
    max_month = max(max_month, temp)

    return {"day": max_day, "week": max_week, "month": max_month}


def get_athlete_metrics() -> dict:
    """从 config.yaml 读取运动员指标配置（原 web_api.py 同名函数）。"""
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
                "frequency_monthly_sessions": 16, "long_run_km": 25, "speed_pace_min_km": 4.0,
            },
            "milestones": {}, "bins": {}, "device_mapping": {},
        },
        "gears": [],
    }
    try:
        cfg_path = os.environ.get("CONFIG_PATH", "config.yaml")
        if os.path.exists(cfg_path):
            with open(cfg_path) as f:
                cfg = yaml.safe_load(f) or {}
            athlete = cfg.get("athlete", {})
            for k, v in athlete.items():
                defaults[k] = v
    except Exception:
        pass
    return defaults


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_sports_stats(sport_type: Optional[str] = Query(None)):
    """
    综合运动统计数据 — Dashboard 主接口。
    结果在内存中缓存 300 秒；sync 完成后由 sync 路由主动清除。
    """
    cache_key = f"stats:{sport_type or 'all'}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    active_types, is_run_active, is_ride_active = resolve_active_types(sport_type)
    placeholders = ",".join(["?"] * len(active_types))
    filter_sql = f"type IN ({placeholders})"

    conn = get_db_conn()
    if not conn:
        return {"total_distance": 0, "total_count": 0, "recent_activities": [],
                "heatmap": {}, "yearly": {}}

    try:
        cur = conn.cursor()
        athlete_metrics = get_athlete_metrics()

        # ── 1. Basic aggregates (single query) ───────────────────────────────
        cur.execute(
            f"""
            SELECT
                COUNT(*)                            AS count,
                COALESCE(SUM(distance), 0)          AS dist,
                COALESCE(MAX(distance), 0)          AS max_dist,
                COALESCE(AVG(distance), 0)          AS avg_dist,
                COALESCE(SUM(elevation_gain), 0)    AS total_elev,
                COALESCE(AVG(average_heartrate), 0) AS avg_hr,
                COALESCE(MAX(max_heartrate), 0)     AS max_hr_val
            FROM activities WHERE {filter_sql}
            """,
            (*active_types,),
        )
        agg = cur.fetchone()
        total_count    = agg["count"] or 0
        total_distance = (agg["dist"] or 0) / 1000.0

        # ── 2. Recent activities (for heatmap & activity list) ────────────────
        cur.execute(
            f"""
            SELECT run_id, name, distance, moving_time, type, start_date_local,
                   summary_polyline, average_heartrate, max_speed, location_country,
                   location_city, commute, workout_type, elevation_gain,
                   average_cadence, average_watts
            FROM activities
            WHERE {filter_sql}
            ORDER BY start_date_local DESC
            LIMIT 2000
            """,
            (*active_types,),
        )
        weight = athlete_metrics.get("weight", 70)
        cal_factors = athlete_metrics["analysis"]["calorie_factors"]
        recent = []
        for row in cur.fetchall():
            d = dict(row)
            mt = d.get("moving_time", "")
            d["moving_time_display"] = (
                mt.split(" ")[1].split(".")[0] if mt and " " in mt else mt
            )
            # Pace / speed
            if d["distance"] and d["distance"] > 0:
                try:
                    t_str = mt.split(" ")[1] if " " in mt else mt
                    h, m, s = map(float, t_str.split(":"))
                    total_sec = h * 3600 + m * 60 + s
                    if total_sec > 0:
                        dist_km = d["distance"] / 1000.0
                        if d["type"] in ["Run", "VirtualRun", "TrailRun"]:
                            pace = (total_sec / 60.0) / dist_km
                            d["gap_pace"] = f"{int(pace)}:{int((pace % 1) * 60):02d}/km"
                        elif d["type"] in ["Ride", "VirtualRide", "Velomobile", "E-BikeRide"]:
                            d["gap_pace"] = f"{round(dist_km / (total_sec / 3600.0), 1)} km/h"
                except Exception:
                    pass
            # Calories
            d_km = (d["distance"] or 0) / 1000.0
            if d["type"] in ["Run", "TrailRun", "VirtualRun"]:
                d["calories"] = int(d_km * weight * cal_factors.get("run", 1.036))
            elif d["type"] in ["Ride", "VirtualRide", "Velomobile"]:
                d["calories"] = int(d_km * weight * cal_factors.get("ride", 0.5))
            else:
                d["calories"] = int(d_km * weight * cal_factors.get("default", 0.8))
            recent.append(d)

        # ── 3. Yearly aggregates ──────────────────────────────────────────────
        cur.execute(
            f"""
            SELECT strftime('%Y', start_date_local) AS year,
                   COUNT(*) AS count, COALESCE(SUM(distance), 0) AS dist
            FROM activities WHERE {filter_sql}
            GROUP BY year ORDER BY year DESC
            """,
            (*active_types,),
        )
        yearly = {
            r["year"]: {"count": r["count"], "distance": r["dist"] / 1000.0}
            for r in cur.fetchall()
        }

        # ── 4. Heatmap (last 365 days) ────────────────────────────────────────
        cur.execute(
            f"""
            SELECT date(start_date_local) AS date, type, distance, moving_time, elevation_gain
            FROM activities
            WHERE start_date_local > date('now', '-1 year') AND {filter_sql}
            """,
            (*active_types,),
        )
        heatmap_data: dict = {}
        for r in cur.fetchall():
            d = r["date"]
            if d not in heatmap_data:
                heatmap_data[d] = {"count": 0, "dist": 0.0, "time": 0.0, "elev": 0.0, "cal": 0.0}
            heatmap_data[d]["count"] += 1
            heatmap_data[d]["dist"]  += (r["distance"] or 0) / 1000.0
            heatmap_data[d]["time"]  += row_to_seconds(r["moving_time"]) / 3600.0
            heatmap_data[d]["elev"]  += r["elevation_gain"] or 0
            d_km = (r["distance"] or 0) / 1000.0
            heatmap_data[d]["cal"] += (
                d_km * weight * 1.036 if r["type"] in ["Run", "TrailRun", "VirtualRun"]
                else d_km * weight * 0.5
            )
        for d in heatmap_data:
            heatmap_data[d] = {k: round(v, 2 if k in ("dist", "time") else (1 if k == "elev" else 0))
                               for k, v in heatmap_data[d].items()}

        # ── 5. Streak calculation ─────────────────────────────────────────────
        cur.execute(
            f"""
            SELECT date(start_date_local) AS activity_date
            FROM activities WHERE {filter_sql}
            GROUP BY activity_date ORDER BY activity_date
            """,
            (*active_types,),
        )
        streak_dates = [r["activity_date"] for r in cur.fetchall()]
        streaks = calculate_streaks_detailed(streak_dates)

        # ── 6. Available years ────────────────────────────────────────────────
        cur.execute(
            f"""
            SELECT DISTINCT strftime('%Y', start_date_local) AS yr
            FROM activities WHERE yr IS NOT NULL AND {filter_sql}
            ORDER BY yr DESC
            """,
            (*active_types,),
        )
        available_years = [r["yr"] for r in cur.fetchall()]

        # ── 7. Photos count ───────────────────────────────────────────────────
        try:
            photos_count = cur.execute("SELECT COUNT(*) FROM photos").fetchone()[0]
        except Exception:
            photos_count = 0

        # ── 8. Athlete profile (Strava, cached internally) ────────────────────
        from run_page.web_api import get_strava_athlete_cached  # keep using existing Strava cache
        athlete_profile = get_strava_athlete_cached(load_creds())

        # ── Assemble result ───────────────────────────────────────────────────
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
            "athlete_metrics": athlete_metrics,
            "athlete_profile": athlete_profile,
            # Placeholders for fields populated by other routers / kept for compat
            "monthly_trends": [],
            "breakdown": {},
            "eddington": {"Run": 0, "Ride": 0},
            "yoy_cumulative": [],
            "weekly_trends": [],
            "records": {},
            "time_preference": [],
            "weekday_preference": [],
            "gear_stats": [],
            "training_load": [],
            "records_trends": {},
            "daily_stats": [],
            "recent_form": {
                "this_week": {"distance": 0, "stress": 0, "count": 0},
                "last_week": {"distance": 0, "stress": 0, "count": 0},
            },
            "athlete_radar": [],
            "dashboard_records": [],
            "activity_pattern": [],
        }

        # Cache the result for 5 minutes
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