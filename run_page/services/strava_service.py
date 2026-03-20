"""
run_page/services/strava_service.py

Strava OAuth token management and cached API wrappers for the web API layer.

Key design decisions vs Strava API rules (100 req/15min, 1000 req/day):
  - Access token is cached with its expiry timestamp — only refreshed when
    within 5 minutes of expiring, not on every call.
  - New refresh token returned by Strava is persisted to credentials.json
    immediately (Strava rotates refresh tokens).
  - Athlete and clubs data are cached for 1 hour to avoid redundant API calls.
"""

import logging
import time

from stravalib.client import Client
from run_page.auth import get_credential

logger = logging.getLogger(__name__)

# ── Access token cache (shared across all web-API callers) ────────────────────
# Strava access tokens expire after 6 hours.  We refresh proactively when < 5
# minutes remain so callers always get a valid token without extra round-trips.
_ACCESS_TOKEN_CACHE: dict = {
    "token": None,
    "expires_at": 0.0,   # Unix timestamp
}

# ── Per-resource caches ───────────────────────────────────────────────────────
ATHLETE_CACHE: dict = {"data": None, "expiry": 0.0}
CLUBS_CACHE:   dict = {"data": None, "expiry": 0.0}


def _get_strava_client() -> Client | None:
    """
    Return an authorized stravalib Client.

    The access token is reused from cache when still valid (≥ 5 min left).
    A fresh token refresh is only performed when necessary, minimising API
    quota usage.  Any rotated refresh token is immediately persisted.
    """
    client_id     = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")

    if not all([client_id, client_secret, refresh_token]):
        logger.warning("Strava credentials missing — cannot build client.")
        return None

    now = time.time()
    cached_token   = _ACCESS_TOKEN_CACHE["token"]
    cached_expiry  = _ACCESS_TOKEN_CACHE["expires_at"]

    # Reuse cached token if it has more than 5 minutes left
    if cached_token and now < cached_expiry - 300:
        client = Client()
        client.access_token = cached_token
        return client

    # Token expired or not yet fetched — refresh it
    try:
        client = Client()
        response = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token,
        )

        _ACCESS_TOKEN_CACHE["token"]      = response["access_token"]
        _ACCESS_TOKEN_CACHE["expires_at"] = float(
            response.get("expires_at", now + 21600)  # Strava tokens last 6 h
        )
        client.access_token = response["access_token"]

        # Persist rotated refresh token so auth survives restarts
        new_refresh = response.get("refresh_token") or refresh_token
        if new_refresh and new_refresh != refresh_token:
            try:
                from run_page.auth import load_creds, save_creds
                creds = load_creds()
                creds["strava_refresh_token"] = new_refresh
                save_creds(creds)
                logger.info("Rotated Strava refresh token persisted.")
            except Exception as save_err:
                logger.warning("Could not persist rotated refresh token: %s", save_err)

        logger.debug("Strava access token refreshed (expires in %.0f min).",
                     (_ACCESS_TOKEN_CACHE["expires_at"] - now) / 60)
        return client

    except Exception as exc:
        logger.error("Strava token refresh failed: %s", exc)
        return None


def get_strava_athlete_cached(creds=None) -> dict:
    """Return cached athlete profile (refreshed at most once per hour)."""
    now = time.time()
    if ATHLETE_CACHE["data"] and now < ATHLETE_CACHE["expiry"]:
        return ATHLETE_CACHE["data"]
    if "error_expiry" in ATHLETE_CACHE and now < ATHLETE_CACHE["error_expiry"]:
        return {"username": "Athlete", "profile": None}

    client = _get_strava_client()
    if not client:
        return {"username": "Athlete", "profile": None}

    try:
        athlete = client.get_athlete()
        data = {
            "username": f"{athlete.firstname} {athlete.lastname or ''}".strip(),
            "profile":  athlete.profile_medium,
        }
        ATHLETE_CACHE.update({"data": data, "expiry": now + 3600})
        return data
    except Exception as exc:
        logger.warning("Athlete profile fetch error: %s", exc)
        ATHLETE_CACHE["error_expiry"] = now + 600
        return {"username": "Athlete", "profile": None}


def get_strava_clubs_cached(creds=None) -> list:
    """Return cached clubs list (refreshed at most once per hour)."""
    now = time.time()
    if CLUBS_CACHE["data"] and now < CLUBS_CACHE["expiry"]:
        return CLUBS_CACHE["data"]
    if "error_expiry" in CLUBS_CACHE and now < CLUBS_CACHE["error_expiry"]:
        return []

    client = _get_strava_client()
    if not client:
        return []

    try:
        clubs_data = [
            {
                "id":       f"club-{c.id}",
                "name":     c.name,
                "icon":     "🛡️",
                "color":    "#10b981",
                "progress": "Joined",
                "image":    c.cover_photo_small,
            }
            for c in client.get_athlete_clubs()
        ]
        CLUBS_CACHE.update({"data": clubs_data, "expiry": now + 3600})
        return clubs_data
    except Exception as exc:
        logger.warning("Club fetch error: %s", exc)
        CLUBS_CACHE["error_expiry"] = now + 600
        return []
