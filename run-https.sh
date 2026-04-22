#!/bin/bash
# Run LocoGuess with HTTPS on a public server.
# Prereq: ./certs/fullchain.pem + ./certs/privkey.pem exist.
set -e
cd "$(dirname "$0")"

if [ ! -f certs/fullchain.pem ] || [ ! -f certs/privkey.pem ]; then
  echo "! Missing cert files. Expected:"
  echo "    certs/fullchain.pem  (leaf + intermediate, leaf first)"
  echo "    certs/privkey.pem    (private key)"
  exit 1
fi

echo "→ Stopping containers..."
docker compose -f docker-compose.yml -f docker-compose.https.yml down

echo "→ Building images (no cache)..."
docker compose -f docker-compose.yml -f docker-compose.https.yml build --no-cache

echo "→ Starting containers (detached)..."
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d

echo
echo "✓ HTTPS mode up."
echo "  Logs: docker compose -f docker-compose.yml -f docker-compose.https.yml logs -f"
