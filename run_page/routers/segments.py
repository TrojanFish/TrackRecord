"""
run_page/routers/segments.py

ARCH-1: /api/v1/segments 路由模块
处理 Strava Segments 的查询与展示。
"""

import os
from typing import Optional
from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Query
from run_page.services.db_service import get_db_conn

router = APIRouter(prefix="/api/v1", tags=["segments"])


@router.get("/segments")
def get_segments(sport_type: Optional[str] = Query(None)):
    """获取所有 Strava Segments 列表。"""
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        base_query = """
            SELECT s.*, 
                   (SELECT MIN(se.kom_rank) FROM segment_efforts se WHERE se.segment_id = s.id) as best_rank
            FROM segments s
        """
        
        # 兼容 sport_type 过滤
        if sport_type == "Ride":
            cur.execute(f"{base_query} WHERE activity_type IN ('Ride', 'VirtualRide', 'Velomobile') ORDER BY effort_count DESC")
        elif sport_type == "Run":
            cur.execute(f"{base_query} WHERE activity_type IN ('Run', 'TrailRun', 'VirtualRun') ORDER BY effort_count DESC")
        else:
            cur.execute(f"{base_query} ORDER BY effort_count DESC")
            
        rows = cur.fetchall()
        
        # 如果数据库还没数据，返回几个 mock 示例，让前端不至于空白（原 web_api 逻辑）
        cur.execute("SELECT COUNT(*) FROM segments")
        total_in_db = cur.fetchone()[0]
        
        if total_in_db == 0:
            return [
                {
                    "id": 123, "name": "Sprint Finish Line", "distance": 1100, "city": "Hangzhou",
                    "effort_count": 42, "best_time": "0:01:42", "best_date": "2024-03-12", "average_grade": 2.5,
                    "activity_type": "Ride", "country": "China"
                },
                {
                    "id": 124, "name": "Central Park Loop", "distance": 6200, "city": "Shanghai",
                    "effort_count": 15, "best_time": "0:24:15", "best_date": "2023-11-05", "average_grade": 0.5,
                    "activity_type": "Run", "country": "China"
                }
            ]
        
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[segments] Error fetching segments: {e}")
        return []
    finally:
        conn.close()


@router.get("/segment_efforts/{segment_id}")
def get_segment_efforts(segment_id: int):
    """获取特定 Segment 的所有历史 Effort。"""
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM segment_efforts WHERE segment_id = ? ORDER BY start_date_local DESC", 
            (segment_id,)
        )
        efforts = [dict(r) for r in cur.fetchall()]
        
        # 如果没有 Effort，返回 Mock 数据供演示
        if not efforts:
            efforts = []
            for i in range(10):
                d = datetime.now() - timedelta(days=i*14)
                efforts.append({
                    "id": 1000 + i,
                    "segment_id": segment_id,
                    "activity_id": 9999 - i,
                    "name": "Evening Session",
                    "moving_time": str(timedelta(seconds=random.randint(400, 600))),
                    "start_date_local": d.strftime("%Y-%m-%d %H:%M:%S"),
                    "average_heartrate": random.randint(140, 165),
                    "average_watts": random.randint(200, 300)
                })
        return efforts
    except Exception as e:
        print(f"[segments] Error fetching efforts for {segment_id}: {e}")
        return []
    finally:
        conn.close()
