# -*- coding: utf-8 -*-
import sys
import os
import sqlite3
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich.table import Table

console = Console()

def handle_joyrun(L, get_cred, run_sync_script):
    console.print(f"\n[bold cyan]🏃  {L('joyrun_name')} {L('sync_text')}[/bold cyan]")
    mode = Prompt.ask(f"  {L('login_mode')}", choices=["1", "2"], default="1")
    if mode == "1":
        phone = get_cred("joyrun_phone", f"  {L('account')}")
        code = get_cred("joyrun_code", f"  {L('sms_code')}")
        cmd = [sys.executable, "run_page/platforms/joyrun_sync.py", phone, code, "--with-gpx"]
    else:
        uid = get_cred("joyrun_uid", "  UID")
        sid = get_cred("joyrun_sid", "  SID")
        cmd = [sys.executable, "run_page/platforms/joyrun_sync.py", uid, sid, "--from-uid-sid", "--with-gpx"]
    return run_sync_script(cmd)

def handle_garmin(L, get_cred, run_sync_script):
    console.print(f"\n[bold blue]⌚  Garmin (佳明) 同步[/bold blue]")
    is_cn = Prompt.ask(f"  {L('is_garmin_cn')}", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    secret = get_cred(cred_key, "  Secret String")
    cmd = [sys.executable, "run_page/platforms/garmin_sync.py", secret]
    if is_cn: cmd.append("--is-cn")
    return run_sync_script(cmd)

def handle_stats(L):
    db_path = "run_page/data.db"
    if not os.path.exists(db_path):
        console.print(f"[red]{L('db_not_found')}[/red]")
        return False
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), SUM(distance) FROM activities WHERE type IN ('Run', 'Ride', 'Hike', 'Walk')")
        count, total_dist = cur.fetchone()
        total_dist = (total_dist or 0) / 1000.0
        
        console.print(Panel(f"[bold white]{L('total_count')}[/bold white] [cyan]{count}[/cyan]\n"
                            f"[bold white]{L('total_dist')}[/bold white] [green]{total_dist:.2f} km[/green]",
                            title=L("overview"), border_style="green"))
        conn.close()
        return True
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return False

def handle_strava_to_garmin(L, get_cred, run_sync_script):
    console.print(f"\n[bold orange1]🧡  Strava[/bold orange1] [bold white]->[/bold white] [bold blue]Garmin 同步[/bold blue]")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    is_cn = Prompt.ask(f"  {L('is_garmin_cn')}", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    g_secret = get_cred(cred_key, "  Garmin Secret String")
    cmd = [sys.executable, "run_page/platforms/strava_to_garmin_sync.py", s_id, s_secret, s_token, g_secret]
    if is_cn: cmd.append("--is-cn")
    return run_sync_script(cmd)

def handle_garmin_to_strava(L, get_cred, run_sync_script):
    console.print(f"\n[bold blue]⌚  Garmin[/bold blue] [bold white]->[/bold white] [bold orange1]Strava 同步[/bold orange1]")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    is_cn = Prompt.ask(f"  {L('is_garmin_cn')}", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    g_secret = get_cred(cred_key, "  Garmin Secret String")
    cmd = [sys.executable, "run_page/platforms/garmin_to_strava_sync.py", s_id, s_secret, s_token, g_secret]
    if is_cn: cmd.append("--is-cn")
    return run_sync_script(cmd)

def handle_tcx_to_garmin(L, get_cred, run_sync_script):
    console.print(f"\n[bold white]📂  TCX[/bold white] [bold white]->[/bold white] [bold blue]Garmin 同步[/bold blue]")
    is_cn = Prompt.ask(f"  {L('is_garmin_cn')}", choices=["y", "n"], default="y") == "y"
    cmd = [sys.executable, "run_page/platforms/tcx_to_garmin_sync.py", get_cred("garmin_secret_cn" if is_cn else "garmin_secret_global", "  Garmin Secret")]
    if is_cn: cmd.append("--is-cn")
    return run_sync_script(cmd)

def handle_garmin_secret(L, get_cred, run_sync_script):
    console.print(f"\n[bold blue]🔑  {L('get_garmin_secret')}[/bold blue]")
    email = get_cred("garmin_email", "  Email")
    password = get_cred("garmin_password", "  Password", password=True)
    is_cn = Prompt.ask(f"  {L('is_garmin_cn')}", choices=["y", "n"], default="y") == "y"
    cmd = [sys.executable, "run_page/tools/get_garmin_secret.py", email, password]
    if is_cn: cmd.append("--is-cn")
    return run_sync_script(cmd)

def handle_toggle_lang(L, get_cred, run_sync_script):
    from run_page.auth import load_creds, save_creds
    DEFAULT_LANGUAGE = "en"
    SUPPORTED_LANGUAGES = ["en", "zh-CN"]
    creds = load_creds()
    cur_lang = creds.get("language", DEFAULT_LANGUAGE)
    new_lang = SUPPORTED_LANGUAGES[1] if cur_lang == SUPPORTED_LANGUAGES[0] else SUPPORTED_LANGUAGES[0]
    creds["language"] = new_lang
    save_creds(creds)
    return True

def handle_reset_creds(L, get_cred, run_sync_script):
    from run_page.auth import CRED_FILE
    import pathlib
    cred_path = pathlib.Path(CRED_FILE)
    if Confirm.ask(f"[red]{L('confirm_reset')}[/red]"):
        if cred_path.exists():
            cred_path.unlink()
    return True

HANDLER_REGISTRY = {
    "joyrun": handle_joyrun,
    "garmin": handle_garmin,
    "strava_to_garmin": handle_strava_to_garmin,
    "garmin_to_strava": handle_garmin_to_strava,
    "tcx_to_garmin": handle_tcx_to_garmin,
    "stats": lambda L, get_cred, run_sync_script: handle_stats(L),
    "garmin_secret": handle_garmin_secret,
    "toggle_lang": handle_toggle_lang,
    "reset_creds": handle_reset_creds,
}
