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

console = Console()


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


def show_header():
    console.print(
        Panel.fit(
            "[bold cyan]TrojanFish / TrackRecord[/bold cyan]\n"
            "[dim]Sports Data Sync Terminal Hub (v3.0)[/dim]",
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
    console.print("\n[bold yellow]🚵  行者 (Xingzhe) 同步[/bold yellow]")
    console.print("[dim]提示：您可以直接输入账号密码，脚本将自动处理 RSA 加密[/dim]")
    account = Prompt.ask("  手机号/邮箱 (Account)")
    password = Prompt.ask("  密码 (Password)", password=True)
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
    console.print("\n[bold green]👟  Keep 同步[/bold green]")
    phone = Prompt.ask("  手机号 (Phone)")
    password = Prompt.ask("  密码 (Password)", password=True)
    cmd = [sys.executable, "run_page/platforms/keep_sync.py", phone, password, "--with-gpx"]
    run_sync_script(cmd)


def handle_joyrun():
    console.print("\n[bold cyan]🏃  悦跑圈 (Joyrun) 同步[/bold cyan]")
    mode = Prompt.ask("  登录方式", choices=["1", "2"], default="1")
    if mode == "1":
        phone = Prompt.ask("  手机号")
        code = Prompt.ask("  验证码")
        cmd = [sys.executable, "run_page/platforms/joyrun_sync.py", phone, code, "--with-gpx"]
    else:
        uid = Prompt.ask("  UID")
        sid = Prompt.ask("  SID")
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
    token = Prompt.ask("  Tulip Token")
    cmd = [sys.executable, "run_page/platforms/tulipsport_sync.py", token]
    run_sync_script(cmd)


def handle_igpsport():
    console.print("\n[bold orange3]🚲  iGPSPORT 同步[/bold orange3]")
    username = Prompt.ask("  用户名")
    password = Prompt.ask("  密码", password=True)
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
    username = Prompt.ask("  用户名")
    password = Prompt.ask("  密码", password=True)
    cmd = [sys.executable, "run_page/platforms/onelap_sync.py", username, password]
    run_sync_script(cmd)


def handle_oppo():
    console.print("\n[bold green]📱  OPPO (HeyTap) 同步[/bold green]")
    c_id = Prompt.ask("  Client ID")
    c_secret = Prompt.ask("  Client Secret")
    r_token = Prompt.ask("  Refresh Token")
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
    secret = Prompt.ask("  Secret String (从 get_garmin_secret.py 获取)")
    cmd = [sys.executable, "run_page/platforms/garmin_sync.py", secret]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_get_garmin_secret():
    console.print("\n[bold blue]🔑  获取佳明 Secret String[/bold blue]")
    email = Prompt.ask("  Email")
    password = Prompt.ask("  Password", password=True)
    is_cn = Prompt.ask("  是否为中国区 (CN)?", choices=["y", "n"], default="y") == "y"
    cmd = [sys.executable, "run_page/tools/get_garmin_secret.py", email, password]
    if is_cn:
        cmd.append("--is-cn")
    run_sync_script(cmd)


def handle_nike():
    console.print("\n[bold red]✔  Nike Run Club 同步[/bold red]")
    token = Prompt.ask("  Refresh Token / Access Token")
    cmd = [sys.executable, "run_page/platforms/nike_sync.py", token]
    run_sync_script(cmd)


def handle_strava():
    console.print("\n[bold orange1]🧡  Strava 同步[/bold orange1]")
    c_id = Prompt.ask("  Client ID")
    c_secret = Prompt.ask("  Client Secret")
    r_token = Prompt.ask("  Refresh Token")
    cmd = [sys.executable, "run_page/platforms/strava_sync.py", c_id, c_secret, r_token]
    run_sync_script(cmd)


def handle_coros():
    console.print("\n[bold white]⌚  Coros (高跑) 同步[/bold white]")
    account = Prompt.ask("  账号")
    password = Prompt.ask("  密码", password=True)
    cmd = [sys.executable, "run_page/platforms/coros_sync.py", account, password]
    run_sync_script(cmd)


def handle_komoot():
    console.print("\n[bold green4]🌲  Komoot 同步[/bold green4]")
    email = Prompt.ask("  Email")
    password = Prompt.ask("  Password", password=True)
    cmd = [sys.executable, "run_page/platforms/komoot_sync.py", email, password]
    run_sync_script(cmd)


def handle_local_sync(file_type):
    msg = {"gpx": "GPX", "tcx": "TCX", "fit": "FIT"}[file_type]
    console.print(f"\n[bold white]📂  导入本地 {msg} 文件到数据库[/bold white]")
    cmd = [sys.executable, f"run_page/platforms/{file_type}_sync.py"]
    run_sync_script(cmd)
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

MENU_STRUCTURE = {
    "1": {
        "label": "🔌 API 直接同步 (Direct API Sync)",
        "items": [
            {"name": "行者 (Xingzhe)", "func": handle_xingzhe},
            {"name": "Keep", "func": handle_keep},
            {"name": "悦跑圈 (Joyrun)", "func": handle_joyrun},
            {"name": "Nike Run Club (NRC)", "func": handle_nike},
            {"name": "Strava", "func": handle_strava},
            {"name": "OPPO (HeyTap)", "func": handle_oppo},
            {"name": "郁金香运动 (TulipSport)", "func": handle_tulip},
        ],
    },
    "2": {
        "label": "📂 运动文件同步 [下载并解析] (Download & File Parsing)",
        "items": [
            {"name": "Garmin (佳明)", "func": handle_garmin},
            {"name": "Coros (高跑)", "func": handle_coros},
            {"name": "iGPSPORT", "func": handle_igpsport},
            {"name": "顽鹿 (Onelap)", "func": handle_onelap},
            {"name": "Komoot", "func": handle_komoot},
        ],
    },
    "3": {
        "label": "💻 本地文件处理 (Local Files)",
        "items": [
            {
                "name": "导入本地 GPX 文件 (GPX_OUT 目录)",
                "func": lambda: handle_local_sync("gpx"),
            },
            {
                "name": "导入本地 TCX 文件 (TCX_OUT 目录)",
                "func": lambda: handle_local_sync("tcx"),
            },
            {
                "name": "导入本地 FIT 文件 (FIT_OUT 目录)",
                "func": lambda: handle_local_sync("fit"),
            },
        ],
    },
    "4": {
        "label": "🛠️ 工具与统计 (Tools & Stats)",
        "items": [
            {
                "name": "查看本地运动统计 (Local Activity Stats)",
                "func": handle_stats,
            },
            {
                "name": "获取佳明密钥 (Get Garmin Secret)",
                "func": handle_get_garmin_secret,
            },
        ],
    },
    "0": {
        "label": "🚪 退出 (Exit)",
        "items": [{"name": "退出程序 (Exit)", "func": sys.exit}],
    },
}


def main():
    while True:
        clear_screen()
        show_header()

        tree = Tree(
            "[bold white]📋 同步功能分类 (Categories by Sync Type)[/bold white]"
        )
        flat_list = []

        for cat_id, cat_data in MENU_STRUCTURE.items():
            branch = tree.add(f"[bold yellow]{cat_data['label']}[/bold yellow]")
            for item in cat_data["items"]:
                idx = len(flat_list) + 1
                branch.add(f"[{idx}] {item['name']}")
                flat_list.append(item)

        rprint(tree)

        try:
            choice = IntPrompt.ask("\n[bold cyan]请输入数字编号执行任务[/bold cyan]")
            item = flat_list[choice - 1]
            item["func"]()
            Prompt.ask("\n[dim]执行完毕，按 Enter 返回主菜单...[/dim]")
        except Exception as e:
            if isinstance(e, SystemExit):
                raise
            console.print(f"\n[red]发生错误: {e}[/red]")
            time.sleep(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]已退出。[/yellow]")
        sys.exit(0)
