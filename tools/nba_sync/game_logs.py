#!/usr/bin/env python3
"""Per-game box scores (game logs) from ESPN into player_game_stats.

ESPN is the right source here, not B-R: its box scores carry the athlete's ESPN id,
which IS our primary key ('nba-<espnId>') — no name matching, no ambiguity. Usable
coverage starts in 1994 (see FIRST_BOXSCORE_YEAR for why 1993 looks usable and isn't).

Playoff rounds are NOT taken from ESPN's own season-type-3 grouping, which is dirty:
1995 lists 16 team pairs where the bracket has 15, and 1993 lists 57. The bracket comes
from the B-R series cache that po_round_stats.py already wrote, so every ESPN game must
match a real series or it is dropped, and its round is B-R's. Play-in games live in
season type 5 and never enter this table at all.

Usage:
  python3 game_logs.py --season 2026 --type po           # one season's playoffs
  python3 game_logs.py --season 1994-2026 --type po      # every season ESPN can serve
  python3 game_logs.py --season 2026 --type reg          # regular season (1239 games)
  python3 game_logs.py --season 2026 --type po --dry-run
"""

import argparse
import concurrent.futures
import json
from datetime import datetime, timedelta
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from br_backfill import BR2CODE

CORE = 'http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons'
SUMMARY = 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='
SEASON_BASE = 1976
# ESPN serves playoff schedules back to the 70s but the box scores carry an EMPTY
# athletes array before 1994. Its "1993" bucket looks populated and is NOT: it holds
# the 1994 playoffs plus ~48 April-1994 regular-season games (57 team pairs instead of
# 15), i.e. mislabelled duplicate data. 1994 is the real first usable season.
FIRST_BOXSCORE_YEAR = 1994
TABLE = 'player_game_stats'
TYPE_NUM = {'reg': 2, 'po': 3}


def event_ids(year, stype):
    d = sync.get(f'{CORE}/{year}/types/{stype}/events?limit=500')
    return [it['$ref'].rsplit('/', 1)[-1].split('?')[0] for it in d.get('items', [])]


def game_date(iso):
    """ESPN stamps tip-off in UTC, so an 8pm-Eastern game lands on the NEXT calendar
    day ('2013-04-21T00:00Z' is B-R's 2013-04-20). Shift back 5 h before taking the
    date: no NBA game tips before noon local, so one fixed offset is right in both
    EST and EDT."""
    try:
        return (datetime.strptime(iso[:16], '%Y-%m-%dT%H:%M') - timedelta(hours=5)).strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return str(iso)[:10]


def fetch_game(eid):
    """-> {id, date, teams:[{code, score, home, winner, players:[...]}]} or None"""
    try:
        s = sync.get(f'{SUMMARY}{eid}')
    except Exception as e:
        print(f'  {eid}: {e}')
        return None
    comp = (s.get('header', {}).get('competitions') or [{}])[0]
    box = s.get('boxscore', {}).get('players') or []
    if len(box) != 2 or not comp.get('competitors'):
        return None

    meta = {}
    for c in comp['competitors']:
        meta[str(c['team']['id'])] = {
            'code': sync.code_of(c['team'].get('abbreviation') or ''),
            'score': int(c.get('score') or 0),
            'home': 1 if c.get('homeAway') == 'home' else 0,
            'winner': 1 if c.get('winner') else 0,
        }

    teams = []
    for g in box:
        tid = str(g['team']['id'])
        st = (g.get('statistics') or [{}])[0]
        keys = st.get('keys') or []
        players = []
        for a in st.get('athletes') or []:
            if a.get('didNotPlay') or not a.get('stats'):
                continue
            v = dict(zip(keys, a['stats']))
            # ESPN sometimes emits a row for a player who never checked in, with
            # minutes '--' and every stat zero, and its own didNotPlay flag unset.
            # B-R excludes those games (2015 Calathes: 9 games, not 10) — so do we.
            try:
                int(str(v.get('minutes')).strip())
            except (TypeError, ValueError):
                continue
            players.append({
                'espnId': str(a['athlete']['id']),
                'starter': 1 if a.get('starter') else 0,
                'v': v,
            })
        # ESPN declares a plusMinus column for seasons that predate the stat and fills
        # it with a literal '0' for every player (checked on 2008: Jamison, Butler,
        # Haywood all '0' while B-R has +9/+22/+12). An entire roster at exactly zero
        # is a placeholder, not a game — mark it unavailable instead of storing zeros.
        if players and all(str(p['v'].get('plusMinus')).strip() in ('0', '', 'None')
                           for p in players):
            for p in players:
                p['v']['plusMinus'] = None
        info = meta.get(tid, {})
        teams.append({**info, 'id': tid, 'players': players})
    if len(teams) != 2 or not all(t.get('code') for t in teams):
        return None
    return {'id': eid, 'date': game_date(comp.get('date')), 'teams': teams}


def br_series(year):
    """{frozenset({codeA, codeB}): (round, series_length)} from the po_rounds_cache
    that po_round_stats.py already scraped, or None when that season is not cached.

    ESPN's own season-type-3 lists are not trustworthy on their own (1995 carries 16
    team pairs, 1993 carries 57), so the authoritative bracket comes from B-R and any
    ESPN game whose pairing is not a real series gets dropped."""
    f = Path(__file__).parent / 'po_rounds_cache' / f'{year}.json'
    if not f.exists():
        return None
    out = {}
    for s in json.loads(f.read_text())['series']:
        codes = [BR2CODE.get(c, c) for c in s['teams']]
        if len(codes) != 2:
            continue
        # at least one player appears in every game of a series, so the max games
        # played across both rosters IS the series length
        length = max((r['g'] for rows in s['teams'].values() for r in rows), default=0)
        out[frozenset(codes)] = (s['round'], length)
    return out


def playoff_rounds(year, games):
    """game id -> round, keeping only games that belong to a real playoff series.
    Returns (rounds, dropped_count)."""
    table = br_series(year)
    if table is None:
        print('  no B-R cache for this season, falling back to derived rounds')
        return derive_rounds(games), 0

    by_pair = {}
    for g in games:
        by_pair.setdefault(frozenset(t['code'] for t in g['teams']), []).append(g)

    rounds, kept = {}, 0
    for pair, gs in by_pair.items():
        hit = table.get(pair)
        if not hit:
            continue                       # not a playoff matchup at all
        rnd, length = hit
        # contaminating regular-season games sit BEFORE the series, so keep the tail
        gs.sort(key=lambda g: g['date'])
        for g in gs[-length:] if length else gs:
            rounds[g['id']] = rnd
            kept += 1
    return rounds, len(games) - kept


def derive_rounds(games):
    """game id -> round 1..4. A team's Nth playoff series IS round N (16-team bracket,
    no byes since 1984 and none at all in the ESPN box-score era)."""
    series = {}
    for g in games:
        pair = frozenset(t['code'] for t in g['teams'])
        s = series.setdefault(pair, {'start': g['date'], 'games': []})
        s['start'] = min(s['start'], g['date'])
        s['games'].append(g['id'])
    by_team = {}
    for pair, s in series.items():
        for code in pair:
            by_team.setdefault(code, []).append((s['start'], pair))
    rnd_of_pair = {}
    for code, lst in by_team.items():
        for i, (_, pair) in enumerate(sorted(lst)):
            # a pair is shared by two teams; both must agree, take the max seen
            rnd_of_pair[pair] = max(rnd_of_pair.get(pair, 0), i + 1)
    out = {}
    for pair, s in series.items():
        for gid in s['games']:
            out[gid] = rnd_of_pair.get(pair)
    return out


def parse_int(x):
    try:
        return int(str(x).strip())
    except (TypeError, ValueError):
        return 0


def made_att(x):
    s = str(x or '').split('-')
    return (parse_int(s[0]), parse_int(s[1])) if len(s) == 2 else (0, 0)


COLS = ('GAME_STAT_ID, PLAYER_ID, SEASON_NUM, SEASON_TYPE, ROUND, GAME_ID, GAME_DATE, '
        'PLAYER_TEAM, OPP_TEAM, HOME, WIN, TEAM_SCORE, OPP_SCORE, STARTER, PLAYING_TIME, '
        'PTS, REB, OFF_REB, DEF_REB, AST, STL, BLK, TOV, PF, FGM, FGA, TPM, TPA, FTM, FTA, PLUS_MINUS')


def rows_of(game, season_num, stype, rnd, known):
    out = []
    a, b = game['teams']
    for me, opp in ((a, b), (b, a)):
        for p in me['players']:
            pid = f"nba-{p['espnId']}"
            if pid not in known:
                continue
            v = p['v']
            fgm, fga = made_att(v.get('fieldGoalsMade-fieldGoalsAttempted'))
            tpm, tpa = made_att(v.get('threePointFieldGoalsMade-threePointFieldGoalsAttempted'))
            ftm, fta = made_att(v.get('freeThrowsMade-freeThrowsAttempted'))
            vals = [f"'{pid}-g{game['id']}'", f"'{pid}'", str(season_num), str(stype),
                    'NULL' if rnd is None else str(rnd), f"'{sync.esc(game['id'])}'",
                    f"'{game['date']}'", f"'{sync.esc(me['code'])}'", f"'{sync.esc(opp['code'])}'",
                    str(me['home']), str(me['winner']), str(me['score']), str(opp['score']),
                    str(p['starter']), str(parse_int(v.get('minutes'))),
                    str(parse_int(v.get('points'))), str(parse_int(v.get('rebounds'))),
                    str(parse_int(v.get('offensiveRebounds'))), str(parse_int(v.get('defensiveRebounds'))),
                    str(parse_int(v.get('assists'))), str(parse_int(v.get('steals'))),
                    str(parse_int(v.get('blocks'))), str(parse_int(v.get('turnovers'))),
                    str(parse_int(v.get('fouls'))), str(fgm), str(fga), str(tpm), str(tpa),
                    str(ftm), str(fta),
                    'NULL' if v.get('plusMinus') is None else str(parse_int(v.get('plusMinus')))]
            out.append(f"INSERT INTO {TABLE} ({COLS}) VALUES ({', '.join(vals)});")
    return out


def known_players():
    res = subprocess.run(sync.mysql_cmd(),
                         input=b"SELECT PLAYER_ID FROM dream_player WHERE PLAYER_ID LIKE 'nba-%';",
                         capture_output=True)
    return set(res.stdout.decode().split()[1:])


def load_season(year, stype, type_name, dry):
    season_num = year - SEASON_BASE
    ids = event_ids(year, stype)
    print(f'{year} {type_name}: {len(ids)} games')

    t0 = time.time()
    games = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for g in ex.map(fetch_game, ids):
            if g:
                games.append(g)
    print(f'  fetched {len(games)} box scores in {time.time() - t0:.0f}s')

    rounds = {}
    if stype == TYPE_NUM['po']:
        rounds, dropped = playoff_rounds(year, games)
        dist = {}
        for r in rounds.values():
            dist[r] = dist.get(r, 0) + 1
        print(f'  round distribution: {dict(sorted(dist.items()))}  (dropped {dropped} non-series games)')
        if sorted(dist) not in ([1, 2, 3, 4], [2, 3, 4], [1, 2, 3], []):
            print(f'  !! unexpected rounds {sorted(dist)} — check this season')
        # a game that survived must have a round; anything else is not playoff data
        games = [g for g in games if g['id'] in rounds]

    known = known_players()
    stmts = []
    for g in games:
        stmts += rows_of(g, season_num, stype, rounds.get(g['id']), known)
    print(f'  rows: {len(stmts)}')
    if not stmts:
        return

    sql = ('START TRANSACTION;\n'
           f"DELETE FROM {TABLE} WHERE SEASON_NUM={season_num} AND SEASON_TYPE={stype};\n"
           + '\n'.join(stmts) + '\nCOMMIT;\n')
    out = Path(__file__).parent / f'game_logs_{year}_{type_name}.sql'
    out.write_text(sql)
    print(f'  SQL: {out.name} ({len(sql) // 1024} KB)')
    if dry:
        return
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:800])
    print('  applied.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', required=True,
                    help='ESPN year (2026 = 2025-26) or a range like 1993-2026')
    ap.add_argument('--type', choices=('reg', 'po'), default='po')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    if '-' in a.season:
        lo, hi = (int(x) for x in a.season.split('-'))
        years = list(range(lo, hi + 1))
    else:
        years = [int(a.season)]
    # ESPN has schedules further back but its box scores carry no players before 1993
    too_old = [y for y in years if y < FIRST_BOXSCORE_YEAR]
    if too_old:
        print(f'skipping {len(too_old)} season(s) before {FIRST_BOXSCORE_YEAR} '
              f'(ESPN box scores are empty that far back)')
        years = [y for y in years if y >= FIRST_BOXSCORE_YEAR]

    for y in years:
        try:
            load_season(y, TYPE_NUM[a.type], a.type, a.dry_run)
        except Exception as e:
            print(f'{y}: FAILED {e}', flush=True)


if __name__ == '__main__':
    main()
