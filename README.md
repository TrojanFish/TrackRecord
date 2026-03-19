# 🚀 TrackRecord - Next Gen Sports Data Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Deployment-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

**TrackRecord** is a high-performance personal sports data middleware and visualization platform. It helps endurance athletes (cycling, running) sync activities from Strava/Garmin, manage gear maintenance, and explore deep insights through a stunning web dashboard and annual rewind reports.

---

## ✨ Key Features

- **Dynamic Web Dashboard**: A modern, interactive UI built with React & Vite, providing real-time stats and training load monitoring.
- **Annual Rewind**: Beautifully generated year-in-review reports with carbon offset calculations and activity location insights.
- **Physiological Monitoring**: Real-time tracking of **TSB (Training Stress Balance)**, **CTL**, and **ATL** based on heart rate data.
- **Gear Lifecycle Management**: Track wear and tear of bike components with automatic maintenance alerts.
- **Multi-Platform Sync**: Native support for mirroring activities between Strava, Garmin, Nike, Keep, and more.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Docker** & **Docker Compose**
- **Git**

### 2. Configuration
Copy `config-example.yaml` to `run_page/settings.yaml` and edit your metrics:
```yaml
athlete:
  name: "Athlete Name"
  weight: 70
  max_hr: 190
  gears:
    - name: "Tarmac SL8"
      type: "Ride"
      limit: 3000 # km until maintenance
```

### 3. Deploy
```bash
git clone https://github.com/YourUsername/TrackRecord.git
cd TrackRecord
docker-compose up -d --build
```
Access the dashboard at `http://localhost:5173`.

---

## 🛠️ Modules & Usage

### 📊 Training Load API
Provides deep analytics via `/api/v1/stats`.
```json
// Example Output
{
  "ctl": 45.2,
  "atl": 38.5,
  "tsb": 6.7,
  "advice": "Productive Fatigue - Keep Pushing"
}
```

### 🏃 Sync Menu
Interactive CLI for manual data synchronization:
```bash
python running_page_menu.py
```

---

## 💻 Tech Stack & Implementation

- **Core**: FastAPI (Python 3.10+)
- **UI**: React 18 / Vite / Framer Motion / Tailwind CSS
- **Data Persistence**: SQLite 3 with SQLAlchemy
- **Containerization**: Multi-stage Docker build

### 🔗 Attributions & References
This project stands on the shoulders of giants:

*   **Activity Sync & Export Logic**: Core data export functions (GPX/TCX/FIT, excluding Xingzhe) are derived from the excellent [running_page](https://github.com/yihong0618/running_page) by **yihong0618**.
*   **Design & Dashboard Aesthetics**: Visualization ideas and data modeling concepts inspired by [statistics-for-strava](https://github.com/robiningelbrecht/statistics-for-strava) by **robiningelbrecht**.

---

## 🤝 Contribution

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the **MIT License**. See [LICENSE](./LICENSE) for more information. 

*Special Note: Please respect the original licenses of the referenced projects above when modifying core sync components.*
