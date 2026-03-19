"""
run_page/routers/rewind.py

ARCH-1: /api/v1/stats/rewind 路由模块
处理年度运动回顾报告（年度回顾页面数据）。
"""

import os
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Query
from run_page.services.db_service import get_db_conn, row_to_seconds, resolve_active_types
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
                "prs": 0 # Placeholder for PR count if tracked separately
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

        return {
            "year": target_year,
            "compare_year": compare_year,
            "available_years": available_years,
            "overall": main_stats,
            "comparison": comparison,
            "carbon": round(carbon_total, 1),
            "passed_cars": int(carbon_total / 20.0) if carbon_total > 0 else 0,
            "google_searches": int(main_stats["calories"] / 0.2), # 基于能量估算的搜索量（虚构指标）
            "longest": longest,
            "habit": {
                "total_days": 365 if target_year == "ALL" else 366, # Rough
                "active_days": main_stats["count"] # Rough estimate
            },
            "gear": gear_usage,
            "monthly": monthly_matrix,
            "photos": photos
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        conn.close()
