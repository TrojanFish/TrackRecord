"""
Python 3 API wrapper for Garmin Connect to get your statistics.
Mirror Garmin Global (COM) activities to Garmin CN.
"""

import argparse
import asyncio
import os
import sys

from run_page.config import FIT_FOLDER, GPX_FOLDER, JSON_FILE, SQL_FILE
from run_page.platforms.garmin_sync import Garmin, get_downloaded_ids
from run_page.platforms.garmin_sync import download_new_activities
from run_page.utils import make_activities_file

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "global_secret_string", nargs="?", help="secret_string from get_garmin_secret.py"
    )
    parser.add_argument(
        "cn_secret_string", nargs="?", help="secret_string from get_garmin_secret.py"
    )
    parser.add_argument(
        "--only-run",
        dest="only_run",
        action="store_true",
        help="if is only for running",
    )

    options = parser.parse_args()
    secret_string_global = options.global_secret_string
    secret_string_cn = options.cn_secret_string
    is_only_running = options.only_run
    
    if secret_string_global is None or secret_string_cn is None:
        print("Missing argument global_secret_string or cn_secret_string")
        sys.exit(1)

    # Step 1: Download from Global
    downloaded_fit = get_downloaded_ids(FIT_FOLDER)
    downloaded_gpx = get_downloaded_ids(GPX_FOLDER)
    downloaded_activity = list(set(downloaded_fit + downloaded_gpx))

    folder = FIT_FOLDER
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)

    loop = asyncio.get_event_loop()
    future = asyncio.ensure_future(
        download_new_activities(
            secret_string_global,
            "COM",
            downloaded_activity,
            is_only_running,
            folder,
            "fit",
        )
    )
    loop.run_until_complete(future)
    new_ids, id2title = future.result()

    to_upload_files = []
    for i in new_ids:
        if os.path.exists(os.path.join(FIT_FOLDER, f"{i}.fit")):
            to_upload_files.append(os.path.join(FIT_FOLDER, f"{i}.fit"))
        elif os.path.exists(os.path.join(GPX_FOLDER, f"{i}.gpx")):
            to_upload_files.append(os.path.join(GPX_FOLDER, f"{i}.gpx"))

    if not to_upload_files:
        print("No new activities to upload.")
    else:
        print(f"Files to sync to CN: {len(to_upload_files)}")
        garmin_cn_client = Garmin(
            secret_string_cn,
            "CN",
            is_only_running,
        )
        loop = asyncio.get_event_loop()
        future = asyncio.ensure_future(
            garmin_cn_client.upload_activities_files(to_upload_files)
        )
        loop.run_until_complete(future)

    # Step 2: Update local DB
    make_activities_file(
        SQL_FILE, GPX_FOLDER, JSON_FILE, file_suffix="gpx", activity_title_dict=id2title
    )
    make_activities_file(
        SQL_FILE, FIT_FOLDER, JSON_FILE, file_suffix="fit", activity_title_dict=id2title
    )
