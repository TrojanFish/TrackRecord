# -*- coding: utf-8 -*-
import sys

def get_platform_configs(L, get_cred):
    """
    Returns the organized platform configurations for the CLI menu.
    Each item contains metadata for display and execution.
    """
    return {
        "cat_api": [
            {"id": "strava", "name": "Strava", "handler": "strava"},
            {"id": "garmin", "name": L("garmin_name") + " (Global)", "handler": "garmin"},
            {"id": "garmin_cn", "name": L("garmin_name") + " (CN)", "handler": "garmin_cn"},
            {"id": "nike", "name": "Nike Run Club", "handler": "nike"},
            {"id": "nike_new", "name": "Nike Run Club New", "handler": "nike"},
            {"id": "keep", "name": "Keep", "script": "run_page/platforms/keep_sync.py", "args": lambda: [get_cred("keep_phone", "  Keep Phone"), get_cred("keep_password", "  Keep Password", password=True)]},
        ],
        "cat_file_sync": [
            {"id": "xingzhe", "name": L("xingzhe_name"), "script": "run_page/platforms/xingzhe_sync.py", "args": lambda: ["--account", get_cred("xingzhe_phone", "  Phone"), "--password", get_cred("xingzhe_password", "  Password", password=True)]},
            {"id": "joyrun", "name": L("joyrun_name"), "handler": "joyrun"},
            {"id": "coros", "name": L("coros_name"), "script": "run_page/platforms/coros_sync.py", "args": lambda: [get_cred("coros_phone", "  Phone"), get_cred("coros_password", "  Password", password=True)]},
            {"id": "onelap", "name": L("onelap_name"), "script": "run_page/platforms/onelap_sync.py", "args": lambda: [get_cred("onelap_phone", "  Phone"), get_cred("onelap_password", "  Password", password=True)]},
            {"id": "igpsport", "name": "iGPSPORT", "script": "run_page/platforms/igpsport_sync.py", "args": lambda: [get_cred("igpsport_phone", "  Phone"), get_cred("igpsport_password", "  Password", password=True)]},
            {"id": "komoot", "name": "Komoot", "script": "run_page/platforms/komoot_sync.py", "args": lambda: [get_cred("komoot_email", "  Email"), get_cred("komoot_password", "  Password", password=True)]},
        ],
        "cat_mirror": [
            {"id": "garmin_cn_global", "name": "Garmin-CN -> Garmin (Global)", "handler": "garmin_cn_global"},
            {"id": "garmin_global_cn", "name": "Garmin (Global) -> Garmin-CN", "handler": "garmin_global_cn"},
            {"id": "nike_to_strava", "name": "Nike -> Strava", "handler": "nike_to_strava"},
            {"id": "garmin_to_strava", "name": "Garmin -> Strava", "handler": "garmin_to_strava"},
            {"id": "strava_to_garmin", "name": "Strava -> Garmin", "handler": "strava_to_garmin"},
            {"id": "tcx_to_strava", "name": "TCX -> Strava", "handler": "tcx_to_strava"},
            {"id": "gpx_to_strava", "name": "GPX -> Strava", "handler": "gpx_to_strava"},
            {"id": "tcx_to_garmin", "name": "TCX -> Garmin", "handler": "tcx_to_garmin"},
        ],
        "cat_tools": [
            {"id": "stats", "name": L("view_stats"), "handler": "stats"},
            {"id": "garmin_secret", "name": L("get_garmin_secret"), "handler": "garmin_secret"},
            {"id": "toggle_lang", "name": L("lang_name"), "handler": "toggle_lang"},
            {"id": "reset_creds", "name": L("reset_creds"), "handler": "reset_creds"},
        ]
    }
