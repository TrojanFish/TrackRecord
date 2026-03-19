import os
import json
from rich.prompt import Prompt
from run_page.core.config import CREDENTIALS_FILE as CRED_FILE

def load_creds():
    if os.path.exists(CRED_FILE):
        try:
            with open(CRED_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_creds(creds):
    with open(CRED_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=4, ensure_ascii=False)

def get_credential(key, prompt_text=None, password=False, headless=False):
    # 1. Try environment variables first (Standard for Docker/VPS)
    env_key = key.upper()
    val = os.environ.get(env_key)
    if val:
        return val

    # 2. Try credentials.json
    creds = load_creds()
    val = creds.get(key, "")
    if val or headless or prompt_text is None:
        return val
    
    # 3. Interactive prompt as last resort
    val = Prompt.ask(prompt_text, default=val, password=password)
    if val:
        creds[key] = val
        save_creds(creds)
    return val
