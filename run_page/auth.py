import os
import json
try:
    from rich.prompt import Prompt
except ImportError:
    Prompt = None

# Default path for credentials file
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

def get_credential(key, prompt_text=None, password=False, headless=False):
    # 1. Try environment variables first (Standard for Docker/VPS)
    env_key = key.upper()
    val = os.environ.get(env_key)
    if val: return val

    # 2. Try credentials.json
    creds = load_creds()
    val = creds.get(key, "")
    
    # 2.1 Validation: Ignore common incorrect inputs like command lines or template variables
    if val and (val.startswith("python ") or "${" in val):
        val = ""

    if val or headless or prompt_text is None:
        return val
    
    # 3. Interactive prompt
    if Prompt:
        val = Prompt.ask(prompt_text, default=val, password=password)
        if val:
            # Re-validate user input from prompt
            if val.startswith("python ") or "${" in val:
                console = None
                try: from rich.console import Console; console = Console()
                except: pass
                if console: console.print("[red]❌ 输入格式错误，请输入 Base64 密钥字符串而非命令！[/red]")
                return get_credential(key, prompt_text, password, headless)
            creds[key] = val
            save_creds(creds)
    return val
