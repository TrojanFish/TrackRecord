#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
行者 (Xingzhe / imxingzhe.com) 数据同步脚本
兼容 running_page 项目，可独立使用

用法（Windows 请写在同一行）：
  python run_page/xingzhe_sync.py --session "你的sessionid" --user-id 4090397 --with-gpx

如何获取 sessionid：
  1. 浏览器打开 https://www.imxingzhe.com 并登录
  2. F12 -> Application -> Cookies -> https://www.imxingzhe.com
  3. 复制 sessionid 的值（注意 sessionid 有效期约 2 周）

依赖：pip install requests gpxpy
"""

import argparse
import os
import sys
import time
from datetime import datetime, timezone, timedelta

import requests
import base64

# RSA Public Key for login encryption
PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDmuQkBbijudDAJgfffDeeIButq
WHZvUwcRuvWdg89393FSdz3IJUHc0rgI/S3WuU8N0VePJLmVAZtCOK4qe4FY/eKm
WpJmn7JfXB4HTMWjPVoyRZmSYjW4L8GrWmh51Qj7DwpTADadF3aq04o+s1b8LXJa
8r6+TIqqL5WUHtRqmQIDAQAB
-----END PUBLIC KEY-----"""


def encrypt_password(password, rd=""):
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5
    import base64

    key = RSA.importKey(PUBLIC_KEY)
    cipher = PKCS1_v1_5.new(key)
    # Xingzhe expects base64 of encrypted bytes.
    # Modern Xingzhe uses password+";"+rd as the plain text.
    plain_text = f"{password};{rd}" if rd else password
    encrypted = cipher.encrypt(plain_text.encode())
    return base64.b64encode(encrypted).decode()


# ── 尝试导入 running_page 内部模块 ─────────────────────────────────────────────
try:
    from generator import Generator

    HAS_GENERATOR = True
except ImportError:
    HAS_GENERATOR = False

# ── 尝试导入 gpxpy ─────────────────────────────────────────────────────────────
try:
    import gpxpy
    import gpxpy.gpx

    HAS_GPXPY = True
except ImportError:
    HAS_GPXPY = False

# ── API 端点 ───────────────────────────────────────────────────────────────────
BASE_URL = "https://www.imxingzhe.com"
YEAR_MONTH_URL = f"{BASE_URL}/api/v1/pgworkout/year_month/"
WORKOUT_LIST_URL = f"{BASE_URL}/api/v1/pgworkout/"
STREAM_URL = f"{BASE_URL}/api/v1/pgworkout/{{workout_id}}/stream/"
GPX_OUT_DIR = "GPX_OUT"
LIST_LIMIT = 50

# ── 运动类型映射（sport 字段为数字，3=骑行已从抓包确认）─────────────────────────
SPORT_CODE_MAP = {
    1: "Run",
    2: "Hike",
    3: "Ride",
    4: "Ride",
    5: "Walk",
    6: "Swim",
    9: "VirtualRide",
    10: "EBikeRide",
}
RIDE_CODES = {3, 4, 9, 10}
RUN_CODES = {1}


# ── 颜色输出 ───────────────────────────────────────────────────────────────────
class C:
    R = "\033[0m"
    G = "\033[92m"
    Y = "\033[93m"
    B = "\033[94m"
    E = "\033[91m"
    D = "\033[2m"


def log(msg):
    print(f"{C.B}->  {msg}{C.R}")


def ok(msg):
    print(f"{C.G}OK  {msg}{C.R}")


def warn(msg):
    print(f"{C.Y}!!  {msg}{C.R}")


def err(msg):
    print(f"{C.E}XX  {msg}{C.R}")


def ensure_gpx_dir():
    os.makedirs(GPX_OUT_DIR, exist_ok=True)


# ── 行者客户端 ─────────────────────────────────────────────────────────────────
class XingzheClient:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Referer": "https://www.imxingzhe.com/",
                "Accept": "application/json, text/plain, */*",
            }
        )

    def login_by_account(self, account, password):
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://www.imxingzhe.com",
                "Referer": "https://www.imxingzhe.com/user/login/",
            }
        )

        # 1. Get 'rd' cookie from login page
        login_page_url = f"{BASE_URL}/user/login/"
        try:
            self.session.get(login_page_url, timeout=10)
            rd = self.session.cookies.get("rd", "")
        except Exception as e:
            err(f"访问登录页面失败: {e}")
            sys.exit(1)

        # 2. Perform login
        login_api = f"{BASE_URL}/api/v4/account/login"
        payload = {
            "account": account,
            "password": encrypt_password(password, rd),
            "source": "web",
        }
        try:
            r = self.session.post(login_api, json=payload, timeout=15)
            r.raise_for_status()
            res = r.json()

            # Check success (both 'status' and 'res' might be used)
            if res.get("status") != 1 and res.get("res") != 1:
                error_msg = res.get("error_message") or res.get("message") or "未知错误"
                err(f"登录失败: {error_msg}")
                sys.exit(1)

            # Try to get user_id from various common keys
            self.user_id = str(
                res.get("user_id") or res.get("userid") or res.get("id") or ""
            )

            # Fallback 1: Extract from data.next (e.g., "/portal/#!/4090397")
            if not self.user_id and "data" in res and "next" in res["data"]:
                next_path = res["data"]["next"]
                import re

                match = re.search(r"#!/(\d+)", next_path)
                if match:
                    self.user_id = match.group(1)

            # Fallback 2: Extract from 'dandan' cookie (Iterate all domains)
            if not self.user_id:
                dandan = None
                for cookie in self.session.cookies:
                    if cookie.name == "dandan":
                        dandan = cookie.value
                        break

                if dandan:
                    try:
                        from urllib.parse import unquote

                        dandan = unquote(dandan)
                        missing_padding = len(dandan) % 4
                        if missing_padding:
                            dandan += "=" * (4 - missing_padding)
                        decoded = base64.b64decode(dandan).decode("utf-8")
                        self.user_id = decoded.split(":")[0]
                    except Exception:
                        pass

            # Fallback 3: Call current user API
            if not self.user_id:
                try:
                    r_user = self.session.get(
                        f"{BASE_URL}/api/v4/account/get_user_info/", timeout=10
                    )
                    if r_user.status_code == 200:
                        user_info = r_user.json()
                        # Some versions use a nested data object
                        data = user_info.get("data") or user_info
                        self.user_id = str(
                            data.get("user_id")
                            or data.get("userid")
                            or data.get("id")
                            or ""
                        )
                except Exception:
                    pass

            if not self.user_id:
                err(f"登录成功但无法获取 User ID. 响应数据: {res}")
                err(f"当前 Cookies: {self.session.cookies.get_dict()}")
                sys.exit(1)

            ok(f"登录成功! User ID: {self.user_id}")
        except Exception as e:
            err(f"登录请求执行出错: {e}")
            sys.exit(1)

    def auth_by_session(self, sessionid, user_id):
        self.session.cookies.set("sessionid", sessionid, domain="www.imxingzhe.com")
        self.session.cookies.set(
            "_XingzheWeb_Token", "true", domain="www.imxingzhe.com"
        )
        self.user_id = str(user_id)
        try:
            resp = self.session.get(YEAR_MONTH_URL, timeout=10)
            if resp.status_code in (401, 403):
                err("sessionid 已失效，请重新从浏览器获取")
                sys.exit(1)
            resp.raise_for_status()
            ok(f"Cookie 验证通过，user_id = {self.user_id}")
        except requests.RequestException as e:
            err(f"网络连接失败: {e}")
            sys.exit(1)

    def get_year_month_index(self):
        """
        返回有数据的年月索引，例如：
        {"2020": [9, 10], "2023": [7, 8]}
        """
        resp = self.session.get(YEAR_MONTH_URL, timeout=10)
        resp.raise_for_status()
        return resp.json().get("data") or {}

    def get_workouts_by_month(self, year, month):
        """
        GET /api/v1/pgworkout/?offset=0&limit=50&year=2023&month=7
        返回当月活动列表，字段已确认：
          id, sport(int), title, duration(秒), distance(米),
          elevation_gain(米), start_time(毫秒), avg_speed(km/h)
        """
        results = []
        offset = 0
        while True:
            params = {
                "offset": offset,
                "limit": LIST_LIMIT,
                "year": year,
                "month": month,
            }
            try:
                resp = self.session.get(WORKOUT_LIST_URL, params=params, timeout=15)
                resp.raise_for_status()
                items = (resp.json().get("data") or {}).get("data") or []
            except Exception as e:
                warn(f"获取 {year}-{month:02d} 第{offset//LIST_LIMIT+1}页失败: {e}")
                break
            if not items:
                break
            results.extend(items)
            if len(items) < LIST_LIMIT:
                break
            offset += LIST_LIMIT
            time.sleep(0.2)
        return results

    def get_all_workouts(self):
        index = self.get_year_month_index()
        if not index:
            warn("年月索引为空，账号可能没有活动记录")
            return []
        total_months = sum(len(v) for v in index.values())
        log(f"账号有数据的年月：{dict(sorted(index.items()))}")
        log(f"共 {total_months} 个月需要获取...")
        all_workouts = []
        for year_str in sorted(index.keys()):
            for month in sorted(index[year_str]):
                items = self.get_workouts_by_month(int(year_str), month)
                if items:
                    log(f"  {year_str}-{month:02d}：{len(items)} 条")
                    all_workouts.extend(items)
                time.sleep(0.3)
        ok(f"共获取 {len(all_workouts)} 条活动记录")
        return all_workouts

    def get_stream_data(self, workout_id):
        """
        GET /api/v1/pgworkout/{id}/stream/
        返回 JSON，结构（已从真实抓包确认）：
        {
          "code": 200,
          "data": {
            "location":  [[经度, 纬度], ...],   <- 注意是 [lng, lat] 顺序
            "timestamp": [1602934766.0, ...],    <- 秒级 Unix 时间戳
            "altitude":  [7.03, ...],            <- 米
            "speed":     [2.18, ...],            <- m/s
            "heartrate": [...],
            "cadence":   [...]
          }
        }
        """
        url = STREAM_URL.format(workout_id=workout_id)
        try:
            resp = self.session.get(url, timeout=30)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json().get("data") or {}
            # location 为空列表时视为无轨迹
            if not data.get("location"):
                return None
            return data
        except Exception as e:
            warn(f"获取轨迹失败 {workout_id}: {e}")
            return None


# ── 将 stream JSON 组装成 GPX XML ─────────────────────────────────────────────
def build_gpx_from_stream(workout_id, title, stream_data):
    """
    stream_data 字段：
      location  : [[lng, lat], ...]
      timestamp : [秒级时间戳, ...]
      altitude  : [米, ...]    可为空列表
      speed     : [m/s, ...]   可为空列表
      heartrate : [bpm, ...]   可为空列表
    """
    if not HAS_GPXPY:
        err("未安装 gpxpy，无法生成 GPX。请运行：pip install gpxpy")
        return None

    locations = stream_data.get("location") or []
    timestamps = stream_data.get("timestamp") or []
    altitudes = stream_data.get("altitude") or []
    heartrates = stream_data.get("heartrate") or []

    if not locations:
        return None

    gpx_obj = gpxpy.gpx.GPX()
    gpx_obj.name = title
    track = gpxpy.gpx.GPXTrack()
    track.name = title
    gpx_obj.tracks.append(track)
    segment = gpxpy.gpx.GPXTrackSegment()
    track.segments.append(segment)

    n = len(locations)
    for i in range(n):
        lng = locations[i][0]
        lat = locations[i][1]
        ele = altitudes[i] if i < len(altitudes) and altitudes[i] is not None else None
        ts = timestamps[i] if i < len(timestamps) else None
        dt = datetime.fromtimestamp(float(ts), tz=timezone.utc) if ts else None

        pt = gpxpy.gpx.GPXTrackPoint(
            latitude=float(lat),
            longitude=float(lng),
            elevation=float(ele) if ele is not None else None,
            time=dt,
        )

        # 心率扩展（Garmin TrackPointExtension 格式）
        hr = heartrates[i] if i < len(heartrates) and heartrates[i] else None
        if hr:
            from lxml import etree

            nsmap = {
                "gpxtpx": "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
            }
            ext = etree.Element("extensions")
            tpe = etree.SubElement(
                ext,
                "{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}TrackPointExtension",
            )
            hr_el = etree.SubElement(
                tpe, "{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}hr"
            )
            hr_el.text = str(int(hr))
            pt.extensions.append(ext)

        segment.points.append(pt)

    return gpx_obj.to_xml()


def save_gpx(workout_id, gpx_xml):
    ensure_gpx_dir()
    filename = os.path.join(GPX_OUT_DIR, f"xingzhe_{workout_id}.gpx")
    with open(filename, "w", encoding="utf-8") as f:
        f.write(gpx_xml)
    return filename


# ── 活动记录 → running_page 格式 ──────────────────────────────────────────────
def workout_to_activity(w):
    """
    字段均来自真实抓包确认：
      id           : int
      sport        : int  (3=骑行)
      title        : str
      duration     : int  (秒)
      distance     : float (米)
      elevation_gain: float (米)
      start_time   : int  (毫秒级 Unix 时间戳)
      avg_speed    : float (km/h)
    """
    try:
        wid = w.get("id")
        if not wid:
            return None

        start_ms = w.get("start_time")
        if not start_ms:
            return None

        start_dt = datetime.fromtimestamp(int(start_ms) / 1000, tz=timezone.utc)
        sport_code = int(w.get("sport", 3))
        act_type = SPORT_CODE_MAP.get(sport_code, "Ride")
        distance_m = float(w.get("distance") or 0)
        duration_s = int(w.get("duration") or 0)
        elevation = float(w.get("elevation_gain") or 0)
        avg_spd_kmh = float(w.get("avg_speed") or 0)
        avg_spd_ms = round(avg_spd_kmh / 3.6, 4)
        end_dt = datetime.fromtimestamp(
            int(start_ms) / 1000 + duration_s, tz=timezone.utc
        )
        name = w.get("title") or f"Xingzhe {act_type} {start_dt.strftime('%Y-%m-%d')}"

        from config import run_map as run_map_nt

        d = {
            "id": str(wid),
            "name": name,
            "type": act_type,
            "subtype": act_type,
            "start_date": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "start_date_local": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "distance": distance_m,
            "moving_time": timedelta(seconds=duration_s),
            "elapsed_time": timedelta(seconds=duration_s),
            "average_speed": avg_spd_ms,
            "average_heartrate": None,
            "max_heartrate": None,
            "elevation_gain": elevation,
            "location_country": "",
            "map": run_map_nt(""),
        }
        from collections import namedtuple

        return namedtuple("Activity", d.keys())(*d.values())
    except Exception as e:
        warn(f"解析活动失败 id={w.get('id')}: {e}")
        return None


# ── 写入 running_page 数据库 ───────────────────────────────────────────────────
def save_to_db(activities):
    if not HAS_GENERATOR:
        warn("未找到 running_page Generator 模块，跳过数据库写入")
        warn("请确保脚本放在 running_page/run_page/ 目录下运行")
        return
    try:
        from config import SQL_FILE

        generator = Generator(SQL_FILE)
        generator.sync_from_app(activities)
        ok(f"已将 {len(activities)} 条活动写入 data.db")
    except Exception as e:
        err(f"写入数据库失败: {e}")


# ── 主流程 ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="行者 (imxingzhe.com) 数据同步脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--account", help="行者账号 (手机号/邮箱)")
    parser.add_argument("--password", help="行者密码")
    parser.add_argument(
        "--session", metavar="SESSIONID", help="浏览器 Cookie 中的 sessionid 值 (可选)"
    )
    parser.add_argument("--user-id", metavar="USER_ID", help="行者用户 ID (可选)")
    parser.add_argument(
        "--with-gpx", action="store_true", help="同时将轨迹导出为 GPX 文件到 GPX_OUT/"
    )
    parser.add_argument(
        "--gpx-only", action="store_true", help="只导出 GPX，不写入数据库"
    )
    parser.add_argument("--only-ride", action="store_true", help="只处理骑行类型")
    parser.add_argument("--only-run", action="store_true", help="只处理跑步类型")
    parser.add_argument(
        "--max-count", type=int, default=0, help="最多处理条数，0=全部（默认：0）"
    )
    args = parser.parse_args()

    # ── 登录验证 ──────────────────────────────────────────────────────────────
    client = XingzheClient()

    if args.account and args.password:
        client.login_by_account(args.account, args.password)
    elif args.session and args.user_id:
        client.auth_by_session(args.session, args.user_id)
    else:
        err("必须提供 --account/--password 或 --session/--user-id")
        sys.exit(1)

    # ── 获取全部活动列表 ───────────────────────────────────────────────────────
    all_workouts = client.get_all_workouts()

    if args.only_ride:
        all_workouts = [w for w in all_workouts if int(w.get("sport", 3)) in RIDE_CODES]
        log(f"骑行过滤后：{len(all_workouts)} 条")
    elif args.only_run:
        all_workouts = [w for w in all_workouts if int(w.get("sport", 3)) in RUN_CODES]
        log(f"跑步过滤后：{len(all_workouts)} 条")

    if args.max_count > 0:
        all_workouts = all_workouts[: args.max_count]
        log(f"限制数量后：{len(all_workouts)} 条")

    if not all_workouts:
        warn("没有找到符合条件的活动")
        sys.exit(0)

    # ── 逐条处理 ──────────────────────────────────────────────────────────────
    activities = []
    gpx_saved = 0
    gpx_skipped = 0
    errors = 0
    need_gpx = args.with_gpx or args.gpx_only

    print(f"\n正在处理 {len(all_workouts)} 条活动" f"  [+成功  g无轨迹  x出错]\n")

    for w in all_workouts:
        workout_id = w.get("id")
        title = w.get("title") or f"xingzhe_{workout_id}"
        try:
            # 转换活动元数据
            activity = workout_to_activity(w)
            if activity and not args.gpx_only:
                activities.append(activity)

            # GPX 导出
            if need_gpx:
                stream = client.get_stream_data(workout_id)
                if stream:
                    gpx_xml = build_gpx_from_stream(workout_id, title, stream)
                    if gpx_xml:
                        save_gpx(workout_id, gpx_xml)
                        gpx_saved += 1
                        print("+", end="", flush=True)
                    else:
                        gpx_skipped += 1
                        print("g", end="", flush=True)
                else:
                    gpx_skipped += 1
                    print("g", end="", flush=True)
                time.sleep(0.3)
            else:
                print("+" if activity else ".", end="", flush=True)

        except KeyboardInterrupt:
            print()
            warn("用户中断，保存已获取数据...")
            break
        except Exception as e:
            print("x", end="", flush=True)
            errors += 1
            if errors <= 5:
                print(f"\n  活动 {workout_id} 处理失败: {e}")

        time.sleep(0.1)

    print("\n")

    # ── 写入数据库 ─────────────────────────────────────────────────────────────
    if activities and not args.gpx_only:
        save_to_db(activities)

    # ── 汇总 ──────────────────────────────────────────────────────────────────
    count = gpx_saved if need_gpx else len(activities)
    ok(f"完成！成功: {count} 条，出错: {errors} 条")
    if need_gpx:
        ok(f"GPX 文件已保存到：{os.path.abspath(GPX_OUT_DIR)}")
        if gpx_skipped:
            warn(f"{gpx_skipped} 条活动无 GPS 轨迹（已跳过）")


if __name__ == "__main__":
    main()
