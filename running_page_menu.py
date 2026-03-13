import os
import sys
import subprocess
import time
import sqlite3
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt
from rich.tree import Tree
from rich import print as rprint
from rich.table import Table

import json
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt, Confirm
from rich.tree import Tree
from rich import print as rprint
from rich.table import Table

console = Console()
CRED_FILE = "run_page/credentials.json"

# --- I18N Support ---
I18N = {
    "zh": {
        "title": "TrojanFish / TrackRecord",
        "subtitle": "运动数据同步终端 (v3.0)",
        "menu_title": "📋 同步功能分类",
        "prompt_choice": "请输入数字编号执行任务",
        "press_enter": "执行完毕，按 Enter 返回主菜单...",
        "error": "发生错误",
        "exit": "已退出。",
        "confirm_reset": "确定要重置所有保存的凭证吗？",
        "reset_done": "凭证已重置。",
        "no_creds": "没有找到已保存的凭证。",
        "db_not_found": "错误：数据库文件不存在，请先同步数据。",
        "stats_title": "📊  运动数据本地统计",
        "total_count": "总运动次数:",
        "total_dist": "总运动里程:",
        "overview": "概览",
        "yearly_stats": "年度统计",
        "year": "年份",
        "count": "次数",
        "dist": "里程",
        "lang_name": "English (Switch to English)",
        "is_cn_prompt": "是否为中国区 (CN)?",
        "is_garmin_cn": "是否为 Garmin 中国区 (CN)?",
        "login_mode": "登录方式",
        "sms_code": "验证码",
        "uid_sid": "UID/SID",
        "account": "账号/手机号",
        "password": "密码",
        "token": "Token",
        "secret": "密钥/Secret",
        "sync_text": "同步",
        "dir": "目录",
        "cat_api": "🔌 API 直接同步 (Direct API Sync)",
        "cat_file_sync": "📂 运动文件同步 [下载并解析] (Download & File Parsing)",
        "cat_mirror": "🔄 跨平台同步与镜像 (Cross-Platform Sync & Mirroring)",
        "cat_local": "💻 本地文件处理 (Local Files)",
        "cat_tools": "🛠️ 工具与统计 (Tools & Stats)",
        "cat_exit": "🚪 退出 (Exit)",
        "xingzhe_name": "行者 (Xingzhe)",
        "joyrun_name": "悦跑圈 (Joyrun)",
        "tulip_name": "郁金香运动 (TulipSport)",
        "garmin_name": "Garmin (佳明)",
        "coros_name": "Coros (高跑)",
        "onelap_name": "顽鹿 (Onelap)",
        "import_local": "导入本地",
        "view_stats": "查看本地运动统计 (Local Activity Stats)",
        "get_garmin_secret": "获取 Garmin Secret String (新账号必做)",
        "reset_creds": "重置所有已保存凭证 (Reset All Saved Credentials)",
        "exit_prog": "退出程序 (Exit)",
    },
    "en": {
        "title": "TrojanFish / TrackRecord",
        "subtitle": "Sports Data Sync Terminal (v3.0)",
        "menu_title": "📋 Sync Categories",
        "prompt_choice": "Enter number to execute task",
        "press_enter": "Task finished, press Enter to return...",
        "error": "Error occurred",
        "exit": "Exited.",
        "confirm_reset": "Are you sure you want to reset all saved credentials?",
        "reset_done": "Credentials reset.",
        "no_creds": "No saved credentials found.",
        "db_not_found": "Error: Database not found. Please sync data first.",
        "stats_title": "📊  Local Activity Stats",
        "total_count": "Total Activities:",
        "total_dist": "Total Distance:",
        "overview": "Overview",
        "yearly_stats": "Yearly Stats",
        "year": "Year",
        "count": "Count",
        "dist": "Distance",
        "lang_name": "中文 (切换到中文)",
        "is_cn_prompt": "Is it China region (CN)?",
        "is_garmin_cn": "Is it Garmin China (CN)?",
        "login_mode": "Login Mode",
        "sms_code": "SMS Code",
        "uid_sid": "UID/SID Mode",
        "account": "Account/Phone",
        "password": "Password",
        "token": "Token",
        "secret": "Secret String",
        "sync_text": "Sync",
        "dir": "Dir",
        "cat_api": "🔌 Direct API Sync",
        "cat_file_sync": "📂 Download & File Parsing",
        "cat_mirror": "🔄 Cross-Platform Sync & Mirroring",
        "cat_local": "💻 Local Files Processing",
        "cat_tools": "🛠️ Tools & Stats",
        "cat_exit": "🚪 Exit",
        "xingzhe_name": "Xingzhe",
        "joyrun_name": "Joyrun",
        "tulip_name": "TulipSport",
        "garmin_name": "Garmin",
        "coros_name": "Coros",
        "onelap_name": "Onelap",
        "import_local": "Import Local",
        "view_stats": "View Statistics",
        "get_garmin_secret": "Get Garmin Secret (First Time User)",
        "reset_creds": "Reset Saved Credentials",
        "exit_prog": "Exit Program",
    }
}

CUR_LANG = "zh"

def load_creds():
    global CUR_LANG
    if os.path.exists(CRED_FILE):
        with open(CRED_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            CUR_LANG = data.get("language", "zh")
            return data
    return {}

def save_creds(creds):
    creds["language"] = CUR_LANG
    with open(CRED_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=4, ensure_ascii=False)

def L(key):
    return I18N[CUR_LANG].get(key, key)

def handle_toggle_lang():
    global CUR_LANG
    creds = load_creds()
    CUR_LANG = "en" if CUR_LANG == "zh" else "zh"
    save_creds(creds)

def get_cred(key, prompt_text, password=False):
    creds = load_creds()
    default = creds.get(key, "")
    val = Prompt.ask(prompt_text, default=default, password=password)
    if val != default:
        creds[key] = val
        save_creds(creds)
    return val


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


def show_header():
    console.print(
        Panel.fit(
            f"[bold cyan]{L('title')}[/bold cyan]\n"
            f"[dim]{L('subtitle')}[/dim]",
            border_style="bright_blue",
        )
    )


def run_sync_script(cmd):
    """Run a sync script with run_page in the PYTHONPATH."""
    env = os.environ.copy()
    run_page_dir = os.path.abspath("run_page")
    env["PYTHONPATH"] = run_page_dir + os.pathsep + env.get("PYTHONPATH", "")
    subprocess.run(cmd, env=env)


# --- Sync Handlers ---


def handle_xingzhe():
    console.print(f"\n[bold yellow]🚵  {L('xingzhe_name')} {L('sync_text')}[/bold yellow]")
    account = get_cred("xingzhe_account", f"  {L('account')} (Xingzhe)")
    password = get_cred("xingzhe_password", f"  {L('password')} (Xingzhe)", password=True)
    cmd = [
        sys.executable,
        "run_page/platforms/xingzhe_sync.py",
        "--account",
        account,
        "--password",
        password,
        "--with-gpx",
    ]
    run_sync_script(cmd)


def handle_keep():
    console.print(f"\n[bold green]👟  Keep {L('sync_text')}[/bold green]")
    phone = get_cred("keep_phone", f"  {L('account')} (Keep)")
    password = get_cred("keep_password", f"  {L('password')} (Keep)", password=True)
    cmd = [sys.executable, "run_page/platforms/keep_sync.py", phone, password, "--with-gpx"]
    run_sync_script(cmd)


def handle_joyrun():
    console.print(f"\n[bold cyan]🏃  {L('joyrun_name')} {L('sync_text')}[/bold cyan]")
    mode = Prompt.ask(f"  {L('login_mode')}", choices=["1", "2"], default="1")
    if mode == "1":
        phone = get_cred("joyrun_phone", f"  {L('account')}")
        code = get_cred("joyrun_code", f"  {L('sms_code')}")
        cmd = [sys.executable, "run_page/platforms/joyrun_sync.py", phone, code, "--with-gpx"]
    else:
        uid = get_cred("joyrun_uid", "  UID")
        sid = get_cred("joyrun_sid", "  SID")
        cmd = [
            sys.executable,
            "run_page/platforms/joyrun_sync.py",
            uid,
            sid,
            "--from-uid-sid",
            "--with-gpx",
        ]
    run_sync_script(cmd)


def handle_tulip():
    console.print("\n[bold magenta]🌷  郁金香运动 (TulipSport) 同步[/bold magenta]")
    token = get_cred("tulip_token", "  Tulip Token")
    cmd = [sys.executable, "run_page/platforms/tulipsport_sync.py", token]
    run_sync_script(cmd)


def handle_igpsport():
    console.print("\n[bold orange3]🚲  iGPSPORT 同步[/bold orange3]")
    username = get_cred("igpsport_username", "  用户名")
    password = get_cred("igpsport_password", "  密码", password=True)
    cmd = [
        sys.executable,
        "run_page/platforms/igpsport_sync.py",
        username,
        password,
        "--with-gpx",
        "--with-fit",
    ]
    run_sync_script(cmd)


def handle_onelap():
    console.print("\n[bold purple]🚲  顽鹿 (Onelap) 同步[/bold purple]")
    username = get_cred("onelap_username", "  用户名")
    password = get_cred("onelap_password", "  密码", password=True)
    cmd = [sys.executable, "run_page/platforms/onelap_sync.py", username, password]
    run_sync_script(cmd)


def handle_oppo():
    console.print("\n[bold green]📱  OPPO (HeyTap) 同步[/bold green]")
    c_id = get_cred("oppo_client_id", "  Client ID")
    c_secret = get_cred("oppo_client_secret", "  Client Secret")
    r_token = get_cred("oppo_refresh_token", "  Refresh Token")
    cmd = [
        sys.executable,
        "run_page/platforms/oppo_sync.py",
        c_id,
        c_secret,
        r_token,
        "--with-gpx",
    ]
    run_sync_script(cmd)


def handle_garmin():
    console.print("\n[bold blue]⌚  Garmin (佳明) 同步[/bold blue]")
    is_cn = Prompt.ask("  是否为中国区 (CN)?", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    secret = get_cred(cred_key, "  Secret String (从 get_garmin_secret.py 获取)")
    cmd = [sys.executable, "run_page/platforms/garmin_sync.py", secret]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_get_garmin_secret():
    console.print("\n[bold blue]🔑  获取佳明 Secret String[/bold blue]")
    email = get_cred("garmin_email", "  Email")
    password = get_cred("garmin_password", "  Password", password=True)
    is_cn = Prompt.ask("  是否为中国区 (CN)?", choices=["y", "n"], default="y") == "y"
    cmd = [sys.executable, "run_page/tools/get_garmin_secret.py", email, password]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_nike():
    console.print("\n[bold red]✔  Nike Run Club 同步[/bold red]")
    token = get_cred("nike_token", "  Refresh Token / Access Token")
    cmd = [sys.executable, "run_page/platforms/nike_sync.py", token]
    run_sync_script(cmd)


def handle_strava():
    console.print("\n[bold orange1]🧡  Strava 同步[/bold orange1]")
    c_id = get_cred("strava_client_id", "  Client ID")
    c_secret = get_cred("strava_client_secret", "  Client Secret")
    r_token = get_cred("strava_refresh_token", "  Refresh Token")
    cmd = [sys.executable, "run_page/platforms/strava_sync.py", c_id, c_secret, r_token]
    run_sync_script(cmd)


def handle_coros():
    console.print("\n[bold white]⌚  Coros (高跑) 同步[/bold white]")
    account = get_cred("coros_account", "  账号")
    password = get_cred("coros_password", "  密码", password=True)
    cmd = [sys.executable, "run_page/platforms/coros_sync.py", account, password]
    run_sync_script(cmd)


def handle_komoot():
    console.print("\n[bold green4]🌲  Komoot 同步[/bold green4]")
    email = get_cred("komoot_email", "  Email")
    password = get_cred("komoot_password", "  密码", password=True)
    cmd = [sys.executable, "run_page/platforms/komoot_sync.py", email, password]
    run_sync_script(cmd)


def handle_nike_to_strava():
    console.print("\n[bold red]✔  Nike[/bold red] [bold white]->[/bold white] [bold orange1]Strava 同步[/bold orange1]")
    nike_token = get_cred("nike_token", "  Nike Refresh Token")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    cmd = [
        sys.executable,
        "run_page/platforms/nike_to_strava_sync.py",
        nike_token,
        s_id,
        s_secret,
        s_token,
        "--continue-sync",
    ]
    run_sync_script(cmd)


def handle_keep_to_strava():
    console.print("\n[bold green]👟  Keep[/bold green] [bold white]->[/bold white] [bold orange1]Strava 同步[/bold orange1]")
    phone = get_cred("keep_phone", "  Keep 手机号")
    password = get_cred("keep_password", "  Keep 密码", password=True)
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    cmd = [
        sys.executable,
        "run_page/platforms/keep_to_strava_sync.py",
        phone,
        password,
        s_id,
        s_secret,
        s_token,
    ]
    run_sync_script(cmd)


def handle_strava_to_garmin():
    console.print("\n[bold orange1]🧡  Strava[/bold orange1] [bold white]->[/bold white] [bold blue]Garmin 同步[/bold blue]")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    is_cn = Prompt.ask("  是否为 Garmin 中国区 (CN)?", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    g_secret = get_cred(cred_key, "  Garmin Secret String")
    cmd = [
        sys.executable,
        "run_page/platforms/strava_to_garmin_sync.py",
        s_id,
        s_secret,
        s_token,
        g_secret,
    ]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_garmin_to_strava():
    console.print("\n[bold blue]⌚  Garmin[/bold blue] [bold white]->[/bold white] [bold orange1]Strava 同步[/bold orange1]")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    is_cn = Prompt.ask("  是否为 Garmin 中国区 (CN)?", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    g_secret = get_cred(cred_key, "  Garmin Secret String")
    cmd = [
        sys.executable,
        "run_page/platforms/garmin_to_strava_sync.py",
        s_id,
        s_secret,
        s_token,
        g_secret,
    ]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_gpx_to_strava():
    console.print("\n[bold white]📂  GPX[/bold white] [bold white]->[/bold white] [bold orange1]Strava 同步[/bold orange1]")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    cmd = [
        sys.executable,
        "run_page/platforms/gpx_to_strava_sync.py",
        s_id,
        s_secret,
        s_token,
    ]
    run_sync_script(cmd)


def handle_tcx_to_strava():
    console.print("\n[bold white]📂  TCX[/bold white] [bold white]->[/bold white] [bold orange1]Strava 同步[/bold orange1]")
    s_id = get_cred("strava_client_id", "  Strava Client ID")
    s_secret = get_cred("strava_client_secret", "  Strava Client Secret")
    s_token = get_cred("strava_refresh_token", "  Strava Refresh Token")
    cmd = [
        sys.executable,
        "run_page/platforms/tcx_to_strava_sync.py",
        s_id,
        s_secret,
        s_token,
    ]
    run_sync_script(cmd)


def handle_tcx_to_garmin():
    console.print("\n[bold white]📂  TCX[/bold white] [bold white]->[/bold white] [bold blue]Garmin 同步[/bold blue]")
    is_cn = Prompt.ask("  是否为 Garmin 中国区 (CN)?", choices=["y", "n"], default="y") == "y"
    cred_key = "garmin_secret_cn" if is_cn else "garmin_secret_global"
    g_secret = get_cred(cred_key, "  Garmin Secret String")
    cmd = [
        sys.executable,
        "run_page/platforms/tcx_to_garmin_sync.py",
        g_secret,
    ]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_local_sync(file_type):
    msg = {"gpx": "GPX", "tcx": "TCX", "fit": "FIT"}[file_type]
    console.print(f"\n[bold white]📂  导入本地 {msg} 文件到数据库[/bold white]")
    cmd = [sys.executable, f"run_page/platforms/{file_type}_sync.py"]
    run_sync_script(cmd)
def handle_reset_creds():
    if Confirm.ask("[red]确定要重置所有保存的凭证吗？[/red]"):
        if os.path.exists(CRED_FILE):
            os.remove(CRED_FILE)
            console.print("[green]凭证已重置。[/green]")
        else:
            console.print("[yellow]没有找到已保存的凭证。[/yellow]")


def handle_stats():
    console.print("\n[bold spring_green3]📊  运动数据本地统计 (Local Stats)[/bold spring_green3]")
    db_path = "run_page/data.db"
    if not os.path.exists(db_path):
        console.print("[red]错误：数据库文件不存在，请先同步数据。[/red]")
        return

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # 1. Total Stats
        cur.execute(
            "SELECT COUNT(*), SUM(distance) FROM activities WHERE type IN ('Run', 'Ride', 'Hike', 'Walk')"
        )
        count, total_dist = cur.fetchone()
        total_dist = (total_dist or 0) / 1000.0  # to km

        # 2. Yearly Stats
        cur.execute(
            """
            SELECT strftime('%Y', start_date_local) as year, 
                   COUNT(*), 
                   SUM(distance)/1000.0 
            FROM activities 
            WHERE type IN ('Run', 'Ride', 'Hike', 'Walk')
            GROUP BY year 
            ORDER BY year DESC
        """
        )
        yearly_data = cur.fetchall()

        # Display Total
        console.print(
            Panel(
                f"[bold white]总运动次数:[/bold white] [cyan]{count}[/cyan]\n"
                f"[bold white]总运动里程:[/bold white] [green]{total_dist:.2f} km[/green]",
                title="概览 (Overview)",
                border_style="green",
            )
        )

        # Display Table
        table = Table(title="年度统计 (Yearly Stats)", box=None)
        table.add_column("年份 (Year)", style="cyan")
        table.add_column("次数 (Count)", justify="right")
        table.add_column("里程 (Distance)", justify="right", style="green")

        for year, y_count, y_dist in yearly_data:
            table.add_row(str(year), str(y_count), f"{y_dist:.2f} km")

        console.print(table)
        conn.close()
    except Exception as e:
        console.print(f"[red]查询数据库时发生错误: {e}[/red]")




# --- Menu Mapping (Adjusted for logic categorization) ---

# --- I18N Helper for Menu ---
def get_menu_structure():
    return {
        "1": {
            "label": L("cat_api"),
            "items": [
                {"name": L("xingzhe_name"), "func": handle_xingzhe},
                {"name": "Keep", "func": handle_keep},
                {"name": L("joyrun_name"), "func": handle_joyrun},
                {"name": "Nike Run Club (NRC)", "func": handle_nike},
                {"name": "Strava", "func": handle_strava},
                {"name": "OPPO (HeyTap)", "func": handle_oppo},
                {"name": L("tulip_name"), "func": handle_tulip},
            ],
        },
        "2": {
            "label": L("cat_file_sync"),
            "items": [
                {"name": L("garmin_name"), "func": handle_garmin},
                {"name": L("coros_name"), "func": handle_coros},
                {"name": "iGPSPORT", "func": handle_igpsport},
                {"name": L("onelap_name"), "func": handle_onelap},
                {"name": "Komoot", "func": handle_komoot},
            ],
        },
        "3": {
            "label": L("cat_mirror"),
            "items": [
                {"name": "Nike -> Strava", "func": handle_nike_to_strava},
                {"name": "Keep -> Strava", "func": handle_keep_to_strava},
                {"name": "Strava -> Garmin", "func": handle_strava_to_garmin},
                {"name": "Garmin -> Strava", "func": handle_garmin_to_strava},
                {"name": "GPX -> Strava", "func": handle_gpx_to_strava},
                {"name": "TCX -> Strava", "func": handle_tcx_to_strava},
                {"name": "TCX -> Garmin", "func": handle_tcx_to_garmin},
            ],
        },
        "4": {
            "label": L("cat_local"),
            "items": [
                {
                    "name": f"{L('import_local')} GPX ({L('dir')} GPX_OUT)",
                    "func": lambda: handle_local_sync("gpx"),
                },
                {
                    "name": f"{L('import_local')} TCX ({L('dir')} TCX_OUT)",
                    "func": lambda: handle_local_sync("tcx"),
                },
                {
                    "name": f"{L('import_local')} FIT ({L('dir')} FIT_OUT)",
                    "func": lambda: handle_local_sync("fit"),
                },
            ],
        },
        "5": {
            "label": L("cat_tools"),
            "items": [
                {
                    "name": L("view_stats"),
                    "func": handle_stats,
                },
                {
                    "name": L("get_garmin_secret"),
                    "func": handle_get_garmin_secret,
                },
                {
                    "name": L("reset_creds"),
                    "func": handle_reset_creds,
                },
                {
                    "name": f"[bold magenta]{L('lang_name')}[/bold magenta]",
                    "func": handle_toggle_lang,
                },
            ],
        },
        "0": {
            "label": L("cat_exit"),
            "items": [{"name": L("exit_prog"), "func": sys.exit}],
        },
    }


def main():
    while True:
        clear_screen()
        show_header()

        menu = get_menu_structure()
        tree = Tree(f"[bold white]{L('menu_title')}[/bold white]")
        flat_list = []

        for cat_id, cat_data in menu.items():
            if cat_id == "0":
                continue
            branch = tree.add(f"[bold yellow]{cat_data['label']}[/bold yellow]")
            for item in cat_data["items"]:
                idx = len(flat_list) + 1
                branch.add(f"[{idx}] {item['name']}")
                flat_list.append(item)

        # Explicitly add Exit as 0
        cat_exit = menu.get("0")
        if cat_exit:
            exit_item = cat_exit["items"][0]
            tree.add(f"[bold red][0] {exit_item['name']}[/bold red]")

        rprint(tree)

        try:
            choice = IntPrompt.ask(f"\n[bold cyan]{L('prompt_choice')}[/bold cyan]")
            if choice == 0:
                sys.exit(0)
            if choice < 1 or choice > len(flat_list):
                continue
            item = flat_list[choice - 1]
            item["func"]()
            if item["func"] != handle_toggle_lang:
                Prompt.ask(f"\n[dim]{L('press_enter')}[/dim]")
        except Exception as e:
            if isinstance(e, SystemExit):
                raise
            console.print(f"\n[red]{L('error')}: {e}[/red]")
            time.sleep(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]已退出。[/yellow]")
        sys.exit(0)
