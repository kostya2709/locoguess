# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocoGuess is a multiplayer GeoGuessr-like game where teams compete to identify locations from photos by placing markers on a map. Scores are calculated using Haversine distance with exponential decay.

## Architecture

- **Backend** (`backend/`): Python 3.11+ / FastAPI / SQLAlchemy / SQLite
- **Frontend** (`frontend/`): React 19 + TypeScript / Vite / Leaflet + OpenStreetMap
- **Real-time**: WebSocket for server→client broadcasts (timer, round events); all mutations go through REST
- **Game state machine**: `LOBBY → PLAYING (rounds: GUESSING → REVEALING → COMPLETE) → FINISHED`

### Backend Structure
- `app/models/` — SQLAlchemy models: Game, Round, Team, Player, Guess
- `app/routers/` — REST endpoints: games, teams, rounds (under `/api/v1/`)
- `app/services/game_service.py` — Central state machine orchestrator (start game, round transitions, timer)
- `app/services/scoring.py` — Haversine distance + score calculation (pure functions)
- `app/ws/manager.py` — WebSocket ConnectionManager with per-game rooms
- `app/ws/handler.py` — WebSocket endpoint at `/ws/{join_code}`

### Frontend Structure
- `src/hooks/useGameState.ts` — Client state reducer driven by WS messages (single source of truth)
- `src/hooks/useWebSocket.ts` — WS connection with auto-reconnect
- `src/api/client.ts` — REST API client
- `src/components/Game/GuessMap.tsx` — Leaflet interactive map (click-to-place marker + reveal overlay)
- `src/pages/` — Route pages: Home, Lobby, Game, Results

### Key Design Decisions
- REST for actions (validation, error codes), WS for broadcast-only push notifications
- Session-based identity: UUID `session_id` assigned on team join, no auth
- Team captain submits guesses; one guess per team per round (DB unique constraint)
- Photos pre-loaded via seed script or admin endpoint; served as static files

## Commands

### Backend
```bash
cd backend
.venv/bin/python -m pytest                     # Run all tests
.venv/bin/python -m pytest tests/test_api.py   # Run specific test file
.venv/bin/python -m pytest -k "test_haversine" # Run tests matching pattern
.venv/bin/uvicorn app.main:app --reload        # Start dev server (port 8000)
.venv/bin/python seed.py                       # Seed demo game data
.venv/bin/ruff check app/ tests/               # Lint
```

### Frontend
```bash
cd frontend
npm run dev          # Start dev server (port 5173, proxies to backend)
npm test             # Run all tests (vitest)
npm run build        # Type-check + production build
```

### First-time setup
```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cd ../frontend && npm install
```

### Docker
```bash
docker compose up --build        # Build and start both services
docker compose up -d             # Detached mode
docker compose exec backend python seed.py  # Seed demo data in container
```
- Frontend (nginx) serves on port 80, proxies `/api`, `/photos`, `/ws` to the backend container
- Backend env vars configurable via `LOCOGUESS_` prefix in docker-compose.yml
- Volumes: `db-data` for SQLite persistence, `photos` for photo storage

## Database

SQLite at `backend/locoguess.db`. Tables auto-created on first backend startup via `Base.metadata.create_all()`. No Alembic migrations yet — for schema changes, delete the DB and restart.

## Scoring Formula

`score = 5000 * e^(-distance_km / 2000)` — 0km=5000pts, 500km≈3894pts, 2000km≈1839pts
