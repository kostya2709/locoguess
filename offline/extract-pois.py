#!/usr/bin/env python3
"""Extract correct_lat/lng from every pack round in the live DB, write to
offline/pois.csv. Run once before download-tiles.py when you want high-zoom
tiles around just the places used in your packs.

Temporarily stops the backend container so the SQLite DB isn't being written
while we copy it out.

Env vars:
    DEFAULT_RADIUS_KM   default 10   — radius column written to the CSV
    DB_VOLUME           default 'locoguess_db-data'
    OUT_FILE            default ./pois.csv  (relative to this script)
"""

import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_RADIUS_KM = float(os.environ.get('DEFAULT_RADIUS_KM', '10'))
DB_VOLUME = os.environ.get('DB_VOLUME', 'locoguess_db-data')
OUT_FILE = Path(os.environ.get('OUT_FILE', Path(__file__).parent / 'pois.csv'))


def extract_db_to_host() -> Path:
    """Copy the live DB out of the Docker volume to a temp file on the host."""
    tmp_dir = tempfile.mkdtemp(prefix='locoguess-poi-')
    subprocess.run(
        ['docker', 'run', '--rm',
         '-v', f'{DB_VOLUME}:/d:ro',
         '-v', f'{tmp_dir}:/out',
         'alpine', 'cp', '/d/locoguess.db', '/out/locoguess.db'],
        check=True,
    )
    return Path(tmp_dir) / 'locoguess.db'


def main():
    print(f"→ Copying DB from volume {DB_VOLUME!r}...", file=sys.stderr)
    db_path = extract_db_to_host()

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT correct_lat, correct_lng, location_name FROM pack_rounds"
    ).fetchall()
    conn.close()

    # Deduplicate by rounded coordinates (two packs referencing the same
    # location shouldn't double-download the same tiles).
    seen = set()
    unique = []
    for lat, lng, name in rows:
        key = (round(lat, 4), round(lng, 4))
        if key in seen:
            continue
        seen.add(key)
        unique.append((lat, lng, name or ''))

    with OUT_FILE.open('w', encoding='utf-8') as f:
        f.write('# lat,lng,radius_km,name\n')
        for lat, lng, name in unique:
            f.write(f'{lat},{lng},{DEFAULT_RADIUS_KM},{name}\n')

    print(f"✓ {len(unique)} unique POIs written to {OUT_FILE}", file=sys.stderr)

    # Cleanup
    db_path.unlink()
    db_path.parent.rmdir()


if __name__ == '__main__':
    main()
