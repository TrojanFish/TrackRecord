# TrackRecord - Personal Sports Data Sync & Export Toolkit

> [!NOTE]
> This project is a branched and enhanced version of [yihong0618/running_page](https://github.com/yihong0618/running_page), focused on data synchronization and export capabilities. It has been streamlined into a pure terminal-based tool.

<p align="center">
  <img width="150" src="https://raw.githubusercontent.com/shaonianche/gallery/master/running_page/running_page_logo.png" />
</p>

## 🍱✨ Key Features

TrackRecord provides a robust set of tools to sync and export your sports data from various platforms:

*   **Interactive Sync Menu**: No more wrestling with complicated CLI arguments! Simply run `python running_page_menu.py` to access a visual menu for one-click synchronization.
*   **Credential Management**: Automatically saves your tokens and passwords locally for one-click future syncs.
*   **A -> B Account Mirroring**: Directly sync activities between accounts (e.g., Nike to Strava, Keep to Strava, Strava to Garmin, etc.).
*   **Modernized Sync Scripts**: Supports Xingzhe (Auto-Login), Keep, Joyrun, Nike, Garmin (Global/CN), Strava, Coros, and more.
*   **Local Data Hub**: All data is stored in a local SQLite database with detailed terminal-based statistics.
*   **Universal Export**: Automatically generates GPX/TCX/FIT files during synchronization.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Enter the Hub (Recommended)

Experience the easiest way to sync your activities. Run the interactive menu from the project root:

```bash
python running_page_menu.py
```

Follow the prompts. The tool will guide you through connecting your platforms and mirroring data between services.

## 📁 Project Structure

The project has been reorganized for better maintainability:

- `run_page/`: Core logic and data.
    - `platforms/`: Individual sync scripts for various platforms.
    - `tools/`: Maintenance utilities (Garmin secret tools, DB updaters, etc.).
    - `data.db`: SQLite database containing all your activities.
- `GPX_OUT/`, `TCX_OUT/`, `FIT_OUT/`: Directories for exported sports files.
- `activities/`: Stored raw activity contents.

## 🙏 Special Thanks

This project would not be possible without the incredible work of **[yihong0618](https://github.com/yihong0618)** and the original **[running_page](https://github.com/yihong0618/running_page)** repository.

---

## 📜 License

Follows the original project's license. Please continue to respect and maintain the copyright notice for the original author [yihong0618](https://github.com/yihong0618).

---

> "Journey is at your feet. Starting is always more meaningful than just dreaming."
