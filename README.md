# TrackRecord - Personal Sports Data Sync & Export Toolkit

> [!NOTE]
> This project is a branched and enhanced version of [yihong0618/running_page](https://github.com/yihong0618/running_page), focused on data synchronization and export capabilities.

<p align="center">
  <img width="150" src="https://raw.githubusercontent.com/shaonianche/gallery/master/running_page/running_page_logo.png" />
</p>

## 🍱✨ Key Features

TrackRecord provides a robust set of tools to sync and export your sports data from various platforms:

*   **Interactive Sync Menu**: No more wrestling with complicated CLI arguments! Simply run `python running_page_menu.py` to access a visual menu for one-click synchronization across multiple platforms (Xingzhe, Keep, Joyrun, etc.).
*   **Modernized Xingzhe (行者) Sync**:
    *   **Auto-Login**: Supports the latest RSA encrypted automated login. No more manual session sniffing required!
    *   **GPX Export**: Automatically exports trace data as GPX files to the `GPX_OUT` directory during synchronization.
    *   **Reliable User Extraction**: Intelligent handling of recent Xingzhe API changes to ensure accurate user data retrieval.
*   **Multi-Platform Support**: Sync from Nike, Garmin, Strava, Keep, Coros, and more.
*   **Data Export**: Generate GPX, TCX, and FIT files. Save data to SQLite database for further analysis.

## 🙏 Special Thanks

This project would not be possible without the incredible work of **[yihong0618](https://github.com/yihong0618)** and the original **[running_page](https://github.com/yihong0618/running_page)** repository.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Sync Your Data (Recommended)

Experience the easiest way to sync your activities. Run the interactive menu from the project root:

```bash
python running_page_menu.py
```

Follow the prompts. Whether it's auto-login with account/password or advanced session mode, the menu will guide you through the process.

### 3. Manual Sync (CLI Mode)

If you prefer using the CLI, scripts are available in the `run_page/` directory. For example, for Xingzhe:

```bash
# Auto-Login Mode
python run_page/xingzhe_sync.py --account "YOUR_ACCOUNT" --password "YOUR_PASSWORD" --with-gpx

# Manual Session Mode (Fallback)
python run_page/xingzhe_sync.py --session "sessionidValue" --user-id 12345 --with-gpx
```

---

## 🛠️ Data Output

Synced data and exported files can be found in the following directories:
- `activities/`: Raw activity data.
- `GPX_OUT/`: Exported GPX files.
- `TCX_OUT/`: Exported TCX files.
- `FIT_OUT/`: Exported FIT files.
- `run_page/data.db`: SQLite database containing all synchronized data.

---

## 📜 License

Follows the original project's license. Please continue to respect and maintain the copyright notice for the original author [yihong0618](https://github.com/yihong0618).

---

> "Journey is at your feet. Starting is always more meaningful than just dreaming."
