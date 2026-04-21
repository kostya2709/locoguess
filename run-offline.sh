#!/bin/bash
# Run LocoGuess in OFFLINE mode:
#   - Leaflet map with locally-served tiles under /tiles/
#   - No internet needed at runtime
#
# Prerequisite: run offline/download-tiles.py ONCE (while you still have internet)
# to populate offline/tiles/. See offline/README.md.
set -e
cd "$(dirname "$0")"

if [ ! -d offline/tiles ] || [ -z "$(ls -A offline/tiles 2>/dev/null)" ]; then
  echo "! offline/tiles is empty. Download tiles first:"
  echo "    python3 offline/download-tiles.py"
  echo "  This only needs internet once, and only needs to be done one time."
  exit 1
fi

echo "→ Stopping containers..."
docker compose -f docker-compose.yml -f docker-compose.offline.yml down

echo "→ Building images (offline overrides)..."
docker compose -f docker-compose.yml -f docker-compose.offline.yml build --no-cache

echo "→ Starting containers (detached)..."
docker compose -f docker-compose.yml -f docker-compose.offline.yml up -d

echo
echo "✓ Offline mode up. LAN clients can reach the server on port 80."
echo "  Logs: docker compose -f docker-compose.yml -f docker-compose.offline.yml logs -f"
