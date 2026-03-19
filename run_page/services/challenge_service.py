import os
import re
import time
import hashlib
import requests
from bs4 import BeautifulSoup
from run_page.db import get_db

def parse_and_save_trophies(html_content: str) -> int:
    """Parses Strava trophies from HTML and saves them to the DB.
    Returns the number of new trophies saved.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    trophy_items = soup.find_all('div', class_='trophy-item') # Strava's common class
    if not trophy_items:
        # Fallback for alternative layouts
        trophy_items = soup.find_all('li', class_='trophy') or soup.find_all('div', class_='challenge')
    
    count = 0
    # Directory to store local icons
    trophy_icons_dir = os.path.join("run_page", "static", "trophy_icons")
    os.makedirs(trophy_icons_dir, exist_ok=True)

    with get_db() as conn:
        cur = conn.cursor()
        for item in trophy_items:
            try:
                name_tag = item.find('h4') or item.find('div', class_='name')
                img_tag = item.find('img')
                date_tag = item.find('div', class_='date') or item.find('span', class_='timestamp')
                
                if not name_tag: continue
                name = name_tag.get_text(strip=True)
                img_url = img_tag['src'] if img_tag else ""
                
                # Try to download icon locally if it's a remote URL
                local_img_url = img_url
                if img_url and img_url.startswith("http"):
                    try:
                        safe_name = re.sub(r'[^\w\s-]', '', name).strip().lower().replace(' ', '_')
                        file_ext = img_url.split('.')[-1].split('?')[0] or "png"
                        if len(file_ext) > 4: file_ext = "png"
                        
                        filename = f"{safe_name}.{file_ext}"
                        local_path = os.path.join(trophy_icons_dir, filename)
                        
                        if not os.path.exists(local_path):
                            time.sleep(0.5) 
                            r = requests.get(img_url, stream=True, timeout=10)
                            if r.status_code == 200:
                                with open(local_path, 'wb') as f:
                                    for chunk in r.iter_content(1024):
                                        f.write(chunk)
                        
                        if os.path.exists(local_path):
                            local_img_url = f"/static/trophy_icons/{filename}"
                    except Exception as img_e:
                        print(f"Failed to download trophy icon {name}: {img_e}")

                date_str = date_tag.get_text(strip=True) if date_tag else "Special"
                month_match = re.search(r'([A-Za-z]+ \d{4})', date_str)
                month_key = month_match.group(1) if month_match else "HISTORICAL"
                
                stable_hash = hashlib.md5(name.encode()).hexdigest()[:12]
                tid = f"strava-trophy-{stable_hash}"
                
                cur.execute("SELECT id FROM trophies WHERE name = ? OR id = ?", (name, tid))
                if cur.fetchone(): continue
                    
                cur.execute("""
                    INSERT OR REPLACE INTO trophies (id, name, image, color, progress, type, month)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (tid, name, local_img_url, "#ff5500", "Earned", "Strava Trophy", month_key))
                count += 1
            except Exception as e:
                print(f"Error parsing trophy item: {e}")
                continue
    return count

def get_imported_challenges_from_db() -> dict:
    """Returns all imported trophies grouped by month name (e.g., 'Jun 2025')."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM trophies ORDER BY month DESC")
        rows = cur.fetchall()
        
        month_map = {}
        for r in rows:
            m = r["month"]
            if m not in month_map:
                month_map[m] = []
            month_map[m].append(dict(r))
        return month_map
