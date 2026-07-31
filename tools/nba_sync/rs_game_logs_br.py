#!/usr/bin/env python3
"""Per-game REGULAR SEASON box scores from Basketball-Reference into player_game_stats.

Same source and same parser as the playoff crawl (po_game_logs_br.py) — B-R box score
pages are identical in shape for both, so parse_box_table is imported rather than copied.
What differs is only how games are enumerated:

  playoffs : series page  -> its box-score links
  regular  : /leagues/{LG}_{year}_games.html  -> month sub-pages -> their box-score links

Three phases, each resumable, because the box crawl is ~68,000 requests / ~66 hours:

  --index   one JSON per season listing every regular-season game (~9 requests/season).
            **Playoff games are removed here**, not later: the month pages for April/May/June
            carry playoff games too, and their ids collide exactly with the playoff dataset
            (verified: April 2025 has 149 games, 38 of them playoffs). The exclusion set is
            the cached playoff ids when we have them (1977+), otherwise /playoffs/{LG}_{year}.

  --scrape  the box scores. Writes **JSON Lines, appended per game**, so a crash or a Ctrl-C
            costs one game, not one season (a season is ~1230 games ≈ 72 minutes).
            Re-running skips ids already on disk.

  --build   resolves identity and writes SQL **per season**, then applies it. Not one file:
            1.5M single-row INSERTs would be a ~380MB script.

Identity: (season, team) -> name -> player id, built from player_stats. Traded seasons are
stored there as 'HOU->BKN', so the chain is split and the player is registered under every
team he appeared for — otherwise every traded player's games go unresolved. B-R slug is the
fallback, via br_ids_cache.json.

Era notes that are data, not bugs: no 3P columns before 1980 (the line did not exist), no
plus-minus before 1997, no ORB/DRB split before 1974, no steals/blocks/turnovers before 1974.
All stored NULL.

Usage:
  python3 rs_game_logs_br.py --index  --seasons 1977-2026     # ~45 min, resumable
  python3 rs_game_logs_br.py --scrape --seasons 2026          # one season, ~72 min
  python3 rs_game_logs_br.py --scrape --seasons 1977-2026 --newest-first
  python3 rs_game_logs_br.py --build  --seasons 2026 --dry-run
  python3 rs_game_logs_br.py --status                         # how far along the crawl is
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
from br_backfill import BR2CODE, initial_key, key, strip_suffix
from po_game_logs_br import (absence_stmts, absence_tuples, fetch_html, game_ambiguity,
                            league_wide_names,
                            parse_absences, parse_box_table, parse_line_score, resolve_pid,
                            GAMES_CACHE as PO_GAMES_CACHE)

HERE = Path(__file__).parent
INDEX_CACHE = HERE / 'rs_index_cache'
GAMES_CACHE = HERE / 'rs_games_cache'
IDS_CACHE = HERE / 'br_ids_cache.json'
BASE = 'https://www.basketball-reference.com'
# 3.5 秒（≈17 次/分）是季后赛那 85 场验证过的速度，但常规赛连着两次都在第 100 场
# 左右开始连续 429。两次都是在**前面已经把它惹毛**的情况下开跑的，所以未必是 3.5
# 本身不行；不过一趟要跑 1230 场，中途被封的代价是整轮重来，宁可慢一点。
# 5 秒 ≈ 12 次/分。
DELAY = 5.0
SEASON_BASE = 1976
TABLE = 'player_game_stats'
REGULAR_TYPE = 2
MONTHS = ('october', 'november', 'december', 'january', 'february',
          'march', 'april', 'may', 'june', 'july', 'august', 'september')
# The mid-season tournament, under both names B-R has used for it
CUP_RE = re.compile(r'NBA Cup|In-Season Tournament', re.I)


def league(year):
    """1947-1949 were the BAA; B-R keeps them under a different URL prefix."""
    return 'BAA' if year <= 1949 else 'NBA'


def box_ids(page):
    return re.findall(r'href="/boxscores/(\d{8})0([A-Z]{3})\.html"', page)


def scheduled_games(page):
    """Rows of the schedule table -> [(game_id, remark)].

    Parsed row by row rather than by harvesting hrefs, because the only thing separating a
    real regular-season game from a play-in game or the NBA Cup final is the `game_remarks`
    cell. Those two count toward neither regular-season nor playoff totals, so letting them
    in would make a player's game logs disagree with his season averages in player_stats
    (2025-26 alone: 6 play-in games + 1 Cup final = 1237 instead of 1230)."""
    out = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', page, re.S):
        m = re.search(r'href="/boxscores/(\d{8}0[A-Z]{3})\.html"', tr)
        if not m:
            continue
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        remark = re.sub(r'<[^>]*>', '', cells.get('game_remarks') or '').strip()
        out.append((m.group(1), remark))
    return out


# ─────────────────────────────────────────── phase 1: enumerate games

def playoff_ids(year):
    """Game ids to exclude. Prefer the already-cached playoff crawl (no request at all);
    fall back to the season's playoff summary page for the pre-1977 seasons it never covered."""
    cached = PO_GAMES_CACHE / f'{year}.json'
    if cached.exists():
        return {g['id'] for g in json.loads(cached.read_text())['games']}
    time.sleep(DELAY)
    try:
        page = fetch_html(f'{BASE}/playoffs/{league(year)}_{year}.html')
    except Exception as e:
        print(f'  !! {year}: playoff page failed ({e}) — cannot exclude playoff games', flush=True)
        return None
    return {f'{d}0{h}' for d, h in box_ids(page)}


def index_season(year, force=False):
    INDEX_CACHE.mkdir(exist_ok=True)
    out = INDEX_CACHE / f'{year}.json'
    if out.exists() and not force:
        return json.loads(out.read_text())

    time.sleep(DELAY)
    root = f'{BASE}/leagues/{league(year)}_{year}_games.html'
    page = fetch_html(root)
    # The index page itself already carries the first month; the rest are sub-pages.
    found = dict(scheduled_games(page))
    months = [m for m in MONTHS if f'games-{m}.html' in page]
    for m in months:
        time.sleep(DELAY)
        try:
            sub = fetch_html(f'{BASE}/leagues/{league(year)}_{year}_games-{m}.html')
        except Exception as e:
            print(f'  !! {year} {m}: {e}', flush=True)
            continue
        found.update(scheduled_games(sub))

    po = playoff_ids(year)
    if po is None:
        raise RuntimeError(f'{year}: refusing to index without a playoff exclusion set')

    live = sorted((gid, rk) for gid, rk in found.items() if gid not in po)

    # Which remarked games still count toward the regular season:
    #   Play-In Game     — never (it decides seeding, its stats count for neither table)
    #   NBA Cup          — the group stage and knockout rounds DO count; only the **final**
    #                      does not, and B-R gives it the same remark as the rest, so it is
    #                      identified as the chronologically last Cup game of the season.
    #                      (2025-26: 67 Cup games, 66 of them regular season.)
    #                      The 2023-24 season calls the very same thing "In-Season
    #                      Tournament" — matched on both names, or that season lands on 1231.
    #   at <city>        — a neutral-site regular-season game (Mexico City, Paris…). Counts.
    #   anything else    — kept, but printed loudly, so a remark I have not seen is visible
    cup = [gid for gid, rk in live if CUP_RE.search(rk)]
    drop = {cup[-1]} if cup else set()

    games, remarked = [], {}
    for gid, remark in live:
        if remark:
            remarked[remark] = remarked.get(remark, 0) + 1
        if remark == 'Play-In Game' or gid in drop:
            continue
        games.append({'id': gid, 'date': f'{gid[:4]}-{gid[4:6]}-{gid[6:8]}', 'home': gid[9:]})

    # Self-check: home games per team should be near-identical across a league. A stray
    # play-in / final that slipped through shows up as one team with an extra home game.
    home = {}
    for g in games:
        home[g['home']] = home.get(g['home'], 0) + 1
    spread = f'{min(home.values())}-{max(home.values())}' if home else 'n/a'

    data = {'year': year, 'months': months, 'games': games,
            'excluded_playoff': len(found) - len(live),
            'remarks': remarked, 'home_per_team': spread}
    out.write_text(json.dumps(data, ensure_ascii=False))
    unknown = {k: v for k, v in remarked.items()
               if k != 'Play-In Game' and not CUP_RE.search(k) and not k.startswith('at ')}
    print(f'{year}: {len(games)} games | {len(home)} teams, home/team {spread} | '
          f'playoff excl {data["excluded_playoff"]}'
          + (f' | remarks {remarked}' if remarked else '')
          + (f' | !! UNKNOWN REMARK {unknown}' if unknown else ''), flush=True)
    return data


# ─────────────────────────────────────────── phase 2: box scores

def scraped_ids(year):
    f = GAMES_CACHE / f'{year}.jsonl'
    if not f.exists():
        return set()
    done = set()
    for line in f.read_text().splitlines():
        if line.strip():
            try:
                done.add(json.loads(line)['id'])
            except Exception:
                pass                    # a torn last line from a hard kill; it gets re-fetched
    return done


def scrape_season(year):
    idx = INDEX_CACHE / f'{year}.json'
    if not idx.exists():
        print(f'{year}: no index — run --index first', flush=True)
        return
    games = json.loads(idx.read_text())['games']
    GAMES_CACHE.mkdir(exist_ok=True)
    out = GAMES_CACHE / f'{year}.jsonl'
    done = scraped_ids(year)
    todo = [g for g in games if g['id'] not in done]
    if not todo:
        print(f'{year}: complete ({len(done)} games)', flush=True)
        return
    print(f'{year}: {len(todo)} to go ({len(done)}/{len(games)} done, '
          f'~{len(todo) * DELAY / 3600:.1f} h)', flush=True)

    ok = 0
    with out.open('a') as fh:
        for i, g in enumerate(todo, 1):
            time.sleep(DELAY)
            try:
                page = fetch_html(f'{BASE}/boxscores/{g["id"]}.html')
            except Exception as e:
                print(f'    {g["id"]}: FAILED {e}', flush=True)
                continue
            # The two team codes are whatever box tables the page carries; taking them from
            # the page rather than from a schedule column keeps relocations/renames honest.
            codes = re.findall(r'id="box-([A-Z]{3})-game-basic"', page)
            teams = {}
            # Who dressed but never played, plus who was inactive. Same reason the quarter
            # scores are grabbed here: it is on the page already, and coming back for it
            # later means paying for all 68,000 fetches a second time.
            absent = parse_absences(page)
            for code in dict.fromkeys(codes):
                players, total = parse_box_table(page, code)
                if players is not None:
                    teams[code] = {'players': players, 'score': total,
                                   'absent': absent.get(code, [])}
            if len(teams) != 2:
                print(f'    {g["id"]}: parsed {list(teams)}, skipped', flush=True)
                continue
            # Quarter scores come off the same page — grabbing them here rather than in a
            # second pass is the whole reason this is captured now: re-fetching 68,000 box
            # pages later would cost another 66 hours for one extra table.
            fh.write(json.dumps({'id': g['id'], 'date': g['date'], 'home': g['home'],
                                 'teams': teams, 'periods': parse_line_score(page)},
                                ensure_ascii=False) + '\n')
            fh.flush()                  # per game, so a kill costs one request
            ok += 1
            if i % 100 == 0:
                print(f'    {year}: {i}/{len(todo)}', flush=True)
    print(f'{year}: +{ok} games -> {out.name}', flush=True)


# ─────────────────────────────────────────── phase 3: identity + SQL

def db_rows(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode()[:500])
    return [l.split('\t') for l in res.stdout.decode('utf-8').splitlines()[1:]]


def load_rosters():
    """(season_num, team_code) -> {normalised name: player id}.

    PLAYER_TEAM holds 'HOU->BKN' for a traded season, so split the chain and register the
    player under every team — his box scores exist under both."""
    q = ("SELECT s.SEASON_NUM, s.PLAYER_TEAM, s.PLAYER_ID, COALESCE(p.NAME_EN, p.PLAYER_NAME) "
         "FROM player_stats s JOIN dream_player p ON p.PLAYER_ID = s.PLAYER_ID "
         "WHERE s.SEASON_NUM <> 99;")
    roster, loose = {}, {}
    for season, teams, pid, name in db_rows(q):
        k = key(name)
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
                # remember every claimant; an ambiguous initial key is dropped below rather
                # than resolved arbitrarily — a wrong player is worse than an unresolved row
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
CHUNK = 500                              # rows per multi-row INSERT


def build_season(year, roster, slug_ids, dry):
    f = GAMES_CACHE / f'{year}.jsonl'
    if not f.exists():
        return 0, []
    season_num = year - SEASON_BASE
    tuples, unresolved = [], []
    absences, absent_missed = [], []
    # 缺阵名单的全联盟兜底，一季查一次（三道闸见 po_game_logs_br.league_wide_names）
    wide = league_wide_names(season_num)
    for line in f.read_text().splitlines():
        if not line.strip():
            continue
        try:
            g = json.loads(line)
        except Exception:
            continue
        codes = list(g['teams'].keys())
        if len(codes) != 2:
            continue
        for br_code in codes:
            code = BR2CODE.get(br_code, br_code)
            opp_br = [c for c in codes if c != br_code][0]
            opp = BR2CODE.get(opp_br, opp_br)
            me, other = g['teams'][br_code], g['teams'][opp_br]
            home = 1 if br_code == g['home'] else 0
            win = 1 if (me['score'] or 0) > (other['score'] or 0) else 0
            pool = roster.get((season_num, code), {})
            # 见 po_game_logs_br.resolve_pid：同一场里两个同姓同首字母的人，
            # 首字母兜底必须整个关掉，否则没进 player_stats 的那个会被记到队友头上
            dup_names, dup_iks = game_ambiguity(
                [p['name'] for p in me['players']]
                + [a['name'] for a in (me.get('absent') or [])])
            # Who dressed but never played, plus who was inactive. `.get` because the
            # field is newer than the cache: seasons crawled before it existed simply
            # have no 'absent' key, and they stay empty until re-crawled.
            t, miss = absence_tuples(g['id'], code, me.get('absent'), pool, slug_ids, wide,
                                     dup_iks, dup_names)
            absences += t
            absent_missed += [(year, code, nm) for nm in miss]
            # 先全部解析，再查有没有两个人落到同一个 id（见 po_game_logs_br.game_ambiguity）
            pids = [resolve_pid(p['name'], p['slug'], pool, slug_ids, dup_iks, dup_names)
                    for p in me['players']]
            clash = {x for x in pids if x and pids.count(x) > 1}
            for p, pid in zip(me['players'], pids):
                # Same identity chain as the absence list — see resolve_pid().
                if not pid or pid in clash:
                    unresolved.append((year, code, p['name']))
                    continue
                tuples.append(
                    f"('{pid}-g{g['id']}', '{pid}', {season_num}, {REGULAR_TYPE}, NULL, "
                    f"'{sync.esc(g['id'])}', '{g['date']}', '{sync.esc(code)}', '{sync.esc(opp)}', "
                    f"{home}, {win}, {n(me['score'])}, {n(other['score'])}, {p['starter']}, "
                    f"{n(p['mp'])}, {n(p['pts'])}, {n(p['trb'])}, {n(p['orb'])}, {n(p['drb'])}, "
                    f"{n(p['ast'])}, {n(p['stl'])}, {n(p['blk'])}, {n(p['tov'])}, {n(p['pf'])}, "
                    f"{n(p['fg'])}, {n(p['fga'])}, {n(p['fg3'])}, {n(p['fg3a'])}, "
                    f"{n(p['ft'])}, {n(p['fta'])}, {n(p['pm'])})")

    if not tuples:
        return 0, unresolved
    parts = ['START TRANSACTION;',
             f'DELETE FROM {TABLE} WHERE SEASON_TYPE={REGULAR_TYPE} AND SEASON_NUM={season_num};']
    for i in range(0, len(tuples), CHUNK):
        parts.append(f'INSERT INTO {TABLE} ({COLS}) VALUES\n'
                     + ',\n'.join(tuples[i:i + CHUNK]) + ';')
    parts += absence_stmts(absences, CHUNK)
    if absences:
        print(f'   {year}: {len(absences)} absences, {len(absent_missed)} unresolved', flush=True)
    parts.append('COMMIT;')
    sql = '\n'.join(parts) + '\n'
    out = HERE / f'rs_game_logs_{year}.sql'
    out.write_text(sql)
    if not dry:
        p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
        if p.returncode != 0:
            raise RuntimeError(p.stderr.decode()[:800])
    return len(tuples), unresolved


def refresh_plus_minus(seasons):
    """Fill player_stats.PLAYER_AVG_PN from the game logs.

    Plus/minus is the one stat the season-level scrape can never supply: B-R's season
    tables simply do not carry it, only the per-game box scores do (and only from 1997 —
    before that B-R has no plus/minus at all). So this column sat defined-but-empty until
    the game logs arrived, and the frontend hid it for regular-season views.

    Averaged over the games that **have** a value, not over games played: a handful of rows
    come back without plus/minus, and counting those as zero would drag every average
    toward 0. Run after every build so a newly crawled season fills itself in."""
    if not seasons:
        return
    q = (f"UPDATE player_stats s JOIN ("
         f"  SELECT PLAYER_ID, SEASON_NUM, AVG(PLUS_MINUS) pm FROM {TABLE}"
         f"  WHERE SEASON_TYPE={REGULAR_TYPE} AND PLUS_MINUS IS NOT NULL"
         f"    AND SEASON_NUM IN ({','.join(map(str, sorted(seasons)))})"
         f"  GROUP BY PLAYER_ID, SEASON_NUM) x"
         f" ON x.PLAYER_ID = s.PLAYER_ID AND x.SEASON_NUM = s.SEASON_NUM"
         f" SET s.PLAYER_AVG_PN = x.pm;")
    p = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:500])
    print(f'plus/minus refreshed for seasons {sorted(seasons)}')


def build(years, dry):
    roster = load_rosters()
    slug_ids = json.loads(IDS_CACHE.read_text()) if IDS_CACHE.exists() else {}
    total, all_unresolved, done = 0, [], []
    for year in years:
        rows, unresolved = build_season(year, roster, slug_ids, dry)
        if rows:
            print(f'{year}: {rows} rows{"" if dry else " applied"}, '
                  f'{len(unresolved)} unresolved', flush=True)
            done.append(year - SEASON_BASE)
        total += rows
        all_unresolved += unresolved
    if done and not dry:
        refresh_plus_minus(done)
    print(f'\ntotal rows: {total}   unresolved: {len(all_unresolved)}')
    seen = {}
    for y, t, nme in all_unresolved:
        seen[(y, nme)] = seen.get((y, nme), 0) + 1
    for k, v in sorted(seen.items(), key=lambda kv: -kv[1])[:20]:
        print(f'   {k[0]} {k[1]} x{v}')


# ─────────────────────────────────────────── status

def status():
    idx = sorted(int(f.stem) for f in INDEX_CACHE.glob('*.json')) if INDEX_CACHE.exists() else []
    print(f'indexed seasons: {len(idx)}' + (f' ({idx[0]}-{idx[-1]})' if idx else ''))
    want = done = 0
    pending = []
    for y in idx:
        g = len(json.loads((INDEX_CACHE / f'{y}.json').read_text())['games'])
        d = len(scraped_ids(y))
        want += g
        done += d
        if d < g:
            pending.append((y, d, g))
    print(f'box scores: {done}/{want} ({done * 100 // max(want, 1)}%)  '
          f'remaining ≈ {(want - done) * DELAY / 3600:.1f} h')
    for y, d, g in pending[:10]:
        print(f'   {y}: {d}/{g}')
    if len(pending) > 10:
        print(f'   … and {len(pending) - 10} more seasons')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', action='store_true')
    ap.add_argument('--scrape', action='store_true')
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--status', action='store_true')
    ap.add_argument('--seasons', help='e.g. 2026 or 1947-2026')
    ap.add_argument('--newest-first', action='store_true', help='most useful seasons land first')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    if a.status:
        status()
        return
    if a.seasons and '-' in a.seasons:
        lo, hi = (int(x) for x in a.seasons.split('-'))
        years = list(range(lo, hi + 1))
    elif a.seasons:
        years = [int(a.seasons)]
    else:
        years = sorted(int(f.stem) for f in INDEX_CACHE.glob('*.json')) if INDEX_CACHE.exists() else []
    if a.newest_first:
        years = sorted(years, reverse=True)

    if a.index:
        for y in years:
            try:
                index_season(y, a.force)
            except Exception as e:
                print(f'{y}: INDEX FAILED {e}', flush=True)
    if a.scrape:
        for y in years:
            try:
                scrape_season(y)
            except Exception as e:
                print(f'{y}: SCRAPE FAILED {e}', flush=True)
    if a.build:
        build(sorted(years), a.dry_run)
    if not any((a.index, a.scrape, a.build)):
        ap.error('pass --index, --scrape, --build or --status')


if __name__ == '__main__':
    main()
