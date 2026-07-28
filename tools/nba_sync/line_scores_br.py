#!/usr/bin/env python3
"""Quarter-by-quarter scores into game_period_score.

The per-game crawls (po_game_logs_br.py, rs_game_logs_br.py) keep only the player tables,
so the line score has to be fetched separately for everything already crawled. The regular
season crawl now grabs it in the same pass — this script exists for the playoff games that
were crawled before, and for re-running a date range on demand.

  --playoffs --seasons 2025-2026     fetch line scores for those playoff seasons
  --from-rs  --seasons 2026          harvest them out of rs_games_cache (no requests at all)
  --apply                            write whatever is cached into the DB

Storage is one row per game per team per period, not four fixed quarter columns: an
overtime game has five, six or more periods and a fixed schema would silently drop them.

**Never run this while another crawler is going.** B-R's limit is per IP, so two processes
at ~17 req/min each get the address banned.
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from po_game_logs_br import fetch_html, parse_line_score, GAMES_CACHE as PO_GAMES_CACHE
from br_backfill import BR2CODE

HERE = Path(__file__).parent
CACHE = HERE / 'line_score_cache'
RS_CACHE = HERE / 'rs_games_cache'
BASE = 'https://www.basketball-reference.com'
DELAY = 3.5
TABLE = 'game_period_score'


def cached(year):
    f = CACHE / f'{year}.json'
    return json.loads(f.read_text()) if f.exists() else {}


def save(year, data):
    CACHE.mkdir(exist_ok=True)
    (CACHE / f'{year}.json').write_text(json.dumps(data, ensure_ascii=False))


def from_playoffs(years):
    """Fetch the box page of every cached playoff game just for its line score."""
    for year in years:
        src = PO_GAMES_CACHE / f'{year}.json'
        if not src.exists():
            print(f'{year}: no playoff cache, skip', flush=True)
            continue
        games = json.loads(src.read_text())['games']
        have = cached(year)
        todo = [g for g in games if g['id'] not in have]
        print(f'{year}: {len(todo)} to fetch ({len(have)}/{len(games)} cached, '
              f'~{len(todo) * DELAY / 60:.0f} min)', flush=True)
        for i, g in enumerate(todo, 1):
            time.sleep(DELAY)
            try:
                periods = parse_line_score(fetch_html(f'{BASE}/boxscores/{g["id"]}.html'))
            except Exception as e:
                print(f'    {g["id"]}: {e}', flush=True)
                continue
            if periods:
                have[g['id']] = periods
            if i % 25 == 0:
                save(year, have)
                print(f'    {year}: {i}/{len(todo)}', flush=True)
        save(year, have)
        print(f'{year}: {len(have)} games cached', flush=True)


def from_rs(years):
    """No requests: the regular-season crawl already stores `periods` per game."""
    for year in years:
        f = RS_CACHE / f'{year}.jsonl'
        if not f.exists():
            continue
        have = cached(year)
        n = 0
        for line in f.read_text().splitlines():
            if not line.strip():
                continue
            try:
                g = json.loads(line)
            except Exception:
                continue
            if g.get('periods'):
                have[g['id']] = g['periods']
                n += 1
        save(year, have)
        print(f'{year}: {n} games harvested from rs_games_cache', flush=True)


def apply_all(dry):
    rows = []
    for f in sorted(CACHE.glob('*.json')):
        for gid, periods in json.loads(f.read_text()).items():
            for br_code, pts in periods.items():
                code = BR2CODE.get(br_code, br_code)
                for i, v in enumerate(pts, 1):
                    if v is None:
                        continue
                    rows.append(f"('{sync.esc(gid)}', '{sync.esc(code)}', {i}, {v})")
    print(f'rows: {len(rows)}')
    if not rows:
        return
    parts = ['START TRANSACTION;', f'DELETE FROM {TABLE};']
    for i in range(0, len(rows), 1000):
        parts.append(f'INSERT INTO {TABLE} (GAME_ID, TEAM, PERIOD, PTS) VALUES\n'
                     + ',\n'.join(rows[i:i + 1000]) + ';')
    parts.append('COMMIT;')
    sql = '\n'.join(parts) + '\n'
    (HERE / 'line_scores.sql').write_text(sql)
    if dry:
        print('dry run, SQL written to line_scores.sql')
        return
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:800])
    print('applied.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--playoffs', action='store_true')
    ap.add_argument('--from-rs', action='store_true')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--seasons', help='e.g. 2026 or 2020-2026')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    years = []
    if a.seasons and '-' in a.seasons:
        lo, hi = (int(x) for x in a.seasons.split('-'))
        years = list(range(lo, hi + 1))
    elif a.seasons:
        years = [int(a.seasons)]

    if a.playoffs:
        from_playoffs(sorted(years, reverse=True))
    if a.from_rs:
        from_rs(years)
    if a.apply:
        apply_all(a.dry_run)
    if not any((a.playoffs, a.from_rs, a.apply)):
        ap.error('pass --playoffs, --from-rs or --apply')


if __name__ == '__main__':
    main()
