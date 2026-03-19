"""
run_page/routers/rewind.py

ARCH-1: /api/v1/stats/rewind 路由模块
处理年度运动回顾报告（年度回顾页面数据）。
"""

import os
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Query
from run_page.services.db_service import get_db_conn, row_to_seconds, resolve_active_types, format_location
from run_page.routers.stats import get_athlete_metrics

router = APIRouter(prefix="/api/v1/stats", tags=["rewind"])


@router.get("/rewind")
def get_rewind_report(
    year: Optional[str] = None, 
    compare_year: Optional[str] = None, 
    sport_type: Optional[str] = Query(None)
):
    """年度回顾全量数据导出接口，包含与历史年份的对比。"""
    conn = get_db_conn()
    if not conn:
        return {}

    active_types, is_run_active, is_ride_active = resolve_active_types(sport_type)
    placeholders = ",".join(["?"] * len(active_types))
    type_filter = f"type IN ({placeholders})"

    try:
        cur = conn.cursor()
        athlete = get_athlete_metrics()
        weight = athlete.get("weight", 70)
        target_year = year or "ALL"

        # 获取数据库中的所有年份列表用于前端展示切换
        cur.execute(
            f"SELECT DISTINCT strftime('%Y', start_date_local) as yr FROM activities WHERE yr IS NOT NULL AND {type_filter} ORDER BY yr DESC",
            (*active_types,),
        )
        available_years = [r["yr"] for r in cur.fetchall()]

        # 1. 核心统计数据获取
        def fetch_year_stats(yr):
            if not yr or yr == "ALL":
                cur.execute(
                    f"SELECT SUM(distance) as dist, SUM(moving_time) as time, SUM(elevation_gain) as elev, COUNT(*) as count FROM activities WHERE {type_filter}",
                    (*active_types,),
                )
            else:
                cur.execute(
                    f"SELECT SUM(distance) as dist, SUM(moving_time) as time, SUM(elevation_gain) as elev, COUNT(*) as count FROM activities WHERE strftime('%Y', start_date_local) = ? AND {type_filter}",
                    (str(yr), *active_types),
                )
            row = cur.fetchone()
            if not row or row["count"] == 0:
                return {"distance": 0, "hours": 0, "elevation": 0, "count": 0, "calories": 0}
            
            dist_km = (row["dist"] or 0) / 1000.0
            return {
                "distance": round(dist_km, 1),
                "hours": round(row_to_seconds(row["time"]) / 3600.0, 1),
                "elevation": round(row["elev"] or 0),
                "count": row["count"] or 0,
                "calories": int(dist_km * weight * 0.82)  # 给定预定义的消耗系数
            }

        main_stats = fetch_year_stats(target_year)
        comp_stats = fetch_year_stats(compare_year) if compare_year else None
        
        # 2. 碳减排计算 (基于原 web_api 逻辑)
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
                # 设置不同运动模式的“替代燃油车里程”系数
                if r["type"] in ["Run", "TrailRun", "VirtualRun"]:
                    total += (r["dist"] / 1000.0) * 0.16 
                elif r["type"] in ["Ride", "VirtualRide", "Velomobile"]:
                    total += (r["dist"] / 1000.0) * 0.12
            return round(total, 1)

        carbon_total = fetch_carbon(target_year)
        comp_carbon = fetch_carbon(compare_year) if compare_year else None

        comparison = None
        if comp_stats and main_stats["count"] > 0:
            comparison = {
                "dist_diff": round(main_stats["distance"] - comp_stats["distance"], 1),
                "count_diff": main_stats["count"] - comp_stats["count"],
                "elev_diff": main_stats["elevation"] - comp_stats["elevation"],
                "time_diff": round(main_stats["hours"] - comp_stats["hours"], 1),
                "cal_diff": main_stats["calories"] - comp_stats["calories"],
                "carbon_diff": round(carbon_total - (comp_carbon or 0), 1),
                "dist_percent": round((main_stats["distance"] / comp_stats["distance"] * 100 - 100), 1) if comp_stats["distance"] > 0 else 100
            }

        # 3. 装备利用率分析
        gears = athlete.get("gears", [])
        gear_usage = []
        for g in gears:
            g_from = g.get("active_from", "2000-01-01")
            g_to = g.get("active_to", "2099-12-31")
            # 过滤支持该装备的运动类型
            original_type = g.get("type", "Run")
            types = ["Run", "VirtualRun", "TrailRun"] if original_type == "Run" else ["Ride", "VirtualRide", "Velomobile"]
            actual_types = [t for t in types if t in active_types]
            if not actual_types:
                continue

            p = ",".join(["?"] * len(actual_types))
            if target_year == "ALL":
                cur.execute(f"SELECT SUM(moving_time) FROM activities WHERE type IN ({p}) AND date(start_date_local) BETWEEN ? AND ?", (*actual_types, g_from, g_to))
            else:
                cur.execute(f"SELECT SUM(moving_time) FROM activities WHERE type IN ({p}) AND strftime('%Y', start_date_local) = ? AND date(start_date_local) BETWEEN ? AND ?", (*actual_types, str(target_year), g_from, g_to))
            
            t_res = cur.fetchone()[0]
            hours = row_to_seconds(t_res) / 3600.0
            if hours > 0:
                gear_usage.append({"name": g.get("name"), "hours": round(hours, 1)})

        # 4. 月度活跃度矩阵分析
        mon_filter = f"strftime('%Y', start_date_local) = ? AND {type_filter}" if target_year != "ALL" else type_filter
        mon_params = (str(target_year), *active_types) if target_year != "ALL" else (*active_types,)
        
        cur.execute(f"""
            SELECT strftime('%m', start_date_local) as month_num,
                   COUNT(*) as count, SUM(distance) as dist, SUM(elevation_gain) as elev, SUM(moving_time) as time
            FROM activities WHERE {mon_filter} GROUP BY month_num
        """, mon_params)
        res_map = {r["month_num"]: r for r in cur.fetchall()}

        # Compute monthly PR counts: track best time per distance bucket
        _ride_buckets = [("30K",28000,32000),("50K",45000,55000),("80K",75000,85000),("100K",95000,105000),("150K",145000,155000)]
        _run_buckets  = [("5K",4800,5200),("10K",9800,10200),("Half",20900,21300),("Marathon",42000,42400)]
        _ride_types   = {"Ride","VirtualRide","EBikeRide","GravelRide","MountainBikeRide","Handcycle"}
        _run_types    = {"Run","VirtualRun","TrailRun","Walk","Hike"}

        pr_sql = f"SELECT strftime('%m', start_date_local) as mo, distance, moving_time, type FROM activities WHERE {type_filter} ORDER BY start_date_local ASC"
        cur.execute(pr_sql, (*active_types,))
        pr_monthly = {f"{i:02d}": 0 for i in range(1, 13)}
        best_pr = {}
        for row in cur.fetchall():
            dist = row["distance"] or 0
            secs = row_to_seconds(row["moving_time"] or "")
            if secs <= 0:
                continue
            rtype = row["type"] or ""
            buckets = _ride_buckets if rtype in _ride_types else (_run_buckets if rtype in _run_types else [])
            for label, lo, hi in buckets:
                if lo <= dist <= hi:
                    if label not in best_pr or secs < best_pr[label]:
                        best_pr[label] = secs
                        pr_monthly[row["mo"]] = pr_monthly.get(row["mo"], 0) + 1
                    break

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
                "prs": pr_monthly.get(m_num, 0)
            })

        # 5. 单次最长 Session (里程/时间)
        if target_year == "ALL":
            cur.execute(f"SELECT name, moving_time, distance, date(start_date_local) as date, summary_polyline FROM activities WHERE {type_filter} ORDER BY moving_time DESC LIMIT 1", (*active_types,))
        else:
            cur.execute(f"SELECT name, moving_time, distance, date(start_date_local) as date, summary_polyline FROM activities WHERE strftime('%Y', start_date_local) = ? AND {type_filter} ORDER BY moving_time DESC LIMIT 1", (str(target_year), *active_types))
        row = cur.fetchone()
        longest = dict(row) if row else {"name": "None", "moving_time": "0", "distance": 0, "date": ""}
        longest["hours"] = round(row_to_seconds(longest.get("moving_time", "0")) / 3600.0, 1)
        longest["dist_km"] = round((longest.get("distance", 0) or 0) / 1000.0, 1)

        # 6. 获取照片作为回顾辅助资料
        cur.execute("SELECT id, local_path, remote_url, title, date FROM photos ORDER BY date DESC LIMIT 8")
        photo_rows = cur.fetchall()
        photos = []
        for p in photo_rows:
            photos.append({
                "id": p["id"],
                "url": f"/static/photos/{os.path.basename(p['local_path'])}" if p['local_path'] else p["remote_url"],
                "title": p["title"],
                "date": p["date"]
            })

        # 7. 连胜（Streaks）
        streak_sql = f"SELECT date(start_date_local) AS d FROM activities WHERE {type_filter}"
        streak_params = [*active_types]
        if target_year != "ALL":
            streak_sql += " AND strftime('%Y', start_date_local) = ?"
            streak_params.append(str(target_year))
        streak_sql += " GROUP BY d ORDER BY d"
        cur.execute(streak_sql, streak_params)
        streak_dates = [r["d"] for r in cur.fetchall()]

        from run_page.routers.stats import calculate_streaks_detailed
        streaks_data = calculate_streaks_detailed(streak_dates)

        # 8. 活动时段分布（按小时）
        tod_sql = f"SELECT CAST(strftime('%H', start_date_local) AS INTEGER) AS hour, COUNT(*) AS count FROM activities WHERE {type_filter}"
        tod_params = [*active_types]
        if target_year != "ALL":
            tod_sql += " AND strftime('%Y', start_date_local) = ?"
            tod_params.append(str(target_year))
        tod_sql += " GROUP BY hour ORDER BY hour"
        cur.execute(tod_sql, tod_params)
        tod_map = {r["hour"]: r["count"] for r in cur.fetchall()}
        time_of_day = [{"hour": h, "count": tod_map.get(h, 0)} for h in range(24)]

        # 9. 活动地点 Top 10 (简化格式：中国 杭州 / NYC US)
        loc_sql = f"SELECT location_city, location_country, COUNT(*) as count FROM activities WHERE {type_filter}"
        loc_params = [*active_types]
        if target_year != "ALL":
            loc_sql += " AND strftime('%Y', start_date_local) = ?"
            loc_params.append(str(target_year))
        loc_sql += " GROUP BY location_city, location_country ORDER BY count DESC"
        
        cur.execute(loc_sql, loc_params)
        raw_locs = cur.fetchall()
        
        # 聚合相同名称的地点（格式化后可能重合）
        loc_map = {}
        for r in raw_locs:
            name = format_location(r["location_city"], r["location_country"])
            if not name or name.upper() == "UNKNOWN":
                continue
            loc_map[name] = loc_map.get(name, 0) + r["count"]

        # 转换为列表并排序
        locations = sorted(
            [{"location_city": k, "count": v} for k, v in loc_map.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]

        # 如果彻底没有带位置的数据，尝试取一个最基础的
        if not locations:
            cur.execute(f"SELECT location_city, location_country, COUNT(*) as count FROM activities WHERE {type_filter} GROUP BY location_city, location_country ORDER BY count DESC LIMIT 1", [*active_types])
            fb = cur.fetchone()
            if fb:
                name = format_location(fb["location_city"], fb["location_country"]) or "Unknown"
                locations = [{"location_city": name, "count": fb["count"]}]

        # 10. Habit: 计算准确的活动天数与休息天数
        active_days_sql = f"SELECT COUNT(DISTINCT date(start_date_local)) as ad FROM activities WHERE {type_filter}"
        active_days_params = [*active_types]
        if target_year != "ALL":
            active_days_sql += " AND strftime('%Y', start_date_local) = ?"
            active_days_params.append(str(target_year))
        cur.execute(active_days_sql, active_days_params)
        active_days_count = (cur.fetchone()["ad"] or 0)

        if target_year == "ALL":
            total_days = (dt.date.today() - dt.date(int(available_years[-1]), 1, 1)).days + 1 if available_years else 365
        else:
            import calendar
            total_days = 366 if calendar.isleap(int(target_year)) else 365
            # If the year is current, only count elapsed days
            if str(target_year) == str(dt.date.today().year):
                total_days = dt.date.today().timetuple().tm_yday

        rest_days = max(0, total_days - active_days_count)

        return {
            "year": target_year,
            "compare_year": compare_year,
            "available_years": available_years,
            "overall": main_stats,
            "comparison": comparison,
            "carbon": round(carbon_total, 1),
            "passed_cars": int(carbon_total / 20.0) if carbon_total > 0 else 0,
            "google_searches": int(main_stats["calories"] / 0.2),
            "longest": longest,
            "habit": {
                "total_days": total_days,
                "active_days": active_days_count,
                "rest_days": rest_days,
            },
            "gear": gear_usage,
            "monthly": monthly_matrix,
            "photos": photos,
            "streaks": {"day": streaks_data["day"], "week": streaks_data["week"], "month": streaks_data["month"]},
            "time_of_day": time_of_day,
            "locations": locations,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        conn.close()
