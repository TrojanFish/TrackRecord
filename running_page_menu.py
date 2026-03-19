import os
import sys
import subprocess
import time
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt
from rich.tree import Tree
from rich import print as rprint

from run_page.ui.i18n import I18N
from run_page.core.auth import load_creds, save_creds, get_credential as get_cred
from run_page.core.platforms import get_platform_configs
import run_page.ui.handlers as handlers
from run_page.core.config import DEFAULT_LANGUAGE

console = Console()
CUR_LANG = load_creds().get("language", DEFAULT_LANGUAGE)

def L(key):
    return I18N[CUR_LANG].get(key, key)

def run_sync_script(cmd):
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.abspath("run_page") + os.pathsep + env.get("PYTHONPATH", "")
    try:
        # Capture output for controlled display
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode == 0:
            console.print(f"\n[bold green]✅ 同步成功！ (Sync Success)[/bold green]")
            return True
        else:
            console.print(f"\n[bold red]❌ 同步失败 (Sync Failed) - 错误代码: {result.returncode}[/bold red]")
            stderr_content = result.stderr or ""
            lines = stderr_content.strip().split('\n')
            last_lines = lines[-20:]
            console.print(f"[red]最后 20 行错误详情 (Error details):[/red]")
            for line in last_lines:
                if line.strip():
                    console.print(f"  [dim]{line}[/dim]")
            return False
    except Exception as e:
        console.print(f"\n[bold red]❌ 执行过程中发生异常 (Exception): {e}[/bold red]")
        return False

def main():
    global CUR_LANG
    while True:
        # Refresh language from credentials
        CUR_LANG = load_creds().get("language", DEFAULT_LANGUAGE)
        
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
            success = True
            if "handler" in platform:
                h = platform["handler"]
                handler_fn = handlers.HANDLER_REGISTRY.get(h)
                if handler_fn:
                    success = handler_fn(L, get_cred, run_sync_script)
            else:
                cmd = [sys.executable, platform["script"]] + (platform["args"]() if "args" in platform else [])
                success = run_sync_script(cmd)
            
            # Decide whether to wait for user acknowledgment
            # Always wait on failure, or for informational tools like stats
            if platform.get("id") != "toggle_lang":
                if not success or platform.get("id") == "stats":
                    Prompt.ask(f"\n[dim]{L('press_enter')}[/dim]")
                elif success:
                    # Brief pause if successful, or just continue to menu
                    time.sleep(1)
        except Exception as e:
            if isinstance(e, SystemExit): raise
            console.print(f"\n[red]{L('error')}: {e}[/red]")
            time.sleep(2)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
