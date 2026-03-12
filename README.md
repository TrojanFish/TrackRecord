# TrackRecord - Build Your Personal Sports Journey Home Page

> [!NOTE]
> This project is a branched and enhanced version of [yihong0618/running_page](https://github.com/yihong0618/running_page).

<p align="center">
  <img width="150" src="https://raw.githubusercontent.com/shaonianche/gallery/master/running_page/running_page_logo.png" />
</p>

# [Personalized Sports Data Showcase](https://github.com/TrojanFish/TrackRecord)

English | [简体中文](README-CN.md) | [Wiki](https://mfydev.github.io/Running-Page-Wiki/)

## 🍱✨ New Features (TrackRecord Enhancements)

Building upon the robust foundation of the original project, we have introduced several key improvements:

*   **Interactive Sync Menu**: No more wrestling with complicated CLI arguments! Simply run `python running_page_menu.py` to access a visual menu for one-click synchronization across multiple platforms (Xingzhe, Keep, Joyrun, etc.).
*   **Modernized Xingzhe (行者) Sync**:
    *   **Auto-Login**: Supports the latest RSA encrypted automated login. No more manual session sniffing required!
    *   **GPX Export**: Automatically exports trace data as GPX files to the `GPX_OUT` directory during synchronization.
    *   **Reliable User Extraction**: Intelligent handling of recent Xingzhe API changes to ensure accurate user data retrieval.
*   **Enhanced UI & UX**:
    *   Optimized visual styles based on the TrackRecord design language.
    *   Smoother visualization for various activity types including Cycling, Running, and Hiking.
    *   Cleaned up and maintained sync modules for maximum stability.

## 🙏 Special Thanks

This project would not be possible without the incredible work of **[yihong0618](https://github.com/yihong0618)** and the original **[running_page](https://github.com/yihong0618/running_page)** repository.

We extend our deepest gratitude to the original author for providing such an elegant, powerful, and extensible solution for the sports community. TrackRecord aims to build upon this legacy by streamlining the user experience and maintaining robust sync capabilities for specific platforms.

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

### 3. Local Development & Preview

```bash
npm install
npm run dev
```

---

## 🛠️ Technical Details & Configuration

> [!IMPORTANT]
> **Mapbox Token Security**
>
> By default, this project uses **MapCN (Free / No Token Required)**.
> If you prefer to use Mapbox, ensure you configure your **own [Mapbox Token](https://www.mapbox.com/)** in `src/utils/const.ts`.
> **DO NOT** commit your private tokens to public repositories.

### Manual Sync (CLI Mode)

If you prefer using the CLI, the new Xingzhe sync script supports:

```bash
# Auto-Login Mode
python run_page/xingzhe_sync.py --account "YOUR_ACCOUNT" --password "YOUR_PASSWORD" --with-gpx

# Manual Session Mode (Fallback)
python run_page/xingzhe_sync.py --session "sessionidValue" --user-id 12345 --with-gpx
```

---

## 🏗️ Deployment

### Deploy with Vercel

1. Fork this repository.
2. Create a new project in Vercel. Choose **Vite** as the framework (Note: If you are upgrading from an older fork using Gatsby, make sure to switch the setting to Vite).
3. Set up your GitHub Actions for automatic daily synchronization.

---

## 📜 License

Follows the original project's license. Please continue to respect and maintain the copyright notice for the original author [yihong0618](https://github.com/yihong0618).

---

> "Journey is at your feet. Starting is always more meaningful than just dreaming."
