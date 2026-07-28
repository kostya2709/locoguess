# LocoGuess

A multiplayer GeoGuessr-like game. Teams look at a photo, drop a marker on the
map, and score points based on how close they got. Built for playing in a room
together — one shared screen for the photo, phones for the guesses.

Scoring is `5000 * e^(-distance_km / 2000)`, so 0 km is 5000 points, 500 km is
about 3894, and 2000 km is about 1839.

## Quick start (Docker)

```bash
git clone https://github.com/kostya2709/locoguess.git
cd locoguess
docker compose up --build
```

Open <http://localhost>. Two demo packs are seeded automatically on first
start — no extra setup, no API keys, no `.env` needed.

To let other devices on the same WiFi join, point them at your machine's LAN IP
(e.g. `http://192.168.1.42/`).

## Configuration

Everything is optional. Copy `.env.example` to `.env` next to
`docker-compose.yml` and set what you need:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOCOGUESS_ADMIN_PASSWORD` | unset | Gates the "Начать игру" and "Наборы" buttons. Unset = no gate. |
| `VITE_MAP_PROVIDER` | `leaflet` | `leaflet` (free OpenStreetMap) or `google`. |
| `VITE_GOOGLE_MAPS_API_KEY` | unset | Required only when `VITE_MAP_PROVIDER=google`. |

Vite variables are baked in at **build** time, so re-run with `--build` (or
`./rebuild.sh`) after changing them.

## Deployment modes

| Mode | Command | Notes |
| --- | --- | --- |
| Local / LAN | `docker compose up --build` | HTTP on port 80. |
| Public HTTPS | `./run-https.sh` | Needs `certs/fullchain.pem` + `certs/privkey.pem`. CORS is set for `locoguess.ru` — edit `docker-compose.https.yml` for another domain. |
| Fully offline | `./run-offline.sh` | Serves map tiles from disk. Run `python3 offline/download-tiles.py` once while online first. See `offline/README.md`. |

`./rebuild.sh` rebuilds without cache and restarts; `./stop.sh` shuts down.

## Local development (without Docker)

Requires Python 3.11+ and Node 20.19+ (Vite will refuse to build on older Node).

```bash
# Backend — port 8002, which is what the Vite dev proxy expects
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8002

# Frontend — http://localhost:5173, proxies /api and /ws to the backend
cd frontend
npm install
npm run dev
```

For Google Maps in dev, copy `frontend/.env.example` to `frontend/.env` and add
your key.

### Tests

```bash
cd backend && .venv/bin/python -m pytest     # backend
cd backend && .venv/bin/ruff check app/ tests/
cd frontend && npm test                      # frontend (vitest)
cd frontend && npm run build                 # type-check + production build
```

## Architecture

- **Backend** — Python 3.11+, FastAPI, SQLAlchemy, SQLite
- **Frontend** — React 19, TypeScript, Vite, Leaflet or Google Maps
- **Realtime** — WebSocket for server→client broadcasts (timer, round events);
  all mutations go through REST
- **State machine** — `LOBBY → PLAYING (GUESSING → REVEALING → COMPLETE) → FINISHED`

Identity is session-based: a UUID is assigned on team join, there is no auth.
The team captain submits the guess, one guess per team per round.

The database is SQLite, created automatically on first startup. There are no
migrations yet — to change the schema, delete `backend/locoguess.db` and
restart. In Docker it lives in the `db-data` volume.

See `CLAUDE.md` for a fuller tour of the code layout.
