#!/bin/bash
# Rebuild Docker images from current source and restart containers.
# Data volumes (db-data, photos) are always preserved.
set -e
cd "$(dirname "$0")"

echo "→ Stopping containers..."
docker compose down

echo "→ Building images (no cache)..."
docker compose build --no-cache

echo "→ Starting containers (detached)..."
docker compose up -d

echo
echo "✓ Done. Hard-refresh the browser (Ctrl+Shift+R) to pick up the new frontend bundle."
echo "  Logs: docker compose logs -f"
