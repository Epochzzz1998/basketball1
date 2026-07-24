#!/usr/bin/env python3
"""Sync real NBA data into the dream DB (manual daily tool).

Source: ESPN public JSON endpoints (stats.nba.com hangs for non-US IPs — probed).
Zero third-party deps: stdlib fetch -> generated SQL -> executed via `docker exec mysql`.

Idempotent by design:
  - players upsert on PLAYER_ID 'nba-<espnId>'; PLAYER_NAME is written on INSERT only,
    so a later hand-translation to Chinese survives every future sync (NAME_EN keeps English)
  - per-season rows are DELETE+INSERT scoped to (this season, PLAYER_ID LIKE 'nba-%')
  - career rows (SEASON_NUM=50) recomputed from all nba-% season rows, games-weighted
  - team_season upserts W/L and points-allowed only — PLAYOFF_RESULT (总冠军 etc) and all
    honor columns / season_award rows are hand-maintained and never touched

Usage:
  python3 sync.py                 # sync current season (ESPN 2026 = 2025-26)
  python3 sync.py --season 2026   # explicit season
  python3 sync.py --dry-run       # write SQL file only, do not execute
"""

import argparse
import concurrent.futures
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'}
BASE_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
BASE_WEB = 'https://site.web.api.espn.com/apis'
# ESPN abbreviation -> the site's canonical 30 team codes (frontend NBA_TEAM_NAMES)
ESPN2CODE = {'GS': 'GSW', 'NO': 'NOP', 'NY': 'NYK', 'SA': 'SAS', 'UTAH': 'UTA', 'WSH': 'WAS'}

def mysql_cmd():
    # password from env DREAM_DB_PWD or the git-ignored .dbpwd file next to this script
    pwd = os.environ.get('DREAM_DB_PWD')
    if not pwd:
        f = Path(__file__).parent / '.dbpwd'
        if f.exists():
            pwd = f.read_text().strip()
    if not pwd:
        sys.exit('missing DB password: set DREAM_DB_PWD or create tools/nba_sync/.dbpwd')
    return ['docker', 'exec', '-i', 'mysql', 'mysql', '-uroot', f'-p{pwd}', '--default-character-set=utf8mb4', 'dream']


def get(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.load(resp)
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f'  retry {attempt + 1} after error: {e}')
            time.sleep(2)


def code_of(espn_abbr):
    return ESPN2CODE.get(espn_abbr, espn_abbr)


def esc(s):
    return str(s).replace('\\', '\\\\').replace("'", "''")


def num(v, digits=3):
    if v is None:
        return 'NULL'
    return str(round(float(v), digits))


def fetch_rosters():
    """athlete identity map espnId -> {name, jersey, pos, dob, team} + team id map code -> espn team id"""
    teams = get(f'{BASE_SITE}/teams')['sports'][0]['leagues'][0]['teams']
    ident = {}
    team_ids = {}
    for t in teams:
        team = t['team']
        code = code_of(team['abbreviation'])
        team_ids[code] = team['id']
        try:
            roster = get(f"{BASE_SITE}/teams/{team['id']}/roster")
        except Exception as e:
            print(f'  roster fail {code}: {e}')
            continue
        for a in roster.get('athletes', []):
            dob = a.get('dateOfBirth') or ''
            ident[str(a['id'])] = {
                'name': a.get('displayName') or '',
                'jersey': a.get('jersey') or '',
                'pos': (a.get('position') or {}).get('abbreviation') or '',
                'dob': dob[:10] if len(dob) >= 10 else None,
                'team': code,
            }
        print(f'  roster {code}: {len(roster.get("athletes", []))}')
        time.sleep(0.3)
    return ident, team_ids


def fetch_athlete_stats(season, seasontype):
    """[{espnId, name, teamCode, stats{...}}] from the byathlete pages"""
    rows = []
    page = 1
    while True:
        d = get(f'{BASE_WEB}/common/v3/sports/basketball/nba/statistics/byathlete'
                f'?region=us&lang=en&contentorigin=espn&limit=50&page={page}'
                f'&season={season}&seasontype={seasontype}&sort=offensive.avgPoints%3Adesc')
        names_by_cat = {c['name']: c.get('names') or [] for c in d.get('categories', [])}
        for a in d.get('athletes', []):
            ath = a['athlete']
            stats = {}
            for cat in a.get('categories', []):
                names = names_by_cat.get(cat['name'], [])
                # only keep each stat's first occurrence (own side)
                for k, v in zip(names, cat.get('values') or []):
                    stats.setdefault(k, v)
            team_abbr = (ath.get('teamShortName') or '').strip()
            rows.append({
                'espnId': str(ath['id']),
                'name': ath.get('displayName') or '',
                'teamCode': code_of(team_abbr) if team_abbr else '',
                'stats': stats,
            })
        pag = d.get('pagination') or {}
        total_pages = -(-int(pag.get('count', 0)) // 50)
        print(f'  byathlete st={seasontype} page {page}/{total_pages} (+{len(d.get("athletes", []))})')
        if page >= total_pages or not d.get('athletes'):
            break
        page += 1
        time.sleep(0.4)
    return rows


def fetch_standings(season):
    """teamCode -> {wins, losses, oppg}"""
    d = get(f'{BASE_WEB}/v2/sports/basketball/nba/standings?region=us&lang=en&season={season}')
    out = {}
    for group in d.get('children', []):
        for e in group.get('standings', {}).get('entries', []):
            stats = {s['name']: s.get('value') for s in e.get('stats', [])}
            out[code_of(e['team']['abbreviation'])] = {
                'wins': int(stats.get('wins') or 0),
                'losses': int(stats.get('losses') or 0),
                'oppg': stats.get('avgPointsAgainst'),
            }
    return out


def fetch_awards(season):
    """season honors from the ESPN core API: winners + All-NBA / All-Defensive teams.
    Full MVP/DPOY vote RANKS (2nd-10th) are not public here — only winners (rank 1)."""
    out = {'mvp': None, 'dpoy': None, 'fmvp': None, 'smoy': None, 'mip': None,
           'all_nba': {}, 'all_def': {}, 'conf_mvps': []}
    try:
        d = get(f'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/{season}/awards?limit=50')
    except Exception as e:
        print(f'  awards unavailable: {e}')
        return out
    import re as _re
    def winner_ids(a):
        ids = []
        for w in a.get('winners', []):
            m = _re.search(r'/athletes/(\d+)', (w.get('athlete') or {}).get('$ref', ''))
            if m:
                ids.append(m.group(1))
        return ids
    name_map = {
        'MVP': ('mvp', False), 'Defensive Player of the Year': ('dpoy', False),
        'Finals MVP': ('fmvp', False), 'Sixth Man of the Year': ('smoy', False),
        'Most Improved Player': ('mip', False),
        'All-NBA 1st Team': ('all_nba', '一阵'), 'All-NBA 2nd Team': ('all_nba', '二阵'),
        'All-NBA 3rd Team': ('all_nba', '三阵'),
        'All-Defensive 1st Team': ('all_def', '一阵'), 'All-Defensive 2nd Team': ('all_def', '二阵'),
        'NBA Eastern Conference Finals MVP': ('conf_mvps', True),
        'NBA Western Conference Finals MVP': ('conf_mvps', True),
    }
    for it in d.get('items', []):
        try:
            a = get(it['$ref'].replace('http://', 'https://'))
        except Exception:
            continue
        key = name_map.get(a.get('name'))
        if not key:
            continue
        field, tier = key
        ids = winner_ids(a)
        if field in ('all_nba', 'all_def'):
            for i in ids:
                out[field][i] = tier
        elif field == 'conf_mvps':
            out['conf_mvps'] += ids
        elif ids:
            out[field] = ids[0]
        time.sleep(0.2)
    print(f"  awards: mvp={out['mvp']} dpoy={out['dpoy']} fmvp={out['fmvp']} "
          f"all-nba={len(out['all_nba'])} all-def={len(out['all_def'])}")
    return out


def fetch_team_pergame(season, seasontype):
    """team own per-game numbers from byteam: code -> {pts, reb, ast, stl, blk, tov, games}"""
    try:
        d = get(f'{BASE_WEB}/common/v3/sports/basketball/nba/statistics/byteam'
                f'?region=us&lang=en&season={season}&seasontype={seasontype}')
    except Exception as e:
        print(f'  byteam st={seasontype} unavailable: {e}')
        return {}
    names_by_cat = {}
    for c in d.get('categories', []):
        if c.get('names'):
            names_by_cat.setdefault(c['name'], c['names'])
    out = {}
    for row in d.get('teams', []):
        code = code_of(row['team']['abbreviation'])
        vals = {}
        for cat in row.get('categories', []):
            names = names_by_cat.get(cat['name'], [])
            for k, v in zip(names, cat.get('values') or []):
                vals.setdefault(k, v)  # first occurrence = own side
        out[code] = {
            'pts': vals.get('avgPoints'), 'reb': vals.get('avgRebounds'), 'ast': vals.get('avgAssists'),
            'stl': vals.get('avgSteals'), 'blk': vals.get('avgBlocks'), 'tov': vals.get('avgTurnovers'),
            'games': int(vals.get('gamesPlayed') or 0),
        }
    return out


def fetch_playoff_results(season, team_ids, po_codes):
    """PLAYOFF_RESULT per team, derived from playoff game wins:
    16 -> 总冠军, 12-15 -> 总决赛, 8-11 -> 分区决赛, 4-7 -> 半决赛, <4 -> 首轮; rest 未进季后赛"""
    out = {code: '未进季后赛' for code in team_ids}
    for code in po_codes:
        tid = team_ids.get(code)
        if not tid:
            continue
        try:
            s = get(f'{BASE_SITE}/teams/{tid}/schedule?season={season}&seasontype=3')
        except Exception as e:
            print(f'  schedule fail {code}: {e}')
            continue
        wins = 0
        for ev in s.get('events', []):
            for c in ev.get('competitions', [{}])[0].get('competitors', []):
                if str(c.get('team', {}).get('id')) == str(tid) and c.get('winner') is True:
                    wins += 1
        out[code] = ('总冠军' if wins >= 16 else '总决赛' if wins >= 12
                     else '分区决赛' if wins >= 8 else '半决赛' if wins >= 4 else '首轮')
        time.sleep(0.2)
    return out


def fetch_athlete_details(season, seasontype, espn_ids):
    """per-athlete core stats (threaded): id -> {gs, oreb, dreb} — the byathlete list
    endpoint lacks games-started and the offensive/defensive rebound split"""
    def one(aid):
        try:
            d = get(f'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/{season}'
                    f'/types/{seasontype}/athletes/{aid}/statistics', retries=2)
            vals = {}
            for cat in d.get('splits', {}).get('categories', []):
                for st in cat.get('stats', []):
                    vals.setdefault(st['name'], st.get('value'))
            return aid, {'gs': vals.get('gamesStarted'),
                         'oreb': vals.get('avgOffensiveRebounds'), 'dreb': vals.get('avgDefensiveRebounds')}
        except Exception:
            return aid, {}
    out = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        done = 0
        for aid, v in ex.map(one, espn_ids):
            out[aid] = v
            done += 1
            if done % 100 == 0:
                print(f'  athlete details {done}/{len(espn_ids)}')
    return out


def fetch_playoff_opp_ppg(season):
    """teamCode -> opponents' playoff PPG (byteam st=3: 2nd occurrence of each category = opponents)"""
    try:
        d = get(f'{BASE_WEB}/common/v3/sports/basketball/nba/statistics/byteam'
                f'?region=us&lang=en&season={season}&seasontype=3')
    except Exception as e:
        print(f'  playoff byteam unavailable: {e}')
        return {}
    names_by_cat = {}
    for c in d.get('categories', []):
        if c.get('names'):
            names_by_cat.setdefault(c['name'], c['names'])
    out = {}
    for row in d.get('teams', []):
        code = code_of(row['team']['abbreviation'])
        seen = set()
        for cat in row.get('categories', []):
            names = names_by_cat.get(cat['name'], [])
            if cat['name'] in seen and cat['name'] == 'offensive':
                vals = dict(zip(names, cat.get('values') or []))
                if vals.get('avgPoints') is not None:
                    out[code] = vals['avgPoints']
            seen.add(cat['name'])
    return out


STAT_COLS = ('STATS_ID, PLAYER_ID, SEASON, SEASON_NUM, PLAYER_TEAM, PLAYER_POSITION, PLAYER_APPEARANCE, '
             'PLAYING_TIME, PLAYER_AVG_SCORE, PLAYER_AVG_REB, PLAYER_AVG_ASS, PLAYER_AVG_STEAL, PLAYER_AVG_BLOCK, '
             'PLAYER_AVG_TURNOVER, PLAYER_AVG_FGM, PLAYER_AVG_FGA, PLAYER_ACCURACY, PLAYER_AVG_TPM, PLAYER_AVG_TPA, '
             'PLAYER_THREE_ACCURACY, PLAYER_AVG_FTM, PLAYER_AVG_FTA, PLAYER_FREETHROW_ACCURACY, PLAYER_PER, '
             'PLAYER_FR_APPEARANCE, PLAYER_SR_APPEARANCE, PLAYER_AVG_OFF_REB, PLAYER_AVG_DEF_REB')


def stat_row_sql(table, season_num, suffix, r, ident, detail):
    s = r['stats']
    gp = s.get('gamesPlayed')
    if not gp:
        return None
    det = detail.get(r['espnId']) or {}
    gs = det.get('gs')
    pid = f"nba-{r['espnId']}"
    pos = ident.get(r['espnId'], {}).get('pos') or ''
    # classic NBA efficiency (EFF) per game — the site's 效率值 column (real PER isn't public)
    eff = ((s.get('avgPoints') or 0) + (s.get('avgRebounds') or 0) + (s.get('avgAssists') or 0)
           + (s.get('avgSteals') or 0) + (s.get('avgBlocks') or 0)
           - ((s.get('avgFieldGoalsAttempted') or 0) - (s.get('avgFieldGoalsMade') or 0))
           - ((s.get('avgFreeThrowsAttempted') or 0) - (s.get('avgFreeThrowsMade') or 0))
           - (s.get('avgTurnovers') or 0))
    pct = lambda k: num(s[k] / 100.0, 4) if s.get(k) is not None else 'NULL'
    vals = [
        f"'{pid}-{suffix}'", f"'{pid}'", str(season_num), str(season_num),
        f"'{esc(r['teamCode'])}'", f"'{esc(pos)}'", str(int(gp)),
        num(s.get('avgMinutes'), 1), num(s.get('avgPoints')), num(s.get('avgRebounds')),
        num(s.get('avgAssists')), num(s.get('avgSteals')), num(s.get('avgBlocks')),
        num(s.get('avgTurnovers')), num(s.get('avgFieldGoalsMade')), num(s.get('avgFieldGoalsAttempted')),
        pct('fieldGoalPct'), num(s.get('avgThreePointFieldGoalsMade')), num(s.get('avgThreePointFieldGoalsAttempted')),
        pct('threePointFieldGoalPct'), num(s.get('avgFreeThrowsMade')), num(s.get('avgFreeThrowsAttempted')),
        pct('freeThrowPct'), num(eff, 1),
        'NULL' if gs is None else str(int(gs)),
        'NULL' if gs is None else str(max(0, int(gp) - int(gs))),
        num(det.get('oreb')), num(det.get('dreb')),
    ]
    return f"INSERT INTO {table} ({STAT_COLS}) VALUES ({', '.join(vals)});"


def career_sql(table):
    """recompute career rows (SEASON_NUM=50) for all nba-% players: games-weighted over their season rows"""
    w = lambda col: f'ROUND(SUM({col}*PLAYER_APPEARANCE)/NULLIF(SUM(PLAYER_APPEARANCE),0),3)'
    ratio = lambda made, att: f'ROUND(SUM({made}*PLAYER_APPEARANCE)/NULLIF(SUM({att}*PLAYER_APPEARANCE),0),4)'
    return (
        f"DELETE FROM {table} WHERE PLAYER_ID LIKE 'nba-%' AND SEASON_NUM=50;\n"
        f"INSERT INTO {table} ({STAT_COLS})\n"
        f"SELECT CONCAT(PLAYER_ID,'-career'), PLAYER_ID, 50, 50, '/', "
        f"SUBSTRING_INDEX(GROUP_CONCAT(PLAYER_POSITION ORDER BY SEASON_NUM DESC),',',1), SUM(PLAYER_APPEARANCE), "
        f"{w('PLAYING_TIME')}, {w('PLAYER_AVG_SCORE')}, {w('PLAYER_AVG_REB')}, {w('PLAYER_AVG_ASS')}, "
        f"{w('PLAYER_AVG_STEAL')}, {w('PLAYER_AVG_BLOCK')}, {w('PLAYER_AVG_TURNOVER')}, "
        f"{w('PLAYER_AVG_FGM')}, {w('PLAYER_AVG_FGA')}, {ratio('PLAYER_AVG_FGM', 'PLAYER_AVG_FGA')}, "
        f"{w('PLAYER_AVG_TPM')}, {w('PLAYER_AVG_TPA')}, {ratio('PLAYER_AVG_TPM', 'PLAYER_AVG_TPA')}, "
        f"{w('PLAYER_AVG_FTM')}, {w('PLAYER_AVG_FTA')}, {ratio('PLAYER_AVG_FTM', 'PLAYER_AVG_FTA')}, "
        f"{w('PLAYER_PER')}, "
        f"SUM(PLAYER_FR_APPEARANCE), SUM(PLAYER_SR_APPEARANCE), "
        f"{w('PLAYER_AVG_OFF_REB')}, {w('PLAYER_AVG_DEF_REB')} "
        f"FROM {table} WHERE PLAYER_ID LIKE 'nba-%' AND SEASON_NUM<>50 GROUP BY PLAYER_ID;"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', type=int, default=2026, help='ESPN season year (2026 = 2025-26 season)')
    ap.add_argument('--dry-run', action='store_true', help='write the SQL file but do not execute it')
    args = ap.parse_args()
    season_num = args.season - 2008  # 2026 -> 18 -> label 2025-2026 (site formula: (2007+n)-(2008+n))
    print(f'== NBA sync: ESPN season {args.season} -> site season_num {season_num} ==')

    print('[1/6] rosters (identity: jersey/position/birthday)')
    ident, team_ids = fetch_rosters()
    print(f'  identities: {len(ident)}')

    print('[2/6] regular-season player averages')
    reg = fetch_athlete_stats(args.season, 2)
    print('[3/6] playoff player averages')
    po = fetch_athlete_stats(args.season, 3)
    print('[4/6] per-athlete details (starters + off/def rebounds, threaded)')
    det_reg = fetch_athlete_details(args.season, 2, [r['espnId'] for r in reg])
    det_po = fetch_athlete_details(args.season, 3, [r['espnId'] for r in po])
    print('[5/6] team stats + standings + playoff rounds + season awards')
    standings = fetch_standings(args.season)
    po_opp = fetch_playoff_opp_ppg(args.season)
    team_reg = fetch_team_pergame(args.season, 2)
    team_po = fetch_team_pergame(args.season, 3)
    po_results = fetch_playoff_results(args.season, team_ids, set(team_po.keys()))
    awards = fetch_awards(args.season)
    # NBA-only filter: keep players on a current NBA roster OR with a real body of NBA work
    # (>=15 games). Drops G-League call-ups / 10-day passersby the league list sweeps in.
    def is_nba(r):
        gp = r['stats'].get('gamesPlayed') or 0
        return r['espnId'] in ident or gp >= 15
    dropped = [r['name'] for r in reg if not is_nba(r)]
    reg = [r for r in reg if is_nba(r)]
    po = [r for r in po if is_nba(r)]
    if dropped:
        print(f'  filtered out {len(dropped)} fringe non-roster players (e.g. {", ".join(dropped[:5])})')
    print(f'  players: reg {len(reg)}, playoffs {len(po)}; teams {len(standings)}, po-teams {len(po_opp)}')
    if len(reg) < 100 or len(standings) < 30:
        sys.exit('ABORT: source data looks incomplete — nothing was written')

    print('[6/6] generating SQL')
    lines = ['SET NAMES utf8mb4;', 'START TRANSACTION;']
    # players upsert: PLAYER_NAME only on insert (hand-translated Chinese must survive)
    seen = set()
    for r in reg + po:
        if r['espnId'] in seen:
            continue
        seen.add(r['espnId'])
        info = ident.get(r['espnId'], {})
        name = info.get('name') or r['name']
        dob = f"'{info['dob']}'" if info.get('dob') else 'NULL'
        lines.append(
            "INSERT INTO dream_player (PLAYER_ID, PLAYER_NAME, PLAYER_NUMBER, PLAYER_BIRTHDAY, NAME_EN, ESPN_ID) "
            f"VALUES ('nba-{r['espnId']}', '{esc(name)}', '{esc(info.get('jersey') or '')}', {dob}, '{esc(name)}', '{r['espnId']}') "
            f"ON DUPLICATE KEY UPDATE PLAYER_NUMBER=VALUES(PLAYER_NUMBER), PLAYER_BIRTHDAY=VALUES(PLAYER_BIRTHDAY), NAME_EN=VALUES(NAME_EN);")
    # season rows: replace this season's nba rows wholesale
    for table, rows, suffix, det in (('player_stats', reg, f's{season_num}', det_reg),
                                     ('player_playoff_stats', po, f'p{season_num}', det_po)):
        lines.append(f"DELETE FROM {table} WHERE PLAYER_ID LIKE 'nba-%' AND SEASON_NUM={season_num};")
        for r in rows:
            sql = stat_row_sql(table, season_num, suffix, r, ident, det)
            if sql:
                lines.append(sql)
        lines.append(career_sql(table))
    # season honors from the awards feed — additive only (hand-filled vote ranks 2-10 survive)
    def upd(setter, espn_id):
        return (f"UPDATE player_stats SET {setter} WHERE PLAYER_ID='nba-{espn_id}' AND SEASON_NUM={season_num};")
    for field, col in (('mvp', 'MVP_RANK=1'), ('dpoy', 'DPOY_RANK=1')):
        if awards.get(field):
            lines.append(upd(col, awards[field]))
    for espn_id, tier in awards['all_nba'].items():
        lines.append(upd(f"ALL_DBA_TEAM='{tier}'", espn_id))
    for espn_id, tier in awards['all_def'].items():
        lines.append(upd(f"ALL_DEF_TEAM='{tier}'", espn_id))
    lines.append(f"DELETE FROM season_award WHERE SEASON_NUM={season_num} AND AWARD IN ('fmvp','smoy','mip');")
    for field in ('fmvp', 'smoy', 'mip'):
        if awards.get(field):
            lines.append("INSERT INTO season_award (SEASON_NUM, AWARD, PLAYER_ID) "
                         f"VALUES ({season_num}, '{field}', 'nba-{awards[field]}');")
    # team_season: real per-game team numbers + W/L + points allowed + derived playoff round
    for code, st in standings.items():
        oppg = num(st['oppg']) if st.get('oppg') is not None else 'NULL'
        po_pa = num(po_opp[code]) if code in po_opp else 'NULL'
        tr = team_reg.get(code) or {}
        tp = team_po.get(code) or {}
        result = po_results.get(code, '未进季后赛')
        lines.append(
            "INSERT INTO team_season (TEAM_CODE, SEASON_NUM, WINS, LOSSES, PTS_ALLOWED, PLAYOFF_PTS_ALLOWED, "
            "PTS, REB, AST, STL, BLK, TOV, PLAYOFF_GAMES, PLAYOFF_PTS, PLAYOFF_REB, PLAYOFF_AST, PLAYOFF_STL, "
            "PLAYOFF_BLK, PLAYOFF_TOV, PLAYOFF_RESULT) "
            f"VALUES ('{esc(code)}', {season_num}, {st['wins']}, {st['losses']}, {oppg}, {po_pa}, "
            f"{num(tr.get('pts'))}, {num(tr.get('reb'))}, {num(tr.get('ast'))}, {num(tr.get('stl'))}, "
            f"{num(tr.get('blk'))}, {num(tr.get('tov'))}, "
            f"{tp.get('games') if tp.get('games') else 'NULL'}, {num(tp.get('pts'))}, {num(tp.get('reb'))}, "
            f"{num(tp.get('ast'))}, {num(tp.get('stl'))}, {num(tp.get('blk'))}, {num(tp.get('tov'))}, "
            f"'{esc(result)}') "
            "ON DUPLICATE KEY UPDATE WINS=VALUES(WINS), LOSSES=VALUES(LOSSES), "
            "PTS_ALLOWED=VALUES(PTS_ALLOWED), PLAYOFF_PTS_ALLOWED=VALUES(PLAYOFF_PTS_ALLOWED), "
            "PTS=VALUES(PTS), REB=VALUES(REB), AST=VALUES(AST), STL=VALUES(STL), BLK=VALUES(BLK), TOV=VALUES(TOV), "
            "PLAYOFF_GAMES=VALUES(PLAYOFF_GAMES), PLAYOFF_PTS=VALUES(PLAYOFF_PTS), PLAYOFF_REB=VALUES(PLAYOFF_REB), "
            "PLAYOFF_AST=VALUES(PLAYOFF_AST), PLAYOFF_STL=VALUES(PLAYOFF_STL), PLAYOFF_TOV=VALUES(PLAYOFF_TOV), "
            "PLAYOFF_BLK=VALUES(PLAYOFF_BLK), PLAYOFF_RESULT=VALUES(PLAYOFF_RESULT);")
    # drop nba players left without any stat rows (filtered out this run or gone from the source)
    lines.append("DELETE p FROM dream_player p WHERE p.PLAYER_ID LIKE 'nba-%' "
                 "AND NOT EXISTS (SELECT 1 FROM player_stats s WHERE s.PLAYER_ID=p.PLAYER_ID) "
                 "AND NOT EXISTS (SELECT 1 FROM player_playoff_stats s2 WHERE s2.PLAYER_ID=p.PLAYER_ID);")
    lines.append('COMMIT;')

    out = Path(__file__).parent / f'nba_sync_{args.season}.sql'
    out.write_text('\n'.join(lines), encoding='utf8')
    print(f'  SQL: {out} ({len(lines)} statements)')
    if args.dry_run:
        print('dry-run: not executed')
        return
    print('executing against dream DB via docker...')
    res = subprocess.run(mysql_cmd(), stdin=out.open('rb'), capture_output=True)
    if res.returncode != 0:
        sys.exit(f'MYSQL ERROR:\n{res.stderr.decode()[:2000]}')
    print(f'DONE: {len(seen)} players, {len(reg)} regular rows, {len(po)} playoff rows, {len(standings)} teams.')


if __name__ == '__main__':
    main()
