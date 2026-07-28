#!/usr/bin/env python3
"""Per-game playoff box scores from Basketball-Reference into player_game_stats.

B-R is the authority for this dataset. ESPN was tried first and is not good enough:
its playoff coverage has real holes that are NOT limited to old seasons (2000 is
missing the entire Finals, 2013 is missing all twelve Bulls games as structurally
present but statistically empty box scores, 2023 is missing one game per first-round
series), its "1993" bucket actually holds 1994 games, and its dates are UTC so evening
games land on the wrong day. B-R has every playoff game of all fifty seasons.

Shape of the crawl, all driven off po_rounds_cache/ which po_round_stats.py wrote:
  series page  ->  its own box-score links (filtered to the two teams' home codes,
                   count checked against the series length)
  box score    ->  both teams' box-<CODE>-game-basic tables, starters = rows before
                   the "Reserves" separator, team score = the tfoot totals row

Two phases so a 4-hour crawl is never repeated: --scrape caches one JSON per season
under po_games_cache/, --build resolves identity and writes SQL offline.

Era notes that are data, not bugs: no three-point columns before 1980 (the line did
not exist) and no plus-minus before 1997 (B-R does not carry it) — both stored NULL.

Usage:
  python3 po_game_logs_br.py --scrape --seasons 1977-2026   # ~4.3 h, resumable
  python3 po_game_logs_br.py --scrape --seasons 2026        # one season
  python3 po_game_logs_br.py --build --dry-run              # SQL + reconciliation
  python3 po_game_logs_br.py --build
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from br_backfill import BR2CODE, initial_key, key, strip_suffix

ROUNDS_CACHE = Path(__file__).parent / 'po_rounds_cache'
GAMES_CACHE = Path(__file__).parent / 'po_games_cache'
IDS_CACHE = Path(__file__).parent / 'br_ids_cache.json'
BASE = 'https://www.basketball-reference.com'
DELAY = 3.5                      # B-R tolerates ~20 req/min
SEASON_BASE = 1976
TABLE = 'player_game_stats'
PLAYOFF_TYPE = 3

STAT_KEYS = ('mp', 'fg', 'fga', 'fg3', 'fg3a', 'ft', 'fta',
             'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pts')


def fetch_html(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=sync.UA)
            return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
        except Exception as e:
            if getattr(e, 'code', None) == 404:
                raise
            if attempt == retries - 1:
                raise
            wait = 90 if getattr(e, 'code', None) == 429 else 10
            print(f'      retry {attempt + 1} in {wait}s ({e})', flush=True)
            time.sleep(wait)


def mmss(v):
    """'45:00' -> 45 (whole minutes, rounded). '' / 'MP' -> None."""
    m = re.match(r'^(\d+):(\d{2})$', str(v).strip())
    if m:
        return int(m.group(1)) + (1 if int(m.group(2)) >= 30 else 0)
    try:
        return int(str(v).strip())
    except ValueError:
        return None


def cell_text(html):
    return re.sub(r'<[^>]*>', '', html or '').strip()


def parse_box_table(page, br_code):
    """-> [{slug, name, starter, mp, pts, ...}] plus the team's total points."""
    m = re.search(rf'<table[^>]*id="box-{br_code}-game-basic".*?</table>', page, re.S)
    if not m:
        return None, None
    table = m.group(0)
    body = re.search(r'<tbody>(.*?)</tbody>', table, re.S)
    if not body:
        return None, None

    players, starter = [], True
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', body.group(1), re.S):
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        raw = cells.get('player') or ''
        a = re.search(r'href="/players/[a-z]/([a-z0-9]+)\.html"[^>]*>([^<]+)</a>', raw)
        if not a:
            # the "Reserves" separator row: everything after it came off the bench
            if 'Reserves' in cell_text(raw):
                starter = False
            continue
        mp = mmss(cells.get('mp'))
        if mp is None:
            continue                        # DNP / inactive rows carry a reason, not minutes
        row = {'slug': a.group(1), 'name': a.group(2).strip(), 'starter': 1 if starter else 0}
        for k in STAT_KEYS:
            if k == 'mp':
                row[k] = mp
                continue
            v = cell_text(cells.get(k))
            row[k] = int(v) if v.lstrip('-').isdigit() else None
        pm = cell_text(cells.get('plus_minus')).replace('+', '')
        row['pm'] = int(pm) if pm.lstrip('-').isdigit() else None
        players.append(row)

    foot = re.search(r'<tfoot>(.*?)</tfoot>', table, re.S)
    total = None
    if foot:
        t = re.search(r'data-stat="pts"[^>]*>(.*?)</t[dh]>', foot.group(1), re.S)
        if t and cell_text(t.group(1)).isdigit():
            total = int(cell_text(t.group(1)))
    return players, total


def parse_line_score(page):
    """-> {team_code: [q1, q2, q3, q4, ot1, ...]} or None.

    B-R serves this table **inside an HTML comment** (it does that for several secondary
    tables), so the comment markers have to be stripped before the table is even visible
    to a regex. Periods are taken as "every column that is not `team` and not `T`", in
    document order, because the column set is not fixed: a regulation game has 1-4, an
    overtime game grows OT / OT1 / OT2… and hardcoding four quarters would silently drop
    the overtime points from the totals."""
    raw = page.replace('<!--', '').replace('-->', '')
    m = re.search(r'<table[^>]*id="line[_-]score".*?</table>', raw, re.S)
    if not m:
        return None
    out = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(0), re.S):
        cells = re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S)
        row = [(k, cell_text(v)) for k, v in cells]
        if not row or row[0][0] != 'team':
            continue
        team = row[0][1]
        if not re.fullmatch(r'[A-Z]{3}', team):     # the header row's blank team cell
            continue
        periods = [v for k, v in row[1:] if k != 'T']
        out[team] = [int(v) if v.lstrip('-').isdigit() else None for v in periods]
    return out or None


def series_box_links(slug, br_codes, expect):
    """Box-score links belonging to THIS series. The page also links other series, so
    filter by home code (a box URL ends with the home team's code) — every game of a
    series is hosted by one of its two teams."""
    page = fetch_html(f'{BASE}/playoffs/{slug}.html')
    pat = re.compile(r'href="(/boxscores/(\d{8})0(' + '|'.join(br_codes) + r')\.html)"')
    seen = {}
    for href, date, home in pat.findall(page):
        seen[href] = (date, home)
    links = sorted(seen.items(), key=lambda kv: kv[1][0])
    if expect and len(links) != expect:
        print(f'    !! {slug}: {len(links)} box links, series length {expect}')
    return links


def scrape_season(year, force=False):
    GAMES_CACHE.mkdir(exist_ok=True)
    out_file = GAMES_CACHE / f'{year}.json'
    if out_file.exists() and not force:
        print(f'{year}: cached, skip', flush=True)
        return json.loads(out_file.read_text())

    rounds_file = ROUNDS_CACHE / f'{year}.json'
    if not rounds_file.exists():
        raise RuntimeError(f'{year}: no po_rounds_cache — run po_round_stats.py --scrape first')

    games = []
    for s in json.loads(rounds_file.read_text())['series']:
        br_codes = list(s['teams'].keys())
        length = max((r['g'] for rows in s['teams'].values() for r in rows), default=0)
        time.sleep(DELAY)
        links = series_box_links(s['slug'], br_codes, length)
        for href, (date, home) in links:
            time.sleep(DELAY)
            try:
                page = fetch_html(BASE + href)
            except Exception as e:
                print(f'    {href}: FAILED {e}', flush=True)
                continue
            teams = {}
            for code in br_codes:
                players, total = parse_box_table(page, code)
                if players is None:
                    continue
                teams[code] = {'players': players, 'score': total}
            if len(teams) != 2:
                print(f'    {href}: only {list(teams)} parsed', flush=True)
                continue
            games.append({
                'id': href.rsplit('/', 1)[-1][:-5],       # e.g. 197705220PHI
                'date': f'{date[:4]}-{date[4:6]}-{date[6:]}',
                'round': s['round'],
                'home': home,
                'teams': teams,
            })
        print(f'  R{s["round"]} {"/".join(br_codes)}: {len(links)} games', flush=True)

    data = {'year': year, 'games': games}
    out_file.write_text(json.dumps(data, ensure_ascii=False))
    print(f'{year}: {len(games)} games cached -> {out_file.name}', flush=True)
    return data


# ─────────────────────────────────────────── identity + SQL

def db_rows(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode()[:500])
    return [l.split('\t') for l in res.stdout.decode('utf-8').splitlines()[1:]]


def load_rosters():
    """(season_num, team_code) -> {name key: pid}.

    Two sources unioned, and the second one is not optional: the per-round table is
    "who B-R's series pages list for this team", and those pages **do miss people** —
    Ronald Holland II has four 2026 playoff box scores for Detroit and zero rows there,
    so no amount of name matching could resolve him from that pool alone. The regular
    season roster (player_stats, traded chains split) covers him, and staying scoped to
    one team in one season keeps the pool just as safe."""
    q = ("SELECT SEASON_NUM, PLAYER_TEAM, r.PLAYER_ID, COALESCE(p.NAME_EN, p.PLAYER_NAME) "
         "FROM player_playoff_round_stats r JOIN dream_player p ON p.PLAYER_ID = r.PLAYER_ID "
         "UNION ALL "
         "SELECT s.SEASON_NUM, s.PLAYER_TEAM, s.PLAYER_ID, COALESCE(p.NAME_EN, p.PLAYER_NAME) "
         "FROM player_stats s JOIN dream_player p ON p.PLAYER_ID = s.PLAYER_ID "
         "WHERE s.SEASON_NUM <> 99;")
    roster, loose = {}, {}
    for season, teams, pid, name in db_rows(q):
        k = key(name)
        # player_stats 用 'HOU->BKN' 记交易赛季，拆开后两支球队都注册
        for team in str(teams).split('->'):
            team = team.strip()
            if not team:
                continue
            cell = (int(season), team)
            d = roster.setdefault(cell, {})
            for n in {k, strip_suffix(k)}:
                d.setdefault(n, pid)
            ik = initial_key(strip_suffix(k))
            if ik:
                # 记下所有认领者；同一个 key 有两个人时整条丢掉，不随便挑一个
                loose.setdefault(cell, {}).setdefault(ik, set()).add(pid)
    for cell, keys in loose.items():
        for ik, pids in keys.items():
            if len(pids) == 1:
                roster[cell].setdefault(ik, next(iter(pids)))
    return roster


COLS = ('GAME_STAT_ID, PLAYER_ID, SEASON_NUM, SEASON_TYPE, ROUND, GAME_ID, GAME_DATE, '
        'PLAYER_TEAM, OPP_TEAM, HOME, WIN, TEAM_SCORE, OPP_SCORE, STARTER, PLAYING_TIME, '
        'PTS, REB, OFF_REB, DEF_REB, AST, STL, BLK, TOV, PF, FGM, FGA, TPM, TPA, FTM, FTA, PLUS_MINUS')

n = lambda v: 'NULL' if v is None else str(v)


def build(years, dry):
    roster = load_rosters()
    slug_ids = json.loads(IDS_CACHE.read_text()) if IDS_CACHE.exists() else {}

    stmts, unresolved, seasons_done = [], [], []
    for year in years:
        f = GAMES_CACHE / f'{year}.json'
        if not f.exists():
            continue
        season_num = year - SEASON_BASE
        seasons_done.append(season_num)
        for g in json.loads(f.read_text())['games']:
            codes = list(g['teams'].keys())
            for br_code in codes:
                code = BR2CODE.get(br_code, br_code)
                opp_br = [c for c in codes if c != br_code][0]
                opp = BR2CODE.get(opp_br, opp_br)
                me, other = g['teams'][br_code], g['teams'][opp_br]
                home = 1 if br_code == g['home'] else 0
                win = 1 if (me['score'] or 0) > (other['score'] or 0) else 0
                pool = roster.get((season_num, code), {})
                for p in me['players']:
                    # 全名 -> 去后缀 -> B-R slug -> 首字母+姓（最后一步只在单队单季的池子里用）
                    k = key(p['name'])
                    pid = pool.get(k) or pool.get(strip_suffix(k)) or slug_ids.get(p['slug'])
                    if not pid:
                        ik = initial_key(strip_suffix(k))
                        pid = pool.get(ik) if ik else None
                    if not pid:
                        unresolved.append((year, code, p['name']))
                        continue
                    vals = [f"'{pid}-g{g['id']}'", f"'{pid}'", str(season_num), str(PLAYOFF_TYPE),
                            str(g['round']), f"'{sync.esc(g['id'])}'", f"'{g['date']}'",
                            f"'{sync.esc(code)}'", f"'{sync.esc(opp)}'", str(home), str(win),
                            n(me['score']), n(other['score']), str(p['starter']), n(p['mp']),
                            n(p['pts']), n(p['trb']), n(p['orb']), n(p['drb']), n(p['ast']),
                            n(p['stl']), n(p['blk']), n(p['tov']), n(p['pf']),
                            n(p['fg']), n(p['fga']), n(p['fg3']), n(p['fg3a']),
                            n(p['ft']), n(p['fta']), n(p['pm'])]
                    stmts.append(f"INSERT INTO {TABLE} ({COLS}) VALUES ({', '.join(vals)});")

    print(f'rows: {len(stmts)}   seasons: {len(seasons_done)}   unresolved: {len(unresolved)}')
    for u in unresolved[:15]:
        print('   ', u)
    if not stmts:
        return
    sql = ('START TRANSACTION;\n'
           + f"DELETE FROM {TABLE} WHERE SEASON_TYPE={PLAYOFF_TYPE} "
             f"AND SEASON_NUM IN ({','.join(map(str, sorted(seasons_done)))});\n"
           + '\n'.join(stmts) + '\nCOMMIT;\n')
    out = Path(__file__).parent / 'po_game_logs_br.sql'
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
    ap.add_argument('--seasons', help='e.g. 2026 or 1977-2026 (default: all cached)')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    if a.seasons and '-' in a.seasons:
        lo, hi = (int(x) for x in a.seasons.split('-'))
        years = list(range(lo, hi + 1))
    elif a.seasons:
        years = [int(a.seasons)]
    else:
        years = sorted(int(f.stem) for f in ROUNDS_CACHE.glob('*.json'))

    if a.scrape:
        for y in years:
            try:
                scrape_season(y, a.force)
            except Exception as e:
                print(f'{y}: FAILED {e}', flush=True)
    if a.build:
        build(years, a.dry_run)
    if not a.scrape and not a.build:
        ap.error('pass --scrape and/or --build')


if __name__ == '__main__':
    main()
