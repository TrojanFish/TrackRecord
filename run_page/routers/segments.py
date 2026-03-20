"""
run_page/routers/segments.py

ARCH-1: /api/v1/segments 路由模块
处理 Strava Segments 的查询与展示。
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query
from run_page.services.db_service import get_db_conn

router = APIRouter(prefix="/api/v1", tags=["segments"])
logger = logging.getLogger(__name__)


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

        # Parameterized sport_type filter
        if sport_type == "Ride":
            types = ["Ride", "VirtualRide", "Velomobile"]
            ph = ",".join(["?"] * len(types))
            cur.execute(f"{base_query} WHERE activity_type IN ({ph}) ORDER BY effort_count DESC", types)
        elif sport_type == "Run":
            types = ["Run", "TrailRun", "VirtualRun"]
            ph = ",".join(["?"] * len(types))
            cur.execute(f"{base_query} WHERE activity_type IN ({ph}) ORDER BY effort_count DESC", types)
        else:
            cur.execute(f"{base_query} ORDER BY effort_count DESC")

        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("Error fetching segments: %s", e, exc_info=True)
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
        return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error("Error fetching efforts for segment %s: %s", segment_id, e, exc_info=True)
        return []
    finally:
        conn.close()
