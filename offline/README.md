# Offline mode

Run LocoGuess on a LAN with no internet access. Leaflet replaces Google Maps,
and OpenStreetMap tiles are served locally by nginx.

## One-time: download tiles (requires internet)

```bash
python3 offline/download-tiles.py
```

Defaults: whole world at zoom 0–4 + Russia at zoom 5–8. About **12k tiles,
~240 MB, ~1.7 h** at the default 2 req/s rate limit. The script respects OSM's
usage policy (2 req/s cap, real `User-Agent`) and is resumable — rerun after
any interruption and it skips what's already on disk.

Tweak ranges via env vars:

```bash
WORLD_MAX_ZOOM=4 RUSSIA_MAX_ZOOM=9 python3 offline/download-tiles.py   # +1 zoom level, ~6.6 h
RATE_LIMIT=1.0 python3 offline/download-tiles.py                        # slower, safer
```

Tiles land in `offline/tiles/{z}/{x}/{y}.png`.

If you bump `RUSSIA_MAX_ZOOM`, also bump `VITE_MAX_ZOOM` in
`docker-compose.offline.yml` to match so Leaflet will actually request those
zoom levels.

## Run the game offline

```bash
./run-offline.sh
```

This stops anything running, rebuilds the frontend with offline overrides
(Leaflet + local tiles + capped max zoom), and starts detached.

LAN clients connect to `http://<server-ip>/`. Plain HTTP is fine on a trusted
network; the app uses `ws://` (not `wss://`) automatically.

## Going back to online mode

Just run `./rebuild.sh` as usual — the online `docker-compose.yml` doesn't
reference the tile volume or the offline build args.
