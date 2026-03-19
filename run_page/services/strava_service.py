import time
from stravalib.client import Client
from run_page.auth import get_credential

# Global Caches (moved from web_api.py)
ATHLETE_CACHE = {"data": None, "expiry": 0}
CLUBS_CACHE = {"data": None, "expiry": 0}

def _get_strava_client():
    """Shared helper: refresh Strava token and return an authorized Client."""
    client_id = get_credential("strava_client_id")
    client_secret = get_credential("strava_client_secret")
    refresh_token = get_credential("strava_refresh_token")
    if not all([client_id, client_secret, refresh_token]):
        return None
    try:
        client = Client()
        response = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token,
        )
        client.access_token = response["access_token"]
        return client
    except Exception as e:
        print(f"Strava token refresh error: {e}")
        return None

def get_strava_athlete_cached(creds=None):
    global ATHLETE_CACHE
    now = time.time()
    if ATHLETE_CACHE["data"] and now < ATHLETE_CACHE["expiry"]:
        return ATHLETE_CACHE["data"]
    if "error_expiry" in ATHLETE_CACHE and now < ATHLETE_CACHE["error_expiry"]:
        return {"username": "KY", "profile": None}

    client = _get_strava_client()
    if not client:
        return {"username": "KY", "profile": None}

    try:
        athlete = client.get_athlete()
        data = {
            "username": f"{athlete.firstname} {athlete.lastname or ''}".strip(),
            "profile": athlete.profile_medium,
        }
        ATHLETE_CACHE["data"] = data
        ATHLETE_CACHE["expiry"] = now + 3600
        return data
    except Exception as e:
        print(f"Athlete profile fetch error: {e}")
        ATHLETE_CACHE["error_expiry"] = now + 600
        return {"username": "KY", "profile": None}

def get_strava_clubs_cached(creds=None):
    global CLUBS_CACHE
    now = time.time()
    if CLUBS_CACHE["data"] and now < CLUBS_CACHE["expiry"]:
        return CLUBS_CACHE["data"]
    if "error_expiry" in CLUBS_CACHE and now < CLUBS_CACHE["error_expiry"]:
        return []

    client = _get_strava_client()
    if not client:
        return []

    try:
        clubs = client.get_athlete_clubs()
        clubs_data = [
            {
                "id": f"club-{c.id}",
                "name": c.name,
                "icon": "🛡️",
                "color": "#10b981",
                "progress": "Joined",
                "image": c.cover_photo_small,
            }
            for c in clubs
        ]
        CLUBS_CACHE["data"] = clubs_data
        CLUBS_CACHE["expiry"] = now + 3600
        return clubs_data
    except Exception as e:
        print(f"Club fetch error: {e}")
        CLUBS_CACHE["error_expiry"] = now + 600
        return []
