import sys
import os
from rich.prompt import Prompt

def get_platform_configs(L, get_cred):
    """Returns the menu structure and platform execution logic."""
    return {
        "cat_api": [
            {
                "id": "xingzhe",
                "name": L("xingzhe_name"),
                "script": "run_page/platforms/xingzhe_sync.py",
                "args": lambda: [
                    "--account", get_cred("xingzhe_account", f"  {L('account')} (Xingzhe)"),
                    "--password", get_cred("xingzhe_password", f"  {L('password')} (Xingzhe)", True),
                    "--with-gpx"
                ]
            },
            {
                "id": "keep",
                "name": "Keep",
                "script": "run_page/platforms/keep_sync.py",
                "args": lambda: [
                    get_cred("keep_phone", f"  {L('account')} (Keep)"),
                    get_cred("keep_password", f"  {L('password')} (Keep)", True),
                    "--with-gpx"
                ]
            },
            {
                "id": "joyrun",
                "name": L("joyrun_name"),
                "script": "run_page/platforms/joyrun_sync.py",
                "handler": "joyrun"
            },
            {
                "id": "nike",
                "name": "Nike Run Club (NRC)",
                "script": "run_page/platforms/nike_sync.py",
                "args": lambda: [get_cred("nike_token", "  Refresh Token / Access Token")]
            },
            {
                "id": "strava",
                "name": "Strava",
                "script": "run_page/platforms/strava_sync.py",
                "args": lambda: [
                    get_cred("strava_client_id", "  Client ID"),
                    get_cred("strava_client_secret", "  Client Secret"),
                    get_cred("strava_refresh_token", "  Refresh Token")
                ]
            },
            {
                "id": "oppo",
                "name": "OPPO (HeyTap)",
                "script": "run_page/platforms/oppo_sync.py",
                "args": lambda: [
                    get_cred("oppo_client_id", "  Client ID"),
                    get_cred("oppo_client_secret", "  Client Secret"),
                    get_cred("oppo_refresh_token", "  Refresh Token"),
                    "--with-gpx"
                ]
            },
            {
                "id": "tulip",
                "name": L("tulip_name"),
                "script": "run_page/platforms/tulipsport_sync.py",
                "args": lambda: [get_cred("tulip_token", "  Tulip Token")]
            }
        ],
        "cat_file_sync": [
            {
                "id": "garmin",
                "name": L("garmin_name"),
                "script": "run_page/platforms/garmin_sync.py",
                "handler": "garmin"
            },
            {
                "id": "coros",
                "name": L("coros_name"),
                "script": "run_page/platforms/coros_sync.py",
                "args": lambda: [
                    get_cred("coros_account", "  账号"),
                    get_cred("coros_password", "  密码", True)
                ]
            },
            {
                "id": "igpsport",
                "name": "iGPSPORT",
                "script": "run_page/platforms/igpsport_sync.py",
                "args": lambda: [
                    get_cred("igpsport_username", "  用户名"),
                    get_cred("igpsport_password", "  密码", True),
                    "--with-gpx", "--with-fit"
                ]
            },
            {
                "id": "onelap",
                "name": L("onelap_name"),
                "script": "run_page/platforms/onelap_sync.py",
                "args": lambda: [
                    get_cred("onelap_username", "  用户名"),
                    get_cred("onelap_password", "  密码", True)
                ]
            },
            {
                "id": "komoot",
                "name": "Komoot",
                "script": "run_page/platforms/komoot_sync.py",
                "args": lambda: [
                    get_cred("komoot_email", "  Email"),
                    get_cred("komoot_password", "  密码", True)
                ]
            }
        ],
        "cat_mirror": [
            {
                "id": "nike_to_strava",
                "name": "Nike -> Strava",
                "script": "run_page/platforms/nike_to_strava_sync.py",
                "args": lambda: [
                    get_cred("nike_token", "  Nike Refresh Token"),
                    get_cred("strava_client_id", "  Strava Client ID"),
                    get_cred("strava_client_secret", "  Strava Client Secret"),
                    get_cred("strava_refresh_token", "  Strava Refresh Token"),
                    "--continue-sync"
                ]
            },
            {
                "id": "keep_to_strava",
                "name": "Keep -> Strava",
                "script": "run_page/platforms/keep_to_strava_sync.py",
                "args": lambda: [
                    get_cred("keep_phone", "  Keep 手机号"),
                    get_cred("keep_password", "  Keep 密码", True),
                    get_cred("strava_client_id", "  Strava Client ID"),
                    get_cred("strava_client_secret", "  Strava Client Secret"),
                    get_cred("strava_refresh_token", "  Strava Refresh Token")
                ]
            },
            {
                "id": "strava_to_garmin",
                "name": "Strava -> Garmin",
                "handler": "strava_to_garmin"
            },
            {
                "id": "garmin_to_strava",
                "name": "Garmin -> Strava",
                "handler": "garmin_to_strava"
            },
            {
                "id": "gpx_to_strava",
                "name": "GPX -> Strava",
                "script": "run_page/platforms/gpx_to_strava_sync.py",
                "args": lambda: [
                    get_cred("strava_client_id", "  Strava Client ID"),
                    get_cred("strava_client_secret", "  Strava Client Secret"),
                    get_cred("strava_refresh_token", "  Strava Refresh Token")
                ]
            },
            {
                "id": "tcx_to_strava",
                "name": "TCX -> Strava",
                "script": "run_page/platforms/tcx_to_strava_sync.py",
                "args": lambda: [
                    get_cred("strava_client_id", "  Strava Client ID"),
                    get_cred("strava_client_secret", "  Strava Client Secret"),
                    get_cred("strava_refresh_token", "  Strava Refresh Token")
                ]
            },
            {
                "id": "tcx_to_garmin",
                "name": "TCX -> Garmin",
                "handler": "tcx_to_garmin"
            }
        ],
        "cat_local": [
            {"id": "import_gpx", "name": f"{L('import_local')} GPX", "script": "run_page/platforms/gpx_sync.py"},
            {"id": "import_tcx", "name": f"{L('import_local')} TCX", "script": "run_page/platforms/tcx_sync.py"},
            {"id": "import_fit", "name": f"{L('import_local')} FIT", "script": "run_page/platforms/fit_sync.py"}
        ],
        "cat_tools": [
            {"id": "stats", "name": L("view_stats"), "handler": "stats"},
            {"id": "garmin_secret", "name": L("get_garmin_secret"), "handler": "garmin_secret"},
            {"id": "reset_creds", "name": L("reset_creds"), "handler": "reset_creds"},
            {"id": "toggle_lang", "name": L("lang_name"), "handler": "toggle_lang"}
        ]
    }
