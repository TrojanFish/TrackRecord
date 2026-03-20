# TrackRecord — Personal Sports Data Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Deployment-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Maps-Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
</p>

**TrackRecord** is a personal sports data sync and dashboard toolkit for endurance athletes. It pulls activity data from Strava, Garmin, and 24+ other platforms, stores everything in a local SQLite database, and presents it through a full-featured React dashboard with Run / Ride mode switching and responsive mobile/desktop layouts.

---

## Features

### Dashboard Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Hero stats (CTL/TSB with tooltips, streak NOW vs BEST), Smart Coach advice, Training Load chart, Athlete profile radar, Annual activity heatmap, Deep Analysis panel |
| **Activities** | Full activity log with collapsible filters, sortable table, Run/Ride–aware detail panel (SPM/RPM cadence, power, GAP pace), mobile-optimised column hiding |
| **Analytics** | Year-over-year distance chart, weekday preference, prime-time distribution, distance/HR zone breakdown, monthly progression table |
| **Eddington** | E-number chart with stepped frontier, next-level gap counter, estimated completion date projection |
| **Heatmap** | Leaflet route map with hover tooltip (name/distance/pace), Type vs Pace/Speed colour mode, collapsible city sidebar, year/type filters |
| **Records** | Personal bests medal wall, Riegel's formula race predictor (Run: 5K→Marathon, Ride: 40K→200K) with base-record indicator, dynamic VO₂max bar, performance scatter trend |
| **Gear** | Equipment stats table, animated maintenance lifecycle bars with remaining km, monthly mileage chart per item, recording device stats |
| **Monthly Stats** | Month navigator with activity count badge, heatmap + daily bar chart + sport-type pie |
| **Challenges** | Strava Trophy Case import (inline success/error feedback), trophy grid by month, clubs & organisations section |
| **Photos** | Responsive masonry gallery (3 → 2 → 1 columns desktop/tablet/mobile), auto-synced from Strava |
| **Rewind** | Year-in-review — longest route map, streak BEST/NOW, distance + elevation charts, responsive photo grid |
| **Segments** | KOM/QOM tracker with click-to-sort (Best Time, Distance, Grade, Efforts), effort history modal, HR vs time scatter |

### Sport Modes

- **Run mode** — red theme (`#ff3366`), pace in /km, SPM cadence, 5K/10K/Half/Marathon race predictor, 175 spm coaching tip
- **Ride mode** — cyan theme (`#06b6d4`), speed in km/h, RPM cadence, watts power, 40K/100K/160K/200K race predictor, climbing efficiency
- **All mode** — neutral theme, combined stats with Run/Ride breakdown

### Backend

- **Strava API** — OAuth token auto-rotation, per_page=200, rate-limit retry with back-off, unified cached client (no duplicate refreshes)
- **Thread-safe geocoding** — in-memory cache with `threading.Lock`, ~1.1 km precision via Nominatim
- **Batch SQL queries** — N+1 photo/segment queries eliminated
- **FastAPI** — CORS restricted to specific methods/headers, path traversal protection on static file serving
- **Background sync** — daily midnight auto-sync (configurable timezone), photo sync (90-day window), segment backfill

---

## Quick Start

### Option A — Docker (Recommended)

```bash
git clone https://github.com/YourUsername/TrackRecord.git
cd TrackRecord
cp config-example.yaml run_page/settings.yaml   # edit athlete metrics
docker-compose up -d --build
```

Dashboard available at `http://localhost:8081`.

### Option B — Local Dev

```bash
pip install -r requirements.txt

# Configure credentials (interactive on first run)
python running_page_menu.py

# Start API server + frontend dev server
python run_web.py
# API → http://localhost:8000
# UI  → http://localhost:3000
```

### Strava OAuth Setup

Copy `.env.example` to `.env` and fill in your Strava app credentials:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REFRESH_TOKEN=your_refresh_token
```

Or let the interactive menu prompt you on first run — credentials are saved to `run_page/credentials.json` automatically.

---

## Configuration

### `run_page/settings.yaml`

```yaml
athlete:
  name: "Your Name"
  weight: 70          # kg — used for calorie estimates
  max_hr: 190         # bpm — used for HR zone calculation
  vo2_estimate: 58.0  # optional override

gears:
  - name: "Tarmac SL8"
    type: "Ride"
    limit: 8000        # km before replacement alert
  - name: "Adidas Adizero"
    type: "Run"
    limit: 800

heart_rate_zones:
  z1: [0, 130]
  z2: [130, 152]
  z3: [152, 162]
  z4: [162, 174]
  z5: [174, 999]

riegel_exponents:
  run: 1.06
  ride: 1.05
```

| Setting | Location | Default |
|---------|----------|---------|
| API port | `config.py` / `API_PORT` env | 8000 |
| Frontend port | `config.py` / `FRONTEND_PORT` env | 3000 |
| SQLite path | `DB_PATH` env | `run_page/data.db` |
| Timezone | `config.py` | `Asia/Shanghai` |
| Startup sync | `SYNC_ON_STARTUP` env | `true` |

---

## Architecture

```
run_page/
├── web_api.py          # FastAPI app, CORS, SPA catch-all, lifespan
├── config.py           # Ports, paths, timezone constants
├── db.py               # SQLAlchemy models + thread-safe geocoding cache
├── auth.py             # 3-tier credential lookup: env → credentials.json → prompt
├── generator.py        # Strava sync orchestrator with rate-limit retry
├── routers/            # /api/v1/* route handlers
│   ├── stats.py        # Main stats endpoint (CTL/ATL/TSB, records, heatmap…)
│   ├── sync.py         # Manual sync trigger + status
│   ├── segments.py     # KOM/QOM segment data
│   ├── photos.py       # Photo list + background sync
│   └── challenges.py   # Trophy import + monthly display
├── services/
│   ├── strava_service.py   # Unified Strava client with TTL token cache
│   ├── cache_service.py    # In-memory TTL cache for stats responses
│   └── sync_service.py     # Background sync worker + auto-midnight scheduler
└── platforms/          # 26 platform sync scripts (strava, garmin, keep…)

dashboard/src/
├── App.jsx             # Root: sport mode state, keyboard shortcut ('k')
├── hooks/useStats.js   # API fetch + client-side caching
├── pages/              # 12 page components (see feature table above)
└── components/         # Sidebar, Header, sport filter
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI, Python 3.10+, SQLAlchemy, SQLite |
| Frontend | React 19, Vite 8, Framer Motion, Recharts, Leaflet |
| Sync | stravalib, requests, background asyncio task |
| Deploy | Docker Compose, multi-stage build |

---

## Platform Support

Strava · Garmin · Nike Run Club · Keep · Coros · Suunto · Polar · Concept2 · Xingzhe (行者) · Yupoo · Joyrun (悦跑圈) · and more via the interactive sync menu.

---

## Attributions

- **Activity sync & export logic** (GPX/TCX/FIT, excl. Xingzhe): derived from [running_page](https://github.com/yihong0618/running_page) by **yihong0618**
- **Dashboard design inspiration**: [statistics-for-strava](https://github.com/robiningelbrecht/statistics-for-strava) by **robiningelbrecht**

---

## License

MIT License — see [LICENSE](./LICENSE).

*When modifying core sync components, please respect the original licences of the referenced projects.*
