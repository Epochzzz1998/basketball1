#!/usr/bin/env python3
"""Per-game box scores (game logs) from ESPN into player_game_stats.

ESPN is the right source here, not B-R: its box scores carry the athlete's ESPN id,
which IS our primary key ('nba-<espnId>') — no name matching, no ambiguity. Coverage
starts in 1993; older seasons have schedules but empty player box scores (probed).

Playoff rounds are derived, not fetched: within season type 3 the bracket is always
16 teams / 4 rounds, so grouping games by team pair and ordering each team's series
by start date gives round = 1..4 exactly. Play-in games live in season type 5 and
never enter this table.

Usage:
  python3 game_logs.py --season 2026 --type po           # playoffs (85 games)
  python3 game_logs.py --season 2026 --type reg          # regular season (1239 games)
  python3 game_logs.py --season 2026 --type po --dry-run
"""

import argparse
import concurrent.futures
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync

CORE = 'http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons'
SUMMARY = 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event='
SEASON_BASE = 1976
TABLE = 'player_game_stats'
TYPE_NUM = {'reg': 2, 'po': 3}


def event_ids(year, stype):
    d = sync.get(f'{CORE}/{year}/types/{stype}/events?limit=500')
    return [it['$ref'].rsplit('/', 1)[-1].split('?')[0] for it in d.get('items', [])]


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
        info = meta.get(tid, {})
        teams.append({**info, 'id': tid, 'players': players})
    if len(teams) != 2 or not all(t.get('code') for t in teams):
        return None
    return {'id': eid, 'date': (comp.get('date') or '')[:10], 'teams': teams}


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
                    str(ftm), str(fta), str(parse_int(v.get('plusMinus')))]
            out.append(f"INSERT INTO {TABLE} ({COLS}) VALUES ({', '.join(vals)});")
    return out


def known_players():
    res = subprocess.run(sync.mysql_cmd(),
                         input=b"SELECT PLAYER_ID FROM dream_player WHERE PLAYER_ID LIKE 'nba-%';",
                         capture_output=True)
    return set(res.stdout.decode().split()[1:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', type=int, required=True, help='ESPN year (2026 = 2025-26)')
    ap.add_argument('--type', choices=('reg', 'po'), default='po')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    stype = TYPE_NUM[a.type]
    season_num = a.season - SEASON_BASE
    ids = event_ids(a.season, stype)
    print(f'{a.season} {a.type}: {len(ids)} games')

    t0 = time.time()
    games = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for g in ex.map(fetch_game, ids):
            if g:
                games.append(g)
    print(f'  fetched {len(games)} box scores in {time.time() - t0:.0f}s')

    rounds = derive_rounds(games) if a.type == 'po' else {}
    if a.type == 'po':
        dist = {}
        for gid, r in rounds.items():
            dist[r] = dist.get(r, 0) + 1
        print(f'  round distribution: {dict(sorted(dist.items()))}')

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
    out = Path(__file__).parent / f'game_logs_{a.season}_{a.type}.sql'
    out.write_text(sql)
    print(f'  SQL: {out.name} ({len(sql) // 1024} KB)')
    if a.dry_run:
        return
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:800])
    print('  applied.')


if __name__ == '__main__':
    main()
