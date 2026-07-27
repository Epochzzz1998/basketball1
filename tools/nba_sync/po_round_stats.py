#!/usr/bin/env python3
"""Per-round playoff player stats, scraped from Basketball-Reference series pages.

ESPN only carries player box scores from 1993 on, and it never labels the round.
B-R publishes one page per playoff series for every season back to 1947, with the
round spelled out in the URL and a per-player totals table for each team:

    /playoffs/2025-nba-eastern-conference-finals-pacers-vs-knicks.html
        <table id="IND">  <table id="NYK">   g gs mp fg fga fg3 ... pts

Two phases, so a 45-minute scrape is never repeated:
  scrape  -> one JSON per season under po_rounds_cache/ (resumable, skips cached)
  build   -> SQL from the cache into player_playoff_round_stats (instant, re-runnable)

Identity: B-R gives names, the site keys on 'nba-<espnId>'. Matching is scoped to the
team's own playoff roster that season (~15 candidates), then br_ids_cache, then the
global unique-name map. The sum of a player's rounds must equal his season playoff
games — mismatches are reported, never silently written.

Usage:
  python3 po_round_stats.py --scrape                    # all 50 seasons (~45 min)
  python3 po_round_stats.py --scrape --seasons 2025     # one season
  python3 po_round_stats.py --build --dry-run           # SQL + reconciliation report
  python3 po_round_stats.py --build                     # execute
"""

import argparse
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from br_backfill import BR2CODE, norm, strip_suffix

CACHE_DIR = Path(__file__).parent / 'po_rounds_cache'
IDS_CACHE = Path(__file__).parent / 'br_ids_cache.json'
FIRST_YEAR, LAST_YEAR = 1977, 2026
SEASON_BASE = 1976                      # season_num = year - 1976
DELAY = 3.5                             # B-R tolerates ~20 req/min; stay under it
ROUND_NAME = {1: '首轮', 2: '半决赛', 3: '分区决赛', 4: '总决赛'}
TABLE = 'player_playoff_round_stats'


def round_of(slug):
    """URL slug -> round number. Naming is identical from 1977 to today; order matters
    because 'conference-finals' must not fall through to the plain 'finals' branch."""
    if '-conference-first-round-' in slug:
        return 1
    if '-conference-semifinals-' in slug:
        return 2
    if '-conference-finals-' in slug:
        return 3
    if re.match(r'^\d{4}-nba-finals-', slug):
        return 4
    return None


def fetch_html(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=sync.UA)
            return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
        except Exception as e:
            code = getattr(e, 'code', None)
            if attempt == retries - 1:
                raise
            # 429 means we tripped the rate limiter: back off hard before retrying
            wait = 90 if code == 429 else 10
            print(f'    retry {attempt + 1} in {wait}s ({e})', flush=True)
            time.sleep(wait)


def parse_team_table(page, br_code):
    """<table id="XXX"> -> [{slug, name, g, gs, mp, fg, ...}] series TOTALS per player"""
    m = re.search(rf'<table[^>]*id="{br_code}"[^>]*>(.*?)</table>', page, re.S)
    if not m:
        return []
    body = re.search(r'<tbody>(.*?)</tbody>', m.group(1), re.S)
    if not body:
        return []
    rows = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', body.group(1), re.S):
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        raw = cells.get('player') or cells.get('name_display') or ''
        a = re.search(r'href="/players/[a-z]/([a-z0-9]+)\.html"[^>]*>([^<]+)</a>', raw)
        if not a:
            continue

        def iv(key):
            v = re.sub(r'<[^>]*>', '', cells.get(key) or '').strip()
            try:
                return int(v)
            except ValueError:
                return 0

        row = {'slug': a.group(1), 'name': a.group(2).strip()}
        for k in ('g', 'mp', 'fg', 'fga', 'fg3', 'fg3a', 'ft', 'fta',
                  'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts'):
            row[k] = iv(k)
        # Games started: the series-page header advertises a 'gs' column but the data rows
        # never carry the cell. Keep it None (-> NULL) rather than 0, which would read as
        # "nobody started this series".
        row['gs'] = iv('gs') if 'gs' in cells else None
        if row['g']:
            rows.append(row)
    return rows


def scrape_season(year, force=False):
    """-> {'year', 'series': [{round, teams:{code: rows}, ...}]}, cached on disk"""
    CACHE_DIR.mkdir(exist_ok=True)
    out_file = CACHE_DIR / f'{year}.json'
    if out_file.exists() and not force:
        print(f'{year}: cached, skip')
        return json.loads(out_file.read_text())

    idx = fetch_html(f'https://www.basketball-reference.com/playoffs/NBA_{year}.html')
    links = sorted(set(re.findall(rf'href="(/playoffs/{year}-nba-[a-z0-9\-]+\.html)"', idx)))
    # 12-team bracket with top-2 byes through 1983 = 11 series; 16-team era = 15
    expected = 11 if year <= 1983 else 15
    if len(links) < expected:
        raise RuntimeError(f'{year}: {len(links)} series links, expected {expected}')

    series = []
    for href in links:
        slug = href.rsplit('/', 1)[-1][:-5]
        rnd = round_of(slug)
        if rnd is None:
            print(f'  ?? unknown round: {slug}')
            continue
        time.sleep(DELAY)
        page = fetch_html('https://www.basketball-reference.com' + href)
        codes = sorted(set(re.findall(r'<table[^>]*id="([A-Z]{3})"[^>]*>', page)))
        codes = [c for c in codes if not c.endswith('advanced')]
        if len(codes) != 2:
            print(f'  ?? {slug}: found team tables {codes}')
            continue
        teams = {c: parse_team_table(page, c) for c in codes}
        series.append({'slug': slug, 'round': rnd, 'teams': teams})
        n = sum(len(v) for v in teams.values())
        print(f'  R{rnd} {codes[0]}/{codes[1]}: {n} player rows', flush=True)

    data = {'year': year, 'series': series}
    out_file.write_text(json.dumps(data, ensure_ascii=False))
    print(f'{year}: {len(series)} series cached -> {out_file.name}', flush=True)
    return data


# ─────────────────────────────────────────── identity + SQL

def db_rows(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode()[:500])
    return [l.split('\t') for l in res.stdout.decode('utf-8').splitlines()[1:]]


def load_rosters():
    """(season_num, team_code) -> {norm_name: pid}, plus (season,pid) -> season playoff games"""
    q = ("SELECT s.SEASON_NUM, SUBSTRING_INDEX(s.PLAYER_TEAM,'->',-1), s.PLAYER_ID, "
         "COALESCE(p.NAME_EN, p.PLAYER_NAME), s.PLAYER_APPEARANCE "
         "FROM player_playoff_stats s JOIN dream_player p ON p.PLAYER_ID = s.PLAYER_ID "
         "WHERE s.SEASON_NUM <> 99;")
    roster, games = {}, {}
    for season, team, pid, name, gp in db_rows(q):
        key = (int(season), team)
        d = roster.setdefault(key, {})
        for n in {norm(name), strip_suffix(norm(name))}:
            d.setdefault(n, pid)
        games[(int(season), pid)] = int(float(gp or 0))
    return roster, games


def load_global_names():
    seen = {}
    for pid, name in db_rows("SELECT PLAYER_ID, COALESCE(NAME_EN, PLAYER_NAME) FROM dream_player;"):
        for n in {norm(name), strip_suffix(norm(name))}:
            seen.setdefault(n, set()).add(pid)
    return {k: next(iter(v)) for k, v in seen.items() if len(v) == 1}


def resolve(row, season_num, code, roster, global_names, slug_ids):
    """B-R row -> site player id. Team roster first (≈15 candidates, safest), then the
    slug cache written by br_backfill, then a globally-unique name, then the local
    nba-br<slug> id that the pre-1994 backfill would have minted."""
    keys = {norm(row['name']), strip_suffix(norm(row['name']))}
    pool = roster.get((season_num, code), {})
    for k in keys:
        if k in pool:
            return pool[k], 'roster'
    if row['slug'] in slug_ids:
        return slug_ids[row['slug']], 'slug-cache'
    for k in keys:
        if k in global_names:
            return global_names[k], 'name'
    local = f"nba-br{row['slug']}"
    if local in slug_ids.values():
        return local, 'local'
    return None, None


COLS = ('STATS_ID, PLAYER_ID, SEASON_NUM, ROUND, PLAYER_TEAM, OPP_TEAM, PLAYER_APPEARANCE, '
        'PLAYER_FR_APPEARANCE, PLAYING_TIME, PLAYER_AVG_SCORE, PLAYER_AVG_REB, PLAYER_AVG_OFF_REB, '
        'PLAYER_AVG_DEF_REB, PLAYER_AVG_ASS, PLAYER_AVG_STEAL, PLAYER_AVG_BLOCK, PLAYER_AVG_TURNOVER, '
        'PLAYER_AVG_PF, '
        'PLAYER_AVG_FGM, PLAYER_AVG_FGA, PLAYER_ACCURACY, PLAYER_AVG_TPM, PLAYER_AVG_TPA, '
        'PLAYER_THREE_ACCURACY, PLAYER_AVG_FTM, PLAYER_AVG_FTA, PLAYER_FREETHROW_ACCURACY, PLAYER_PER')


def row_sql(pid, season_num, rnd, code, opp, r):
    g = r['g']
    per = lambda t: sync.num(t / g, 3)
    pct = lambda made, att: sync.num(made / att, 4) if att else 'NULL'
    # classic EFF, same definition the rest of the site uses for 效率值
    eff = (r['pts'] + r['trb'] + r['ast'] + r['stl'] + r['blk']
           - (r['fga'] - r['fg']) - (r['fta'] - r['ft']) - r['tov']) / g
    # Series pages carry no games-started cell, so gs is always missing (older caches
    # recorded it as 0). Falsy means unknown -> NULL; a real value passes through if
    # B-R ever starts publishing the column.
    gs = r.get('gs')
    vals = [f"'{pid}-p{season_num}r{rnd}'", f"'{pid}'", str(season_num), str(rnd),
            f"'{sync.esc(code)}'", f"'{sync.esc(opp)}'", str(g),
            str(gs) if gs else 'NULL',
            per(r['mp']), per(r['pts']), per(r['trb']), per(r['orb']), per(r['drb']),
            per(r['ast']), per(r['stl']), per(r['blk']), per(r['tov']), per(r['pf']),
            per(r['fg']), per(r['fga']), pct(r['fg'], r['fga']),
            per(r['fg3']), per(r['fg3a']), pct(r['fg3'], r['fg3a']),
            per(r['ft']), per(r['fta']), pct(r['ft'], r['fta']), sync.num(eff, 1)]
    return f"INSERT INTO {TABLE} ({COLS}) VALUES ({', '.join(vals)});"


def build(years, dry):
    roster, season_games = load_rosters()
    global_names = load_global_names()
    slug_ids = json.loads(IDS_CACHE.read_text()) if IDS_CACHE.exists() else {}

    stmts, unresolved, how = [], [], {}
    per_player_games = {}                       # (season, pid) -> games summed over rounds
    for year in years:
        f = CACHE_DIR / f'{year}.json'
        if not f.exists():
            print(f'{year}: no cache, run --scrape first')
            continue
        season_num = year - SEASON_BASE
        data = json.loads(f.read_text())
        for s in data['series']:
            codes = list(s['teams'].keys())
            for br_code, rows in s['teams'].items():
                code = BR2CODE.get(br_code, br_code)
                opp_br = [c for c in codes if c != br_code][0]
                opp = BR2CODE.get(opp_br, opp_br)
                for r in rows:
                    pid, src = resolve(r, season_num, code, roster, global_names, slug_ids)
                    if not pid:
                        unresolved.append((year, code, r['name']))
                        continue
                    how[src] = how.get(src, 0) + 1
                    stmts.append(row_sql(pid, season_num, s['round'], code, opp, r))
                    k = (season_num, pid)
                    per_player_games[k] = per_player_games.get(k, 0) + r['g']

    # reconciliation: rounds must add up to the season playoff total already in the DB
    mismatch = [(k, v, season_games.get(k)) for k, v in per_player_games.items()
                if season_games.get(k) is not None and season_games[k] != v]
    missing = [k for k in per_player_games if k not in season_games]

    print(f'\nrows: {len(stmts)}   matched by: {how}')
    print(f'unresolved names: {len(unresolved)}')
    for u in unresolved[:15]:
        print('   ', u)
    print(f'players with no season playoff row: {len(missing)}')
    print(f'games mismatch (rounds vs season total): {len(mismatch)}')
    for k, v, t in mismatch[:15]:
        print(f'    season {k[0]} {k[1]}: rounds={v} season={t}')

    if not stmts:
        return
    seasons = sorted({y - SEASON_BASE for y in years})
    sql = ('START TRANSACTION;\n'
           + f"DELETE FROM {TABLE} WHERE SEASON_NUM IN ({','.join(map(str, seasons))});\n"
           + '\n'.join(stmts) + '\nCOMMIT;\n')
    out = Path(__file__).parent / 'po_round_stats.sql'
    out.write_text(sql)
    print(f'SQL written: {out.name} ({len(sql) // 1024} KB)')
    if dry:
        return
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:800])
    print('applied.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scrape', action='store_true')
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--seasons', help='e.g. 2025 or 1977-1990 (default: all)')
    ap.add_argument('--force', action='store_true', help='re-scrape cached seasons')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    if a.seasons and '-' in a.seasons:
        lo, hi = (int(x) for x in a.seasons.split('-'))
        years = list(range(lo, hi + 1))
    elif a.seasons:
        years = [int(a.seasons)]
    else:
        years = list(range(FIRST_YEAR, LAST_YEAR + 1))

    if a.scrape:
        for y in years:
            try:
                scrape_season(y, a.force)
            except Exception as e:
                print(f'{y}: FAILED {e}', flush=True)
            time.sleep(DELAY)
    if a.build:
        build(years, a.dry_run)
    if not a.scrape and not a.build:
        ap.error('pass --scrape and/or --build')


if __name__ == '__main__':
    main()
