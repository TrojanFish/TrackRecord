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

def handle_garmin(L, get_cred, run_sync_script, is_cn=None):
    console.print(f"\n[bold blue]⌚  Garmin (佳明) 同步[/bold blue]")
    if is_cn is None:
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
    
    # Strava Web Client needs Email/Password or JWT
    use_jwt = Confirm.ask("  Use Strava JWT? (Otherwise use Email/Password)", default=True)
    extra_args = []
    if use_jwt:
        jwt = get_cred("strava_jwt", "  Strava JWT")
        extra_args = [jwt] # The script expects JWT as the 7th argument (if email/pass are skipped)
        # Actually looking at the script:
        # 46: strava_client_id, 47: strava_client_secret, 48: strava_refresh_token, 50: secret_string, 52: email, 53: password, 54: jwt
        # If we want to skip email/pass, we must provide them as empty or use the jwt position.
    else:
        email = get_cred("strava_email", "  Strava Email")
        password = get_cred("strava_password", "  Strava Password", password=True)
        extra_args = [email, password]

    is_cn = Prompt.ask(f"  {L('is_garmin_cn')}", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    g_secret = get_cred(cred_key, "  Garmin Secret String")
    
    cmd = [sys.executable, "run_page/platforms/strava_to_garmin_sync.py", s_id, s_secret, s_token, g_secret]
    if use_jwt:
        cmd += ["", "", extra_args[0]] # empty email, empty password, then jwt
    else:
        cmd += extra_args
        
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

def handle_nike(L, get_cred, run_sync_script):
    console.print(f"\n[bold red]👟  {L('nike_name')} {L('sync_text')}[/bold red]")
    token = get_cred("nike_refresh_token", f"  {L('token')} (Refresh Token)")
    cmd = [sys.executable, "run_page/platforms/nike_sync.py", token]
    return run_sync_script(cmd)

def handle_strava(L, get_cred, run_sync_script):
    console.print(f"\n[bold orange1]🧡  Strava {L('sync_text')}[/bold orange1]")
    cid = get_cred("strava_client_id", "  Client ID")
    secret = get_cred("strava_client_secret", "  Client Secret")
    token = get_cred("strava_refresh_token", "  Refresh Token")
    cmd = [sys.executable, "run_page/platforms/strava_sync.py", cid, secret, token]
    return run_sync_script(cmd)

def handle_garmin_cn_global(L, get_cred, run_sync_script):
    console.print(f"\n[bold blue]⌚  Garmin CN -> Global {L('sync_text')}[/bold blue]")
    secret_cn = get_cred("garmin_secret_cn", "  CN Secret String")
    secret_global = get_cred("garmin_secret_global", "  Global Secret String")
    cmd = [sys.executable, "run_page/platforms/garmin_sync_cn_global.py", secret_cn, secret_global]
    return run_sync_script(cmd)

def handle_garmin_global_cn(L, get_cred, run_sync_script):
    console.print(f"\n[bold blue]⌚  Garmin Global -> CN {L('sync_text')}[/bold blue]")
    secret_global = get_cred("garmin_secret_global", "  Global Secret String")
    secret_cn = get_cred("garmin_secret_cn", "  CN Secret String")
    cmd = [sys.executable, "run_page/platforms/garmin_sync_global_cn.py", secret_global, secret_cn]
    return run_sync_script(cmd)

def handle_tcx_to_strava(L, get_cred, run_sync_script):
    console.print(f"\n[bold orange1]🧡  TCX -> Strava {L('sync_text')}[/bold orange1]")
    cid = get_cred("strava_client_id", "  Client ID")
    secret = get_cred("strava_client_secret", "  Client Secret")
    token = get_cred("strava_refresh_token", "  Refresh Token")
    cmd = [sys.executable, "run_page/platforms/tcx_to_strava_sync.py", cid, secret, token]
    if Confirm.ask("  Upload ALL files? (Otherwise only new)", default=False):
        cmd.append("--all")
    return run_sync_script(cmd)

def handle_gpx_to_strava(L, get_cred, run_sync_script):
    console.print(f"\n[bold orange1]🧡  GPX -> Strava {L('sync_text')}[/bold orange1]")
    cid = get_cred("strava_client_id", "  Client ID")
    secret = get_cred("strava_client_secret", "  Client Secret")
    token = get_cred("strava_refresh_token", "  Refresh Token")
    cmd = [sys.executable, "run_page/platforms/gpx_to_strava_sync.py", cid, secret, token]
    return run_sync_script(cmd)

def handle_nike_to_strava(L, get_cred, run_sync_script):
    console.print(f"\n[bold red]👟  Nike[/bold red] [bold white]->[/bold white] [bold orange1]Strava {L('sync_text')}[/bold orange1]")
    nike_token = get_cred("nike_refresh_token", "  Nike Refresh Token")
    cid = get_cred("strava_client_id", "  Strava Client ID")
    secret = get_cred("strava_client_secret", "  Strava Client Secret")
    token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    cmd = [sys.executable, "run_page/platforms/nike_to_strava_sync.py", nike_token, cid, secret, token]
    return run_sync_script(cmd)

def handle_toggle_lang(L, get_cred, run_sync_script):
    from run_page.auth import load_creds, save_creds
    from run_page.config import DEFAULT_LANGUAGE
    SUPPORTED_LANGUAGES = ["en", "zh"]
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
    "garmin": lambda L, get_cred, run_sync_script: handle_garmin(L, get_cred, run_sync_script, is_cn=False),
    "garmin_cn": lambda L, get_cred, run_sync_script: handle_garmin(L, get_cred, run_sync_script, is_cn=True),
    "nike": handle_nike,
    "strava": handle_strava,
    "garmin_cn_global": handle_garmin_cn_global,
    "garmin_global_cn": handle_garmin_global_cn,
    "strava_to_garmin": handle_strava_to_garmin,
    "garmin_to_strava": handle_garmin_to_strava,
    "tcx_to_garmin": handle_tcx_to_garmin,
    "tcx_to_strava": handle_tcx_to_strava,
    "gpx_to_strava": handle_gpx_to_strava,
    "nike_to_strava": handle_nike_to_strava,
    "stats": lambda L, get_cred, run_sync_script: handle_stats(L),
    "garmin_secret": handle_garmin_secret,
    "toggle_lang": handle_toggle_lang,
    "reset_creds": handle_reset_creds,
}
