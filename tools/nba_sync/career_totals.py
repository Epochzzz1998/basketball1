#!/usr/bin/env python3
"""Career totals for every NBA player ever, from Basketball-Reference season totals.

Why a separate table instead of summing player_stats: our own data starts at 1976-77,
so an all-time rank computed from it would be nonsense — Chamberlain, Russell and West
would be missing entirely and Abdul-Jabbar would only carry half a career. The ranking
pool has to be the whole league history, which means most rows here belong to players
that are NOT in dream_player. They exist purely to make the ranks correct.

One request per season:

    /leagues/NBA_<year>_totals.html   ->  G GS MP FG FGA 3P 3PA FT FTA
                                          ORB DRB TRB AST STL BLK TOV PF PTS TPL_DBL

1947 is the first season B-R publishes (BAA, counted as NBA history). Columns appear
as the league started tracking them — steals/blocks/turnovers/offensive rebounds from
1973-74, three-pointers from 1979-80 — and missing ones sum as 0, which is exactly how
official all-time lists treat them (nobody credits Russell with blocks).

Aggregation is keyed on the B-R slug (jokicni01), never the display name: there are
several distinct players called Mike James, and a name-keyed sum would merge them.

Traded seasons list a combined row (team "2TM"/"3TM") FOLLOWED by one row per team.
Summing every row double-counts — LaVine 2025 would come out as 148 games instead of
74 — so when a combined row exists it is the only one taken.

ABA is excluded (separate /leagues/ABA_*), matching how the NBA counts career records.

Usage:
  python3 career_totals.py --scrape                 # 1947-2026 -> career_totals_cache/
  python3 career_totals.py --build                  # cache -> SQL -> MySQL
  python3 career_totals.py --scrape --seasons 2020-2026
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from br_backfill import norm, strip_suffix
from zh_names import ZH_NAMES

BASE = 'https://www.basketball-reference.com'
FIRST_YEAR = 1947          # BAA 元年，B-R 最早的一季
LAST_YEAR = 2026
DELAY = 3.5                # B-R 限速 20 req/min，留余量
CACHE = Path(__file__).parent / 'career_totals_cache'

# B-R 的 data-stat -> 我们的列名。顺序即建表顺序。
STAT_MAP = [
    ('games', 'G'), ('games_started', 'GS'), ('mp', 'MP'),
    ('fg', 'FG'), ('fga', 'FGA'), ('fg3', 'FG3'), ('fg3a', 'FG3A'),
    ('ft', 'FT'), ('fta', 'FTA'),
    ('orb', 'ORB'), ('drb', 'DRB'), ('trb', 'TRB'),
    ('ast', 'AST'), ('stl', 'STL'), ('blk', 'BLK'), ('tov', 'TOV'),
    ('pf', 'PF'), ('pts', 'PTS'), ('tpl_dbl', 'TPL_DBL'),
]
KEYS = [k for k, _ in STAT_MAP]
COLS = [c for _, c in STAT_MAP]


def fetch_season(year):
    """[{slug, name, team, stats{}}] for one season, combined rows only."""
    # 1947-1949 联盟还叫 BAA，B-R 的 URL 也是 BAA_，用 NBA_ 会 404。这三季算在
    # NBA 历史里（官方承认 BAA 记录），所以要抓，只是路径不同。
    league = 'BAA' if year <= 1949 else 'NBA'
    url = f'{BASE}/leagues/{league}_{year}_totals.html'
    html = urllib.request.urlopen(urllib.request.Request(url, headers=sync.UA),
                                  timeout=30).read().decode('utf-8', 'replace')
    html = html.replace('<!--', '').replace('-->', '')
    table = None
    for m in re.finditer(r'<table[^>]*>.*?</table>', html, re.S):
        if 'data-stat="pts"' in m.group(0):
            table = m.group(0)
            break
    if not table:
        raise RuntimeError(f'no totals table at {url}')

    by_slug = defaultdict(list)
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.S):
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        raw = cells.get('name_display') or cells.get('player') or ''
        a = re.search(r'href="/players/[a-z]/([a-z0-9]+)\.html"[^>]*>([^<]+)</a>', raw)
        if not a:
            continue  # 表头、分隔行、以及没有球员链接的"League Average"行

        def val(key):
            v = re.sub(r'<[^>]*>', '', cells.get(key) or '').strip()
            try:
                return int(float(v))
            except ValueError:
                return None

        by_slug[a.group(1)].append({
            'slug': a.group(1),
            'name': a.group(2).strip(),
            'team': re.sub(r'<[^>]*>', '', cells.get('team_name_abbr') or cells.get('team_id') or '').strip(),
            'stats': {k: val(k) for k in KEYS},
        })

    out = []
    for rows in by_slug.values():
        # 被交易的赛季：合计行（2TM/3TM/4TM）在前，之后是每队一行。有合计就只要合计，
        # 否则场次、得分全部翻倍。
        combined = [r for r in rows if re.fullmatch(r'\d+TM', r['team'] or '')]
        out.append(combined[0] if combined else rows[0])
    return out


def scrape(years):
    CACHE.mkdir(exist_ok=True)
    for y in years:
        f = CACHE / f'{y}.json'
        if f.exists():
            print(f'{y}: cached, skip', flush=True)
            continue
        time.sleep(DELAY)
        try:
            rows = fetch_season(y)
        except Exception as e:
            # 一季失败绝不能带走剩下的——上次高阶回补就是栽在这
            print(f'{y}: FAILED {type(e).__name__} {e}', flush=True)
            continue
        f.write_text(json.dumps(rows, ensure_ascii=False))
        print(f'{y}: {len(rows)} players', flush=True)


# 整表由缓存派生，重建永远是安全的——所以直接删了重来，改列不用手写 ALTER
DDL = """
DROP TABLE IF EXISTS nba_career_totals;
CREATE TABLE nba_career_totals (
  BR_ID       varchar(24)  NOT NULL COMMENT 'Basketball-Reference slug, e.g. jokicni01',
  PLAYER_NAME varchar(120) NOT NULL COMMENT 'B-R display name (English)',
  PLAYER_NAME_ZH varchar(120) NULL   COMMENT '中文名（zh_names.py）；本库有资料卡的以 dream_player 为准',
  PLAYER_ID   varchar(100) NULL     COMMENT 'dream_player.PLAYER_ID when this is one of ours',
  FIRST_YEAR  smallint     NULL,
  LAST_YEAR   smallint     NULL,
  SEASONS     smallint     NULL,
  %s
  PRIMARY KEY (BR_ID),
  KEY idx_player (PLAYER_ID),
  KEY idx_pts (PTS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT 'All-time NBA career totals (1947-, every player) — the ranking pool';
""" % ''.join(f'{c:<11} int NULL,\n  ' for c in COLS)


def db_rows(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    return [l.split('\t') for l in res.stdout.decode('utf-8').splitlines()[1:]]


def run_sql(sql, label):
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:800])
    print(f'  {label}: applied')


def build():
    files = sorted(CACHE.glob('*.json'))
    if not files:
        raise SystemExit('cache is empty — run --scrape first')

    totals = {}
    for f in files:
        year = int(f.stem)
        for r in json.loads(f.read_text()):
            t = totals.setdefault(r['slug'], {
                'name': r['name'], 'first': year, 'last': year, 'seasons': 0,
                **{c: 0 for c in COLS},
            })
            t['name'] = r['name']          # 用最近一季的写法（改名/加后缀以最新为准）
            t['first'] = min(t['first'], year)
            t['last'] = max(t['last'], year)
            t['seasons'] += 1
            for k, c in STAT_MAP:
                v = r['stats'].get(k)
                if v:
                    t[c] += v
    print(f'{len(files)} 季  ->  {len(totals)} 名球员的生涯总数')

    # 挂到我们自己的球员上：B-R 的英文名 -> dream_player。同名的按生涯得分最接近的挑，
    # 这里先用简单规则（名字唯一才挂），冲突的留 NULL，后面看报告再单独处理。
    # 精确名和去后缀名分成两张表，不能混：混在一起时「Gary Payton」和「Gary Payton II」
    # 的去后缀形式都是 garypayton，会让这个键出现两个 pid 而被判为有歧义，结果父子俩
    # 谁也匹配不上。规则是先精确、精确不唯一或没有才退到去后缀。
    exact, loose = {}, {}
    for pid, name_en in db_rows("SELECT PLAYER_ID, NAME_EN FROM dream_player WHERE NAME_EN IS NOT NULL;"):
        exact.setdefault(norm(name_en), []).append(pid)
        loose.setdefault(strip_suffix(norm(name_en)), []).append(pid)

    def match(name):
        for table, key in ((exact, norm(name)), (loose, strip_suffix(norm(name)))):
            cand = table.get(key)
            if cand and len(set(cand)) == 1:
                return cand[0]
        return None

    stmts = [DDL]
    matched = 0
    for slug, t in totals.items():
        pid = match(t['name'])
        if pid:
            matched += 1
        vals = ', '.join(str(t[c]) for c in COLS)
        pid_sql = "'%s'" % sync.esc(pid) if pid else 'NULL'
        # 池子里 1453 人本库没有资料卡（张伯伦那一代），他们的中文名只能来自词典
        zh = ZH_NAMES.get(t['name'])
        zh_sql = "'%s'" % sync.esc(zh) if zh else 'NULL'
        stmts.append(
            f"INSERT INTO nba_career_totals (BR_ID, PLAYER_NAME, PLAYER_NAME_ZH, PLAYER_ID, FIRST_YEAR, LAST_YEAR, SEASONS, {', '.join(COLS)}) "
            f"VALUES ('{sync.esc(slug)}', '{sync.esc(t['name'])}', {zh_sql}, "
            f"{pid_sql}, {t['first']}, {t['last']}, {t['seasons']}, {vals});")
    zh_hit = sum(1 for t in totals.values() if ZH_NAMES.get(t['name']))
    print(f'其中 {matched} 人挂上了我们库里的 PLAYER_ID，{zh_hit} 人有中文名')

    run_sql('START TRANSACTION;\n' + '\n'.join(stmts) + '\nCOMMIT;\n', 'career totals')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scrape', action='store_true')
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--seasons', default=f'{FIRST_YEAR}-{LAST_YEAR}')
    a = ap.parse_args()
    lo, hi = (int(x) for x in a.seasons.split('-')) if '-' in a.seasons else (int(a.seasons),) * 2
    if a.scrape:
        scrape(range(lo, hi + 1))
    if a.build:
        build()
    if not a.scrape and not a.build:
        ap.error('need --scrape and/or --build')


if __name__ == '__main__':
    main()
