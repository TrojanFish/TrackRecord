import os
import sys
import subprocess
import time
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt, Confirm
from rich.tree import Tree
from rich import print as rprint

from run_page.ui.i18n import I18N
from run_page.core.auth import load_creds, save_creds, get_credential as get_cred
from run_page.core.platforms import get_platform_configs
import run_page.ui.handlers as handlers

console = Console()
CUR_LANG = load_creds().get("language", "zh")

def L(key):
    return I18N[CUR_LANG].get(key, key)

def run_sync_script(cmd):
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.abspath("run_page") + os.pathsep + env.get("PYTHONPATH", "")
    subprocess.run(cmd, env=env)

def main():
    global CUR_LANG
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        console.print(Panel.fit(f"[bold cyan]{L('title')}[/bold cyan]\n[dim]{L('subtitle')}[/dim]", border_style="bright_blue"))
        
        configs = get_platform_configs(L, get_cred)
        tree = Tree(f"[bold white]{L('menu_title')}[/bold white]")
        flat_list = []
        
        for cat_id, items in configs.items():
            if cat_id == "cat_exit": continue
            branch = tree.add(f"[bold yellow]{L(cat_id)}[/bold yellow]")
            for item in items:
                idx = len(flat_list) + 1
                branch.add(f"[{idx}] {item['name']}")
                flat_list.append(item)
        
        tree.add(f"[bold red][0] {L('exit_prog')}[/bold red]")
        rprint(tree)
        
        try:
            choice = IntPrompt.ask(f"\n[bold cyan]{L('prompt_choice')}[/bold cyan]", default=0)
            if choice == 0: sys.exit(0)
            if choice < 1 or choice > len(flat_list): continue
            
            platform = flat_list[choice - 1]
            if "handler" in platform:
                h = platform["handler"]
                if h == "joyrun": handlers.handle_joyrun(L, get_cred, run_sync_script)
                elif h == "garmin": handlers.handle_garmin(L, get_cred, run_sync_script)
                elif h == "strava_to_garmin": handlers.handle_strava_to_garmin(L, get_cred, run_sync_script)
                elif h == "garmin_to_strava": handlers.handle_garmin_to_strava(L, get_cred, run_sync_script)
                elif h == "tcx_to_garmin": handlers.handle_tcx_to_garmin(L, get_cred, run_sync_script)
                elif h == "stats": handlers.handle_stats(L)
                elif h == "garmin_secret": handlers.handle_garmin_secret(L, get_cred, run_sync_script)
                elif h == "toggle_lang":
                    CUR_LANG = "en" if CUR_LANG == "zh" else "zh"
                    creds = load_creds()
                    creds["language"] = CUR_LANG
                    save_creds(creds)
                elif h == "reset_creds":
                    if Confirm.ask(f"[red]{L('confirm_reset')}[/red]"):
                        if os.path.exists("run_page/credentials.json"): os.remove("run_page/credentials.json")
            else:
                cmd = [sys.executable, platform["script"]] + (platform["args"]() if "args" in platform else [])
                run_sync_script(cmd)
            
            if platform.get("id") != "toggle_lang":
                Prompt.ask(f"\n[dim]{L('press_enter')}[/dim]")
        except Exception as e:
            if isinstance(e, SystemExit): raise
            console.print(f"\n[red]{L('error')}: {e}[/red]")
            time.sleep(2)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
