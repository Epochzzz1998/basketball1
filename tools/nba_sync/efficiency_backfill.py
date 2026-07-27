#!/usr/bin/env python3
"""Efficiency metrics from Basketball-Reference into the stat tables.

Two families, deliberately both kept — they answer different questions:
  ORtg / DRtg / Net   points produced & allowed per 100 possessions (absolute)
  BPM / OBPM / DBPM   points per 100 possessions ABOVE LEAGUE AVERAGE (relative)

B-R publishes ORtg/DRtg as whole numbers, so net rating is integer-valued and ties
are common; BPM comes with one decimal and separates players much more finely.

PLAYER_OFF_EFF / PLAYER_DEF_EFF / PLAYER_NET_EFF have existed since the original
schema and were never filled — ESPN's byathlete feed carries none of them. B-R
publishes ORtg and DRtg (points produced / allowed per 100 possessions) on the
season per-possession page, one request per season:

    /leagues/NBA_<year>_per_poss.html      -> off_rtg / def_rtg
    /leagues/NBA_<year>_advanced.html      -> PER / TS% / USG% / 各类 % / WS 系列 / BPM / VORP
    /playoffs/NBA_<year>_...               -> same shapes for the playoffs

Net rating is stored as ORtg − DRtg (the standard definition), not B-R's on-off
'plus_minus_net' from the play-by-play page — that is a different measurement and
mixing the two under one label would mislead.

Coverage: ORtg/DRtg start at 1978 (1976-77 predates league-wide turnover and
offensive-rebound tracking, so B-R leaves them blank); BPM reaches 1977.

Usage:
  python3 efficiency_backfill.py --seasons 1978-2026            # regular season
  python3 efficiency_backfill.py --seasons 1978-2026 --playoffs
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

BASE = 'https://www.basketball-reference.com'
SEASON_BASE = 1976
# B-R 的 advanced 页最早到 1952（PER / TS% / WS 系列都有）。1977 这个下限当初是照着
# ORtg/DRtg 设的，结果把更早年份能拿到的 PER 和 WS 一起挡在门外。逐列判空本来就有，
# 拿不到的列（BPM/VORP/USG% 要失误数，1974 前没有）自然留 NULL。
FIRST_YEAR = 1952
DELAY = 3.5

# advanced 页一次请求就能拿到的全部进阶指标 → 库内列名。
# PLAYER_PER 存的是同步工具自算的经典 EFF（得分+板+助+断+帽−打铁−失误），不是 PER，
# 所以真实 PER 单独放 PLAYER_PER_REAL，两者并存：EFF 全 50 季都有，PER 只到 B-R 的覆盖范围。
ADV_MAP = [
    ('per', 'PLAYER_PER_REAL'), ('ts_pct', 'PLAYER_TS_PCT'), ('usg_pct', 'PLAYER_USG_PCT'),
    ('orb_pct', 'PLAYER_ORB_PCT'), ('drb_pct', 'PLAYER_DRB_PCT'), ('trb_pct', 'PLAYER_TRB_PCT'),
    ('ast_pct', 'PLAYER_AST_PCT'), ('stl_pct', 'PLAYER_STL_PCT'), ('blk_pct', 'PLAYER_BLK_PCT'),
    ('tov_pct', 'PLAYER_TOV_PCT'),
    ('ows', 'PLAYER_OWS'), ('dws', 'PLAYER_DWS'), ('ws', 'PLAYER_WS'), ('ws_per_48', 'PLAYER_WS48'),
    ('obpm', 'PLAYER_OBPM'), ('dbpm', 'PLAYER_DBPM'), ('bpm', 'PLAYER_BPM'), ('vorp', 'PLAYER_VORP'),
]
ADV_KEYS = tuple(k for k, _ in ADV_MAP)


def fetch_table(year, playoffs, page, keys):
    """{norm_name: (values...)} from a B-R season table; multi-team players resolve to
    their combined row (the one with the most games)."""
    url = (f'{BASE}/playoffs/NBA_{year}_{page}.html' if playoffs
           else f'{BASE}/leagues/NBA_{year}_{page}.html')
    html = urllib.request.urlopen(urllib.request.Request(url, headers=sync.UA),
                                  timeout=30).read().decode('utf-8', 'replace')
    # B-R 把次要表格藏在 HTML 注释里，表 id 也各页不同（赛季页 advanced / 季后赛页
    # advanced_stats）。所以别按 id 找、更别取「页面第一个 tbody」——那会抓到一个空表，
    # 而且因为返回空 dict 连报错都没有。改成：找表头里真的含目标列的那张表。
    html = html.replace('<!--', '').replace('-->', '')
    body = None
    for m in re.finditer(r'<table[^>]*>.*?</table>', html, re.S):
        block = m.group(0)
        # 在整张表里找，不能只看 thead：季后赛页的表头单元格用全称标签、不带 data-stat
        if f'data-stat="{keys[0]}"' not in block:
            continue
        # 季后赛页的 <tbody> 只有开标签没有闭标签（实测 </tbody> 出现 0 次），
        # 所以不能用 <tbody>...</tbody> 配对，取开标签之后到表尾即可
        m2 = re.search(r'<tbody>(.*)', block, re.S)
        if m2:
            body = m2
            break
    if not body:
        raise RuntimeError(f'no table carrying {keys[0]} at {url}')
    out = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', body.group(1), re.S):
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        raw = cells.get('name_display') or cells.get('player') or ''
        a = re.search(r'href="/players/[a-z]/[a-z0-9]+\.html"[^>]*>([^<]+)</a>', raw)
        if not a:
            continue

        def val(key):
            v = re.sub(r'<[^>]*>', '', cells.get(key) or '').strip()
            try:
                return float(v)
            except ValueError:
                return None

        vals = [val(k) for k in keys]
        # 老赛季有些指标 B-R 算不出（列留空）：整行不能因为一列空就丢掉，
        # 缺的那几列写 NULL 即可
        if all(v is None for v in vals):
            continue
        g = val('games') or 0
        key = norm(a.group(1))
        # 一名球员被交易时有多行（各队一行 + 合计行）；合计行场次最多，取它
        if key not in out or g > out[key][-1]:
            out[key] = (*vals, g)
    return {k: v[:-1] for k, v in out.items()}


def db_rows(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    return [l.split('\t') for l in res.stdout.decode('utf-8').splitlines()[1:]]


def run_sql(sql, label):
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:600])
    print(f'  {label}: applied')


def do_season(year, playoffs):
    table = 'player_playoff_stats' if playoffs else 'player_stats'
    season_num = year - SEASON_BASE
    time.sleep(DELAY)
    try:
        ratings = fetch_table(year, playoffs, 'per_poss', ('off_rtg', 'def_rtg'))
    except Exception as e:
        print(f'{year}: per_poss FAILED {e}')
        ratings = {}
    time.sleep(DELAY)
    try:
        bpms = fetch_table(year, playoffs, 'advanced', ADV_KEYS)
    except Exception as e:
        print(f'{year}: advanced FAILED {e}')
        bpms = {}
    if not ratings and not bpms:
        print(f'{year} ({"po" if playoffs else "reg"}): 两张表都没取到，跳过', flush=True)
        return
    q = (f"SELECT s.PLAYER_ID, COALESCE(p.NAME_EN, p.PLAYER_NAME) FROM {table} s "
         f"JOIN dream_player p ON p.PLAYER_ID = s.PLAYER_ID WHERE s.SEASON_NUM = {season_num};")
    stmts, miss = [], 0
    for pid, name in db_rows(q):
        k1, k2 = norm(name), strip_suffix(norm(name))
        rt = ratings.get(k1) or ratings.get(k2)
        bp = bpms.get(k1) or bpms.get(k2)
        if not rt and not bp:
            miss += 1
            continue
        sets = []
        # 老赛季可能只有其中一项（1977 的 ORtg 整列为空），逐列判空，别让一个 None 炸掉整轮
        if rt:
            o, d = rt
            if o is not None:
                sets.append(f"PLAYER_OFF_EFF={sync.num(o)}")
            if d is not None:
                sets.append(f"PLAYER_DEF_EFF={sync.num(d)}")
            if o is not None and d is not None:
                sets.append(f"PLAYER_NET_EFF={sync.num(o - d)}")
        if bp:
            for (_, col), v in zip(ADV_MAP, bp):
                if v is not None:
                    sets += [f"{col}={sync.num(v)}"]
        if not sets:
            miss += 1
            continue
        stmts.append(f"UPDATE {table} SET {', '.join(sets)} "
                     f"WHERE PLAYER_ID='{sync.esc(pid)}' AND SEASON_NUM={season_num};")
    print(f'{year} ({"po" if playoffs else "reg"} season {season_num}): {len(stmts)} matched, {miss} unmatched')
    if stmts:
        run_sql('START TRANSACTION;\n' + '\n'.join(stmts) + '\nCOMMIT;\n', str(year))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seasons', required=True, help='e.g. 1978-2026')
    ap.add_argument('--playoffs', action='store_true')
    a = ap.parse_args()
    if '-' in a.seasons:
        lo, hi = (int(x) for x in a.seasons.split('-'))
        years = list(range(lo, hi + 1))
    else:
        years = [int(a.seasons)]
    skipped = [y for y in years if y < FIRST_YEAR]
    if skipped:
        print(f'skipping {skipped} — B-R has no ratings before {FIRST_YEAR}')
    for y in years:
        if y < FIRST_YEAR:
            continue
        try:
            do_season(y, a.playoffs)
        except Exception as e:
            # 一季出问题不该带走后面 49 季
            print(f'{y}: FAILED {type(e).__name__} {e}', flush=True)


if __name__ == '__main__':
    main()
