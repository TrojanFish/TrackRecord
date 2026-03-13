import os
import json
from rich.prompt import Prompt

CRED_FILE = "run_page/credentials.json"

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

def get_credential(key, prompt_text, password=False):
    creds = load_creds()
    default = creds.get(key, "")
    val = Prompt.ask(prompt_text, default=default, password=password)
    if val != default:
        creds[key] = val
        save_creds(creds)
    return val
