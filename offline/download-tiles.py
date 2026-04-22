#!/usr/bin/env python3
"""Download OpenStreetMap tiles for offline LocoGuess hosting.

Strategy: the whole world at low zoom + Russia only at higher zoom.
This keeps the total footprint small while letting players recognise
both the country on a world map and individual cities inside Russia.

Usage:
    python3 download-tiles.py

Env vars (all optional):
    WORLD_MAX_ZOOM   default 4   — zoom levels 0..N cover the whole world
    RUSSIA_MAX_ZOOM  default 8   — zoom levels (WORLD_MAX_ZOOM+1)..N cover Russia only
    TILES_DIR        default ./tiles
    USER_AGENT       default 'LocoGuess-Offline/1.0'
    RATE_LIMIT       default 2.0 — requests per second (OSM allows up to 2)
    TILE_SERVER      default https://tile.openstreetmap.org

Tiles that already exist are skipped, so the script is safe to resume.
"""

import math
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

WORLD_MAX_ZOOM = int(os.environ.get('WORLD_MAX_ZOOM', '4'))
RUSSIA_MAX_ZOOM = int(os.environ.get('RUSSIA_MAX_ZOOM', '8'))
# Per-POI high-zoom coverage. Disabled unless POI_MAX_ZOOM > RUSSIA_MAX_ZOOM.
POI_MAX_ZOOM = int(os.environ.get('POI_MAX_ZOOM', '0'))
POI_FILE = Path(os.environ.get('POI_FILE', Path(__file__).parent / 'pois.csv'))
POI_DEFAULT_RADIUS_KM = float(os.environ.get('POI_DEFAULT_RADIUS_KM', '10'))
TILES_DIR = Path(os.environ.get('TILES_DIR', Path(__file__).parent / 'tiles'))
USER_AGENT = os.environ.get('USER_AGENT', 'LocoGuess-Offline/1.0')
RATE_LIMIT = float(os.environ.get('RATE_LIMIT', '2.0'))
SERVER = os.environ.get('TILE_SERVER', 'https://tile.openstreetmap.org').rstrip('/')

# Russia bounding boxes: main body (European + Siberia) + Chukotka (east of antimeridian).
# (north_lat, south_lat, west_lng, east_lng)
RUSSIA_BBOXES = [
    (82.0, 41.0, 19.0, 180.0),
    (72.0, 64.0, -180.0, -170.0),
]


def deg2tile(lat_deg: float, lng_deg: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat_deg)
    n = 2 ** zoom
    x = int((lng_deg + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def tiles_for_bbox(bbox, zoom: int):
    north, south, west, east = bbox
    max_idx = 2 ** zoom - 1
    nw_x, nw_y = deg2tile(north, west, zoom)
    se_x, se_y = deg2tile(south, east, zoom)
    nw_x = max(0, min(nw_x, max_idx))
    se_x = max(0, min(se_x, max_idx))
    nw_y = max(0, min(nw_y, max_idx))
    se_y = max(0, min(se_y, max_idx))
    for x in range(nw_x, se_x + 1):
        for y in range(nw_y, se_y + 1):
            yield x, y


def load_pois() -> list[tuple[float, float, float]]:
    """Read POIs (lat, lng, radius_km) from POI_FILE. Returns [] if missing."""
    if not POI_FILE.exists():
        return []
    out = []
    for raw in POI_FILE.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split(',')
        try:
            lat = float(parts[0])
            lng = float(parts[1])
            radius = float(parts[2]) if len(parts) > 2 and parts[2].strip() else POI_DEFAULT_RADIUS_KM
        except (IndexError, ValueError):
            print(f"  ! bad POI line, skipped: {line!r}", file=sys.stderr)
            continue
        out.append((lat, lng, radius))
    return out


def poi_bbox(lat: float, lng: float, radius_km: float):
    """Approx bounding box around a point given a km radius."""
    deg_lat = radius_km / 111.0
    deg_lng = deg_lat / max(0.01, math.cos(math.radians(lat)))
    return (lat + deg_lat, lat - deg_lat, lng - deg_lng, lng + deg_lng)


def collect_tiles() -> list[tuple[int, int, int]]:
    seen = set()
    # Whole world at low zoom.
    for z in range(0, WORLD_MAX_ZOOM + 1):
        n = 2 ** z
        for x in range(n):
            for y in range(n):
                seen.add((z, x, y))
    # Russia only at medium zoom.
    for z in range(WORLD_MAX_ZOOM + 1, RUSSIA_MAX_ZOOM + 1):
        for bbox in RUSSIA_BBOXES:
            for x, y in tiles_for_bbox(bbox, z):
                seen.add((z, x, y))
    # Per-POI coverage at high zoom (only if POI_MAX_ZOOM is set beyond Russia).
    if POI_MAX_ZOOM > RUSSIA_MAX_ZOOM:
        pois = load_pois()
        for z in range(RUSSIA_MAX_ZOOM + 1, POI_MAX_ZOOM + 1):
            for lat, lng, radius_km in pois:
                for x, y in tiles_for_bbox(poi_bbox(lat, lng, radius_km), z):
                    seen.add((z, x, y))
    return sorted(seen)


def download_tile(z: int, x: int, y: int) -> bool:
    """Download a single tile unless it already exists. Return True if network was hit."""
    path = TILES_DIR / str(z) / str(x) / f"{y}.png"
    if path.exists() and path.stat().st_size > 0:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    url = f"{SERVER}/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    tmp = path.with_suffix('.png.part')
    tmp.write_bytes(data)
    tmp.rename(path)
    return True


def main():
    tiles = collect_tiles()
    delay = 1.0 / RATE_LIMIT
    eta_min = len(tiles) * delay / 60
    plan = f"world z0..{WORLD_MAX_ZOOM} + Russia z{WORLD_MAX_ZOOM + 1}..{RUSSIA_MAX_ZOOM}"
    if POI_MAX_ZOOM > RUSSIA_MAX_ZOOM:
        poi_count = len(load_pois())
        plan += f" + {poi_count} POIs z{RUSSIA_MAX_ZOOM + 1}..{POI_MAX_ZOOM}"
    print(
        f"Plan: {len(tiles):,} tiles ({plan}). "
        f"At {RATE_LIMIT} req/s worst case ETA: {eta_min:.0f} min.",
        file=sys.stderr,
    )
    print(f"Output: {TILES_DIR.resolve()}", file=sys.stderr)

    downloaded = 0
    skipped = 0
    errors = 0
    start = time.time()
    for i, (z, x, y) in enumerate(tiles, 1):
        try:
            if download_tile(z, x, y):
                downloaded += 1
                time.sleep(delay)
            else:
                skipped += 1
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            errors += 1
            print(f"  ! z={z} x={x} y={y}: {e}", file=sys.stderr)
            time.sleep(delay * 2)

        if i % 200 == 0 or i == len(tiles):
            elapsed = time.time() - start
            remaining = (len(tiles) - i) * delay
            print(
                f"  {i:>6}/{len(tiles):<6}  "
                f"downloaded={downloaded} skipped={skipped} errors={errors}  "
                f"elapsed={elapsed/60:.1f}m  remaining≈{remaining/60:.1f}m",
                file=sys.stderr,
            )

    print(
        f"\n✓ Done. {downloaded} downloaded, {skipped} skipped, {errors} errors.",
        file=sys.stderr,
    )
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
