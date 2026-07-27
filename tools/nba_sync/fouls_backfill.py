#!/usr/bin/env python3
"""One-off backfill of PLAYER_AVG_PF (fouls per game) into the season stat tables.

Fouls were never part of the original schema. Sources by era, cheapest first:
  regular season 1994-2026  ESPN byathlete carries avgFouls
  regular season 1977-1993  B-R per_game season pages (ESPN's index starts 1994)
  playoffs, all 50 seasons  derived in SQL from player_playoff_round_stats, which
                            already holds per-round fouls from the B-R series pages
                            (no requests at all) — see --playoffs

sync.py writes the column from now on, so this script only exists to fill history.

Usage:
  python3 fouls_backfill.py --playoffs                 # SQL-only, instant
  python3 fouls_backfill.py --espn --seasons 1994-2026 # regular season via ESPN
  python3 fouls_backfill.py --br --seasons 1977-1993   # regular season via B-R
  python3 fouls_backfill.py --career                   # recompute season-99 rows
"""

import argparse
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from br_backfill import norm, strip_suffix

SEASON_BASE = 1976


def run_sql(sql, label):
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:600])
    print(f'  {label}: applied ({len(sql) // 1024} KB)')


def db_rows(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    return [l.split('\t') for l in res.stdout.decode('utf-8').splitlines()[1:]]


def do_playoffs():
    """Playoff season averages = games-weighted mean of the per-round rows."""
    sql = ("UPDATE player_playoff_stats s "
           "JOIN (SELECT PLAYER_ID, SEASON_NUM, "
           "             SUM(PLAYER_AVG_PF * PLAYER_APPEARANCE) / NULLIF(SUM(PLAYER_APPEARANCE),0) pf "
           "      FROM player_playoff_round_stats GROUP BY PLAYER_ID, SEASON_NUM) r "
           "  ON r.PLAYER_ID = s.PLAYER_ID AND r.SEASON_NUM = s.SEASON_NUM "
           "SET s.PLAYER_AVG_PF = ROUND(r.pf, 3);")
    run_sql(sql, 'playoffs from round table')


def do_espn(years):
    for year in years:
        season_num = year - SEASON_BASE
        try:
            rows = sync.fetch_athlete_stats(year, 2)
        except Exception as e:
            print(f'{year}: FAILED {e}')
            continue
        stmts = []
        for r in rows:
            pf = r['stats'].get('avgFouls')
            if pf is None:
                continue
            stmts.append(f"UPDATE player_stats SET PLAYER_AVG_PF={sync.num(pf)} "
                         f"WHERE PLAYER_ID='nba-{r['espnId']}' AND SEASON_NUM={season_num};")
        print(f'{year} (season {season_num}): {len(stmts)} players')
        if stmts:
            run_sql('START TRANSACTION;\n' + '\n'.join(stmts) + '\nCOMMIT;\n', str(year))


def br_pergame_fouls(year):
    """{norm_name: fouls per game} from the B-R season per-game table.

    B-R has renamed these data-stat keys over time (player -> name_display, g -> games,
    pf -> pf_per_g), so read every candidate name rather than one fixed key."""
    req = urllib.request.Request(
        f'https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html', headers=sync.UA)
    page = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    m = re.search(r'<table[^>]*id="per_game_stats"[^>]*>(.*?)</table>', page, re.S)
    if not m:
        return {}
    out = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(1), re.S):
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        def first(*keys):
            for k in keys:
                v = re.sub(r'<[^>]*>', '', cells.get(k) or '').strip()
                if v:
                    return v
            return ''

        raw = cells.get('player') or cells.get('name_display') or ''
        a = re.search(r'href="/players/[a-z]/[a-z0-9]+\.html"[^>]*>([^<]+)</a>', raw)
        pf = first('pf_per_g', 'pf')
        g = first('games', 'g')
        if not a or not pf:
            continue
        try:
            pf, g = float(pf), int(g or 0)
        except ValueError:
            continue
        # A traded player gets one row per stint plus a combined TOT/2TM row. The combined
        # row always carries the most games, and that is the season average we want.
        key = norm(a.group(1))
        if key not in out or g > out[key][1]:
            out[key] = (pf, g)
    return {k: v[0] for k, v in out.items()}


def do_br(years):
    for year in years:
        season_num = year - SEASON_BASE
        time.sleep(3.5)                       # B-R rate limit
        try:
            fouls = br_pergame_fouls(year)
        except Exception as e:
            print(f'{year}: FAILED {e}')
            continue
        q = ("SELECT s.PLAYER_ID, COALESCE(p.NAME_EN, p.PLAYER_NAME) FROM player_stats s "
             f"JOIN dream_player p ON p.PLAYER_ID = s.PLAYER_ID WHERE s.SEASON_NUM = {season_num};")
        stmts, miss = [], 0
        for pid, name in db_rows(q):
            pf = fouls.get(norm(name)) or fouls.get(strip_suffix(norm(name)))
            if pf is None:
                miss += 1
                continue
            stmts.append(f"UPDATE player_stats SET PLAYER_AVG_PF={sync.num(pf)} "
                         f"WHERE PLAYER_ID='{sync.esc(pid)}' AND SEASON_NUM={season_num};")
        print(f'{year} (season {season_num}): {len(stmts)} matched, {miss} unmatched')
        if stmts:
            run_sql('START TRANSACTION;\n' + '\n'.join(stmts) + '\nCOMMIT;\n', str(year))


def do_career():
    """Career rows (SEASON_NUM=99) are games-weighted over the real seasons."""
    for table in ('player_stats', 'player_playoff_stats'):
        sql = (f"UPDATE {table} c JOIN ("
               f"  SELECT PLAYER_ID, ROUND(SUM(PLAYER_AVG_PF*PLAYER_APPEARANCE)"
               f"/NULLIF(SUM(PLAYER_APPEARANCE),0),3) pf "
               f"  FROM {table} WHERE SEASON_NUM<>99 AND PLAYER_AVG_PF IS NOT NULL "
               f"  GROUP BY PLAYER_ID) a ON a.PLAYER_ID = c.PLAYER_ID "
               f"SET c.PLAYER_AVG_PF = a.pf WHERE c.SEASON_NUM = 99;")
        run_sql(sql, f'{table} career')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--playoffs', action='store_true')
    ap.add_argument('--espn', action='store_true')
    ap.add_argument('--br', action='store_true')
    ap.add_argument('--career', action='store_true')
    ap.add_argument('--seasons', help='e.g. 1994-2026')
    a = ap.parse_args()

    years = []
    if a.seasons:
        if '-' in a.seasons:
            lo, hi = (int(x) for x in a.seasons.split('-'))
            years = list(range(lo, hi + 1))
        else:
            years = [int(a.seasons)]

    if a.playoffs:
        do_playoffs()
    if a.espn:
        do_espn(years)
    if a.br:
        do_br(years)
    if a.career:
        do_career()
    if not any((a.playoffs, a.espn, a.br, a.career)):
        ap.error('pick at least one of --playoffs / --espn / --br / --career')


if __name__ == '__main__':
    main()
