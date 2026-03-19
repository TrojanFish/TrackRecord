"""
run_page/services/db_service.py

ARCH-1: 数据库连接与共享工具函数
- get_db_conn()          → 获取 sqlite3 连接（带自动初始化）
- row_to_seconds()       → 时间字段解析
- RIDE_TYPES / RUN_TYPES → 活动类型常量（全项目唯一定义处）
"""

import os
import sqlite3


# ── 活动类型常量（全局唯一定义） ─────────────────────────────────────────────
RIDE_TYPES = ["Ride", "VirtualRide", "Velomobile", "E-BikeRide"]
RUN_TYPES  = ["Run", "TrailRun", "VirtualRun", "Walk", "Hike"]
ALL_TYPES  = RIDE_TYPES + RUN_TYPES


def resolve_active_types(sport_type: str | None) -> tuple[list[str], bool, bool]:
    """
    根据 sport_type 参数返回 (active_types, is_run_active, is_ride_active)。
    sport_type 取值：'Ride' | 'Run' | None（两者）
    """
    if sport_type == "Ride":
        return RIDE_TYPES, False, True
    if sport_type == "Run":
        return RUN_TYPES, True, False
    return ALL_TYPES, True, True


def get_db_conn() -> sqlite3.Connection | None:
    """
    返回一个配置好 row_factory 的 sqlite3 连接。
    若数据库文件不存在或为空，自动调用 init_db() 初始化。
    """
    db_path = os.environ.get("DB_PATH", "run_page/data.db")
    db_dir  = os.path.dirname(db_path)

    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
        try:
            from run_page.db import init_db
            init_db(db_path)
        except Exception as e:
            print(f"[db_service] init_db failed: {e}")
            return None

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_seconds(val) -> int:
    """
    将数据库中存储的 moving_time 字段（可能是 'HH:MM:SS'、
    '1970-01-01 HH:MM:SS.fff' 或纯数字秒）统一转换为整数秒。
    """
    if not val:
        return 0
    try:
        if isinstance(val, str):
            if " " in val:
                val = val.split(" ")[1]   # 去除日期前缀
            if "." in val:
                val = val.split(".")[0]   # 去除毫秒
            if ":" in val:
                parts = val.split(":")
                if len(parts) == 3:
                    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                if len(parts) == 2:
                    return int(parts[0]) * 60 + int(parts[1])
        return int(float(val))
    except Exception:
        return 0


def format_location(city: str | None, country: str | None) -> str:
    """
    格式化位置信息为全英文简洁格式：
    - Hangzhou CN
    - NYC US
    - Paris FR
    """
    if not city and not country:
        return ""

    # 1. 清洗国家：取最末端，映射为 ISO 代码
    clean_country = country or ""
    if "," in clean_country:
        clean_country = clean_country.split(",")[-1].strip()
    
    country_map = {
        "China": "CN", "中国": "CN",
        "United States": "US", "USA": "US",
        "United Kingdom": "UK",
        "France": "FR", "Japan": "JP",
    }
    clean_country = country_map.get(clean_country, clean_country).strip()

    # 2. 清洗城市：处理详细地址，提取核心地名
    clean_city = city or ""
    if "," in clean_city:
        city_parts = [p.strip() for p in clean_city.split(",")]
        # 如果是详细地址字符串，且末尾包含已知的国家标识，尝试回溯寻找城市名
        if any(c in city_parts[-1] for c in ["CN", "China", "中国"]):
             for p in reversed(city_parts):
                 if any(s in p for s in ["市", "City", "Town", "District", "区"]):
                     clean_city = p
                     break
             else:
                 clean_city = city_parts[-4] if len(city_parts) >= 4 else city_parts[0]
        else:
            clean_city = city_parts[0]
    
    # 统一剥除后缀（城市/区/县等）
    suffixes = ["市", "City", "Town", "District", "区", "县", "Province", "省"]
    if clean_city:
        for s in suffixes:
            clean_city = clean_city.replace(s, "")
        clean_city = clean_city.strip()

    if not clean_country: return clean_city or ""
    if not clean_city: return clean_country

    # 3. 统一返回 City CountryCode 格式
    return f"{clean_city} {clean_country}"