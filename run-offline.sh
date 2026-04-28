#!/bin/bash
# Run LocoGuess in OFFLINE mode:
#   - Leaflet map with locally-served tiles under /tiles/
#   - No internet needed at runtime
#
# Prereq: run offline/download-tiles.py ONCE (while you still have internet)
# to populate offline/tiles/. See offline/README.md.
#
# Images must already be built locally (Docker metadata check fails without
# internet). Do the build once at home while online:
#   ./run-offline.sh --build
# then at the offline venue just:
#   ./run-offline.sh
set -e
cd "$(dirname "$0")"

if [ ! -d offline/tiles ] || [ -z "$(ls -A offline/tiles 2>/dev/null)" ]; then
  echo "! offline/tiles is empty. Download tiles first:"
  echo "    python3 offline/download-tiles.py"
  echo "  This only needs internet once, and only needs to be done one time."
  exit 1
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.offline.yml"

echo "→ Stopping containers..."
$COMPOSE down

if [ "$1" = "--build" ]; then
  echo "→ Building images (requires internet)..."
  $COMPOSE build
  echo "→ Starting containers (detached)..."
  $COMPOSE up -d
else
  # Sanity-check: images must exist locally.
  if ! docker image inspect locoguess-frontend >/dev/null 2>&1 \
    || ! docker image inspect locoguess-backend >/dev/null 2>&1; then
    echo "! locoguess-frontend or locoguess-backend image is missing."
    echo "  First build (needs internet), then retry:"
    echo "    ./run-offline.sh --build"
    exit 1
  fi
  echo "→ Starting containers from existing images (no rebuild, offline-safe)..."
  $COMPOSE up -d
fi

echo
echo "✓ Offline mode up."
echo
echo "Players connect to one of these URLs on the same WiFi as this laptop:"
print_url() {
  [ -n "$1" ] && echo "    http://$1/"
}

# WSL on Windows: ask the Windows host for its LAN IPs.
if grep -qi microsoft /proc/version 2>/dev/null && command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "
    Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { \$_.IPAddress -notlike '127.*' -and \$_.IPAddress -notlike '169.254.*' -and \$_.InterfaceAlias -notlike '*Loopback*' -and \$_.InterfaceAlias -notlike '*vEthernet*' -and \$_.InterfaceAlias -notlike '*WSL*' -and \$_.InterfaceAlias -notlike '*Tailscale*' -and \$_.InterfaceAlias -notlike '*xeovo*' } |
      Select-Object -ExpandProperty IPAddress
  " 2>/dev/null | tr -d '\r' | while read -r ip; do print_url "$ip"; done
else
  lan_ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<NF; i++) if ($i=="src") { print $(i+1); exit }}')
  print_url "$lan_ip"
fi

echo
echo "  Logs: $COMPOSE logs -f"
