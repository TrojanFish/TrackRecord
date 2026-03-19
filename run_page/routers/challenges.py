"""
run_page/routers/challenges.py

ARCH-1: /api/v1/challenges 路由模块
处理 Strava 奖杯导入与展示。
"""

import os
import re
import datetime as dt
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from run_page.services.db_service import get_db_conn

router = APIRouter(prefix="/api/v1", tags=["challenges"])


class TrophyImportRequest(BaseModel):
    html: str


# ── 辅助函数 ──────────────────────────────────────────────────────────────────

def _format_month(m_str: str) -> str:
    try:
        return dt.datetime.strptime(m_str, "%Y-%m").strftime("%B %Y")
    except Exception:
        return m_str


def parse_and_save_trophies(html_content: str) -> int:
    """解析 Strava Trophy Case HTML，下载图片并写入 DB。"""
    from bs4 import BeautifulSoup
    import requests

    conn = get_db_conn()
    if not conn:
        return 0
    try:
        cur = conn.cursor()
        soup = BeautifulSoup(html_content, "html.parser")

        # 创建本地图标目录
        trophy_icons_dir = "run_page/static/trophy_icons"
        os.makedirs(trophy_icons_dir, exist_ok=True)

        count = 0
        # Strava 奖杯列表结构：.Trophies--list > li 或 similar
        items = soup.select(".Trophies--trophy") or soup.select("[class*='trophy']") or soup.find_all("li")

        for item in items:
            name_el = item.find(class_=re.compile(r"name|title", re.I)) or item.find(["h3", "h4", "span"])
            img_el  = item.find("img")

            if not name_el or not img_el:
                continue

            name = name_el.get_text(strip=True)
            img_src = img_el.get("src", "")
            if not name or not img_src:
                continue

            # 月份解析（从 data-month 属性或相邻元素）
            month_el = item.find(class_=re.compile(r"month|date", re.I))
            month_key = month_el.get_text(strip=True) if month_el else "Unknown"

            # 下载图标到本地
            tid = re.sub(r"[^\w]", "_", name).lower()[:40]
            local_img_path = os.path.join(trophy_icons_dir, f"{tid}.png")
            local_img_url  = f"/static/trophy_icons/{tid}.png"

            if not os.path.exists(local_img_path):
                try:
                    r = requests.get(img_src, timeout=10)
                    if r.status_code == 200:
                        with open(local_img_path, "wb") as f:
                            f.write(r.content)
                except Exception as e:
                    print(f"[challenges] Image download failed for {name}: {e}")
                    local_img_url = img_src

            # 去重检查
            cur.execute("SELECT id FROM trophies WHERE name = ? OR id = ?", (name, tid))
            if cur.fetchone():
                continue

            cur.execute(
                """INSERT OR REPLACE INTO trophies (id, name, image, color, progress, type, month)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (tid, name, local_img_url, "#ff5500", "Earned", "Strava Trophy", month_key),
            )
            count += 1

        conn.commit()
        return count
    except Exception as e:
        print(f"[challenges] parse_and_save_trophies error: {e}")
        return 0
    finally:
        conn.close()


def _get_imported_challenges_from_db() -> dict:
    conn = get_db_conn()
    if not conn:
        return {}
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM trophies")
        result: dict = {}
        for r in cur.fetchall():
            m = r["month"]
            result.setdefault(m, []).append(dict(r))
        return result
    finally:
        conn.close()


def _get_strava_clubs() -> list:
    """获取 Strava 俱乐部列表（带简单内存缓存）。"""
    import time
    from run_page.core.auth import get_credential

    # 模块级简单缓存
    now = time.time()
    cached = getattr(_get_strava_clubs, "_cache", None)
    if cached and now < cached.get("expiry", 0):
        return cached["data"]

    client_id     = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")

    if not all([client_id, client_secret, refresh_token]):
        return []

    try:
        from stravalib.client import Client
        client = Client()
        resp = client.refresh_access_token(
            client_id=client_id, client_secret=client_secret, refresh_token=refresh_token
        )
        client.access_token = resp["access_token"]
        clubs_data = [
            {
                "id": f"club-{c.id}",
                "name": c.name,
                "icon": "🛡️",
                "color": "#10b981",
                "progress": "Joined",
                "image": c.cover_photo_small,
            }
            for c in client.get_athlete_clubs()
        ]
        _get_strava_clubs._cache = {"data": clubs_data, "expiry": now + 3600}
        return clubs_data
    except Exception as e:
        print(f"[challenges] Club fetch error: {e}")
        _get_strava_clubs._cache = {"data": [], "expiry": now + 600}
        return []


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/challenges")
def get_challenges_derived():
    """返回 Strava 俱乐部 + 月度奖杯列表。"""
    clubs_data       = _get_strava_clubs()
    imported_trophies = _get_imported_challenges_from_db()

    conn = get_db_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        challenges = []

        if clubs_data:
            challenges.append({"month": "CLUBS & ORGANIZATIONS", "items": clubs_data})

        # 月度里程碑
        cur.execute("""
            SELECT strftime('%Y-%m', start_date_local) AS month,
                   SUM(distance) AS total_dist, MAX(distance) AS max_dist, type
            FROM activities
            GROUP BY month, type
            ORDER BY month DESC
            LIMIT 24
        """)
        milestones  = cur.fetchall()
        month_map: dict = {}

        for m in milestones:
            month = m["month"]
            month_map.setdefault(month, [])
            try:
                dt_obj    = dt.datetime.strptime(month, "%Y-%m")
                month_key = dt_obj.strftime("%b %Y")
                if month_key in imported_trophies:
                    month_map[month].extend(imported_trophies.pop(month_key))
            except Exception:
                pass

        # 追加剩余已导入奖杯
        for mk, items in imported_trophies.items():
            try:
                d_val  = dt.datetime.strptime(mk, "%b %Y")
                m_slug = d_val.strftime("%Y-%m")
            except Exception:
                m_slug = mk
            month_map.setdefault(m_slug, []).extend(items)

        # 去重 + 格式化输出
        for m_key in sorted(month_map.keys(), reverse=True):
            seen: set = set()
            dedup = []
            for it in month_map[m_key]:
                name = it.get("name", "Unknown")
                if name in seen:
                    continue
                seen.add(name)
                img = it.get("image", "")
                if img and not img.startswith("http"):
                    it["image"] = f"/static/trophy_icons/{os.path.basename(img)}"
                dedup.append(it)
            if dedup:
                challenges.append({"month": _format_month(m_key).upper(), "items": dedup})

        return challenges
    finally:
        conn.close()


@router.post("/challenges/import")
def import_challenges(req: TrophyImportRequest):
    """接收粘贴的 Strava Trophy Case HTML，解析并保存奖杯。"""
    count = parse_and_save_trophies(req.html)
    if count == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid trophies found. Please paste the full page source from strava.com/athletes/…/trophies",
        )
    return {"status": "success", "count": count}