import os
import sys
import json
from stravalib import Client

# Add project root to sys.path
sys.path.append(os.getcwd())

from run_page.core.auth import load_creds

def test_athlete():
    creds = load_creds()
    strava_id = creds["strava_client_id"]
    strava_secret = creds["strava_client_secret"]
    strava_refresh = creds["strava_refresh_token"]
    
    client = Client()
    response = client.refresh_access_token(
        client_id=strava_id, client_secret=strava_secret, refresh_token=strava_refresh
    )
    client.access_token = response["access_token"]
    
    athlete = client.get_athlete()
    print(f"Athlete: {athlete.firstname} {athlete.lastname}")
    # Inspect all attributes
    attrs = sorted(athlete.__dict__.keys())
    print("Attributes:", attrs)
    
    with open("tmp_athlete.json", "w") as f:
        # Convert to dict safely
        d = {k: str(v) for k, v in athlete.__dict__.items() if not k.startswith('_')}
        json.dump(d, f, indent=4)

if __name__ == "__main__":
    test_athlete()
