# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TrackRecord** is a personal sports data sync and dashboard toolkit. It pulls activity data from 26+ fitness platforms (Strava, Garmin, Keep, Nike, etc.), stores them in a local SQLite database, and serves them through a FastAPI backend + React dashboard.

## Commands

### Backend (Python)
```bash
pip install -r requirements.txt

# Interactive terminal menu for syncing platforms
python running_page_menu.py

# Start both API server (port 8000) and frontend dev server (port 3000)
python run_web.py

# API server only
python -m run_page.web_api
```

### Frontend (React + Vite)
```bash
cd dashboard
npm install
npm run dev       # Dev server on port 3000
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Docker
```bash
docker-compose up   # Available at http://localhost:8081
```

## Architecture

### Entry Points
- `running_page_menu.py` — Interactive terminal UI for platform sync and credential management
- `run_web.py` — Launches FastAPI + Vite dev server concurrently
- `run_page/web_api.py` — FastAPI app with lifespan manager (DB init + background sync worker)

### Backend Structure
```
run_page/
├── web_api.py        # FastAPI app, CORS, static file serving, SPA catch-all
├── config.py         # All constants (ports, paths, timezone)
├── db.py             # SQLAlchemy models (Activity, Photo, Trophy, Segment, SegmentEffort) + DB helpers
├── auth.py           # 3-tier credential lookup: env vars → credentials.json → interactive prompt
├── utils.py          # Shared utilities (geocoding, polyline, date parsing)
├── routers/          # FastAPI route handlers (/api/v1/stats, sync, challenges, photos, segments)
├── services/         # Business logic (sync_service, strava_service, athlete_service, challenge_service)
├── platforms/        # 26 sync scripts, one per platform (strava_sync.py, garmin_sync.py, etc.)
├── ui/               # Terminal UI (handlers.py = handler registry, i18n.py = bilingual strings)
└── settings.yaml     # Athlete config: heart rate zones, calorie factors, training load, milestones
```

### Data Flow

**Sync:** User selects platform in menu → optional custom handler (Garmin secret, Joyrun SMS) → credential lookup → platform sync script → `update_or_create_activity()` → SQLite DB → GPX/TCX/FIT export files

**Web API:** React component → `GET /api/v1/stats` → FastAPI router → SQLAlchemy query on SQLite → JSON response

**Background sync:** `auto_sync_worker()` runs daily (if `SYNC_ON_STARTUP` env var set) via `perform_sync_logic()` in `sync_service.py`

### Database
Single SQLite file at `run_page/data.db`. Key models:
- `Activity` — Core model with all movement data; `ext_data` JSON field for flexible extras
- `Photo`, `Trophy`, `Segment`, `SegmentEffort` — Supporting tables

### Auth System (`run_page/auth.py`)
Three-tier lookup for every credential:
1. Environment variable (e.g., `STRAVA_CLIENT_ID`)
2. `run_page/credentials.json` (auto-created, git-ignored)
3. Interactive prompt (saves to credentials.json for future use)

### Frontend Structure
```
dashboard/src/
├── App.jsx           # Root: state (activeTab, sportType), useStats hook, keyboard shortcut ('k' toggles sidebar)
├── hooks/useStats.js # API calls + caching for all stats data
├── components/       # Sidebar (navigation), Header (title + sport filter)
└── pages/            # 12 pages: Dashboard, Activities, Analytics, Eddington, Heatmap, Records,
                      #           Gear, MonthlyStats, Challenges, Photos, Rewind, Segments
```

Key frontend libs: React 19, Vite 8, Recharts (charts), Leaflet (maps), Framer Motion (animations), Lucide React (icons).

### Platform Sync Scripts (`run_page/platforms/`)
Each script is standalone and handles one platform. Mirror/transfer scripts follow the naming pattern `{source}_to_{dest}_sync.py` (e.g., `nike_to_strava_sync.py`). They receive credentials as CLI args or environment variables via the auth system.

## Configuration

| Setting | Location | Default |
|---------|----------|---------|
| API port | `config.py` / env `API_PORT` | 8000 |
| Frontend port | `config.py` / env `FRONTEND_PORT` | 3000 |
| SQLite path | env `DB_PATH` | `run_page/data.db` |
| Timezone | `config.py` | `Asia/Shanghai` |
| Athlete metrics | `run_page/settings.yaml` | Fallback defaults |
| Strava OAuth | `.env` or credentials.json | — |

Copy `.env.example` to `.env` for Strava credentials. Copy `config-example.yaml` to `run_page/settings.yaml` for athlete metrics (heart rate zones, VO2 max, calorie factors, milestones).

## Key Conventions

- **Handler registry** (`run_page/ui/handlers.py`): custom pre-sync logic per platform; returns `False` to abort sync, `True` to proceed, or a tuple `(True, kwargs)` to pass extra args to the sync script.
- **Geocoding**: Uses Nominatim with ~1.1km precision and in-memory cache to minimize API calls.
- **Strava OAuth**: Token auto-refreshed on each API call via `strava_service.py`.
- **Bilingual UI**: All terminal strings defined in `run_page/ui/i18n.py`; language stored in credentials.json (`"language": "en"` or `"zh-CN"`).
- No automated test framework exists; `debug_*.py` scripts in root are one-off debugging utilities.
