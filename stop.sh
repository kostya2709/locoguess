#!/bin/bash
# Stop LocoGuess containers (any mode). Data volumes are preserved.
set -e
cd "$(dirname "$0")"

compose_args=(-f docker-compose.yml)
mode="online"
if [ -f docker-compose.https.yml ] && docker compose -f docker-compose.yml -f docker-compose.https.yml ps --services --filter status=running 2>/dev/null | grep -q .; then
  compose_args+=(-f docker-compose.https.yml)
  mode="https"
elif [ -f docker-compose.offline.yml ] && docker compose -f docker-compose.yml -f docker-compose.offline.yml ps --services --filter status=running 2>/dev/null | grep -q .; then
  compose_args+=(-f docker-compose.offline.yml)
  mode="offline"
fi

echo "→ Stopping $mode mode..."
docker compose "${compose_args[@]}" down
echo "✓ Stopped. Data volumes (db-data, photos) are intact."
