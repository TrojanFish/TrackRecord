import os
import sys
import json
from stravalib import Client

# Add project root to sys.path
sys.path.append(os.getcwd())

from run_page.core.auth import load_creds

def test_photos():
    creds = load_creds()
    # Check if strava creds exist
    if "strava_client_id" not in creds:
        print("Strava credentials not found in flat structure.")
        return

    strava_id = creds["strava_client_id"]
    strava_secret = creds["strava_client_secret"]
    strava_refresh = creds["strava_refresh_token"]
    
    client = Client()
    
    # Refresh token
    response = client.refresh_access_token(
        client_id=strava_id,
        client_secret=strava_secret,
        refresh_token=strava_refresh
    )
    client.access_token = response["access_token"]
    
    print("Fetching last 5 activities with photos...")
    photos = []
    for activity in client.get_activities(limit=5):
        if activity.total_photo_count > 0:
            print(f"Activity {activity.id} has {activity.total_photo_count} photos. Fetching...")
            activity_photos = client.get_activity_photos(activity.id, only_instagram=False, size=800)
            for photo in activity_photos:
                print("DEBUG PHOTO ATTRS:", dir(photo))
                # Strava photos have refs/urls
                url = None
                if hasattr(photo, 'urls') and photo.urls:
                    url = photo.urls.get('800') or photo.urls.get('original') or list(photo.urls.values())[0]
                
                photos.append({
                    "unique_id": getattr(photo, 'unique_id', None),
                    "id": getattr(photo, 'id', None),
                    "url": url,
                    "title": activity.name,
                    "date": str(activity.start_date_local),
                    "activity_id": activity.id
                })
        if len(photos) >= 5:
            break
    
    print("Fetching athlete clubs...")
    clubs = client.get_athlete_clubs()
    for club in clubs:
        print(f"Club: {club.name}, ID: {club.id}, Cover: {club.cover_photo_small}")
            
    print(f"Found {len(photos)} photos.")
    if photos:
        print("First photo data sample:", photos[0])
    
    with open("tmp_photos.json", "w") as f:
        json.dump(photos, f)

if __name__ == "__main__":
    test_photos()
