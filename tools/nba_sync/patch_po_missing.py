#!/usr/bin/env python3
"""Fetch the playoff box scores that a 429 burst knocked out of the cache.

Why this exists rather than just re-running `--scrape --force`: the playoff scraper
rebuilds a season from scratch and writes the whole file at the end, so re-running it to
recover three games means re-fetching eighty-five — and it was exactly that volume that
tripped B-R's limiter in the first place.

Which games are missing is decided by **the database, not by a hardcoded list**: the box
scores are already in `player_game_stats`, so any GAME_ID present there but absent from
the cache is one the crawler dropped. That makes this safe to re-run at any time; when
nothing is missing it fetches nothing.

Refuses to leave the cache short: `build` deletes the whole season before re-inserting,
so building from an incomplete cache would silently delete the missing games' box scores
from the database. The exit code says whether the cache is now complete.
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from po_game_logs_br import BASE, fetch_html, parse_absences, parse_box_table

YEAR = 2026
SEASON_NUM = YEAR - 1976            # 与 po_game_logs_br.SEASON_BASE 一致
PLAYOFF_TYPE = 3
CACHE = Path(__file__).parent / 'po_games_cache' / f'{YEAR}.json'
DELAY = 6                           # 比常规 3.5s 保守：这是刚被限流过之后的第一批请求


def db_game_ids():
    q = (f"SELECT DISTINCT GAME_ID FROM player_game_stats "
         f"WHERE SEASON_NUM={SEASON_NUM} AND SEASON_TYPE={PLAYOFF_TYPE};")
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode()[:400])
    return {l.strip() for l in res.stdout.decode().splitlines()[1:] if l.strip()}


def main():
    data = json.loads(CACHE.read_text())
    games = data['games']
    have = {g['id'] for g in games}
    missing = sorted(db_game_ids() - have)
    if not missing:
        print(f'{YEAR} 季后赛缓存已完整（{len(have)} 场），无需补漏')
        return 0

    # 轮次从同系列的其它场次抄。这几场是被限流打掉的，系列本身在缓存里，
    # 所以不必再去请求一次系列页——那正是最贵的那种请求
    rounds = {tuple(sorted(g['teams'])): g['round'] for g in games}
    print(f'{YEAR} 季后赛缺 {len(missing)} 场：{missing}')

    added = 0
    for gid in missing:
        time.sleep(DELAY)
        try:
            page = fetch_html(f'{BASE}/boxscores/{gid}.html')
        except Exception as e:
            print(f'  {gid}: 失败 {e}')
            continue
        codes = list(dict.fromkeys(re.findall(r'id="box-([A-Z]{3})-game-basic"', page)))
        absent = parse_absences(page)
        teams = {}
        for c in codes:
            players, total = parse_box_table(page, c)
            if players is not None:
                teams[c] = {'players': players, 'score': total, 'absent': absent.get(c, [])}
        if len(teams) != 2:
            print(f'  {gid}: 只解析出 {list(teams)}，跳过')
            continue
        games.append({
            'id': gid,
            'date': f'{gid[:4]}-{gid[4:6]}-{gid[6:8]}',
            'round': rounds.get(tuple(sorted(teams))),
            'home': gid[9:],
            'teams': teams,
        })
        added += 1
        n = sum(len(t['absent']) for t in teams.values())
        print(f'  {gid}: R{games[-1]["round"]} {"/".join(teams)}  未出场 {n}')

    games.sort(key=lambda g: g['id'])
    CACHE.write_text(json.dumps(data, ensure_ascii=False))
    still = len(db_game_ids() - {g['id'] for g in games})
    print(f'补回 {added} 场，缓存现在 {len(games)} 场，仍缺 {still} 场')
    if still:
        print('!! 缓存仍不完整——不要跑 --build，它会先 DELETE 整个赛季')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
