"""
run_page/services/cache_service.py

PERF-1: 带 TTL 的轻量内存缓存
- 无外部依赖，纯 Python 标准库实现
- 线程安全（使用 threading.Lock）
- 支持前缀批量清除，方便在 sync 完成后统一失效
- 全局单例 `cache`，在 web_api.py 中直接 import 使用

使用示例
--------
from run_page.services.cache_service import cache

# 读取（未命中返回 None）
result = cache.get("stats:Ride")

# 写入，TTL 默认 300 秒
cache.set("stats:Ride", data)
cache.set("stats:Ride", data, ttl=600)

# 主动失效（sync 完成后调用）
cache.clear_prefix("stats:")

# 删除单个键
cache.delete("stats:Run")
"""

import time
import threading
from typing import Any, Optional


class TTLCache:
    """线程安全的简单内存缓存，每个条目携带独立的过期时间戳。"""

    def __init__(self):
        # { key: (value, expires_at_unix_float) }
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    # ── Public API ────────────────────────────────────────────────────────────

    def get(self, key: str) -> Optional[Any]:
        """
        返回缓存值；若不存在或已过期则返回 None，并同时清除过期条目。
        """
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() < expires_at:
                return value
            # 已过期，顺手清除
            del self._store[key]
            return None

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """
        写入缓存。
        :param key:   缓存键
        :param value: 任意可序列化值
        :param ttl:   存活秒数，默认 300（5 分钟）
        """
        expires_at = time.monotonic() + ttl
        with self._lock:
            self._store[key] = (value, expires_at)

    def delete(self, key: str) -> None:
        """删除单个键（键不存在时静默忽略）。"""
        with self._lock:
            self._store.pop(key, None)

    def clear_prefix(self, prefix: str) -> int:
        """
        删除所有以 prefix 开头的键。
        :return: 删除的条目数量
        """
        with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]
            return len(keys_to_delete)

    def clear_all(self) -> None:
        """清空全部缓存（调试 / 测试用）。"""
        with self._lock:
            self._store.clear()

    def stats(self) -> dict:
        """返回缓存统计信息（用于 /api/v1/cache/stats 端点）。"""
        now = time.monotonic()
        with self._lock:
            total = len(self._store)
            alive = sum(1 for _, (_, exp) in self._store.items() if exp > now)
            return {"total_keys": total, "alive": alive, "expired_pending_eviction": total - alive}


# ── 全局单例 ──────────────────────────────────────────────────────────────────
# 在 web_api.py 及各 router 中直接 import 这个对象即可
cache = TTLCache()


# ── 装饰器工厂（可选便捷用法）────────────────────────────────────────────────

def cached(key_fn, ttl: int = 300):
    """
    简单的缓存装饰器.
    key_fn 是一个接受与被装饰函数相同参数、返回缓存键字符串的可调用对象。

    示例：
        @cached(key_fn=lambda sport_type=None: f"stats:{sport_type or 'all'}", ttl=300)
        def get_sports_stats(sport_type=None):
            ...
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            key = key_fn(*args, **kwargs)
            hit = cache.get(key)
            if hit is not None:
                return hit
            result = func(*args, **kwargs)
            cache.set(key, result, ttl=ttl)
            return result
        wrapper.__wrapped__ = func  # 方便测试时绕过缓存
        return wrapper
    return decorator