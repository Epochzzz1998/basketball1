#!/usr/bin/env python3
"""NBA/BAA draft classes from Basketball-Reference into nba_draft.

One page per draft (1947-2026, 80 requests, ~7 minutes) — small enough that both phases
could be one command, but they are split anyway so the parser can be re-run against the
cache without touching B-R again. That matters here more than usual: the old drafts have
several table shapes (territorial picks, missing overall numbers, no college column) and
getting the parser right took a few passes.

  --scrape  fetch every draft page into draft_cache/{year}.html, skipping what is there
  --build   parse the cache -> nba_draft (full replace, it is one small table)
  --status  what is cached

## Why the table stores the career line too

The draft page carries each pick's whole career (years, games, points, WS, BPM, VORP)
in the same HTML we are already downloading. Storing it costs nothing and answers the
question the page is actually for — "how did this class turn out" — without joining
anything. Recomputing it from our own tables would need a player id for every pick,
and old/never-played picks do not have one.

## No PLAYER_ID column

The link to our own data is `BR_SLUG -> nba_career_totals.BR_ID -> PLAYER_ID`, resolved
at query time instead of copied in here. nba_career_totals is where that mapping is
maintained (it covers 1947 onward, 5105 players); duplicating it would mean a second
copy that goes stale the moment somebody backfills the first.

Usage:
  python3 draft_br.py --scrape
  python3 draft_br.py --build --dry-run
  python3 draft_br.py --build
"""

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync
from po_game_logs_br import fetch_html

HERE = Path(__file__).parent
CACHE = HERE / 'draft_cache'
BASE = 'https://www.basketball-reference.com'
DELAY = 5.0
FIRST_YEAR = 1947
LAST_YEAR = 2026
TABLE = 'nba_draft'


def league(year):
    """1947-1949 是 BAA，B-R 的选秀页也跟着换前缀（和 rs_game_logs_br.league 同一件事）"""
    return 'BAA' if year <= 1949 else 'NBA'


def url_of(year):
    return f'{BASE}/draft/{league(year)}_{year}.html'


# ─────────────────────────────────────────── 抓

def scrape(years):
    CACHE.mkdir(exist_ok=True)
    got = failed = 0
    for year in years:
        path = CACHE / f'{year}.html'
        if path.exists() and path.stat().st_size > 5000:
            continue
        time.sleep(DELAY)
        try:
            html = fetch_html(url_of(year))
        except Exception as e:
            print(f'  !! {year}: {e}', flush=True)
            failed += 1
            continue
        path.write_text(html, encoding='utf-8')
        got += 1
        print(f'  {year}: {len(html) // 1024} KB', flush=True)
    print(f'抓到 {got} 年，失败 {failed} 年')


# ─────────────────────────────────────────── 解析

CELL_RE = re.compile(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', re.S)
ROW_RE = re.compile(r'<tr[^>]*>.*?</tr>', re.S)
ROUND_RE = re.compile(r'>Round (\d+)<')
# 引号是**单引号**：同一个页面里球队链接用双引号、球员链接用单引号，
# 只认双引号的话每个人的 slug 都会解析成空
SLUG_RE = re.compile(r'''href=["']/players/[a-z]/([a-z0-9]+)\.html["']''')


def text_of(html):
    """去标签 + 还原实体。B-R 的名字里有 &amp; 和 &#39;"""
    s = re.sub(r'<[^>]+>', '', html)
    for a, b in (('&amp;', '&'), ('&#39;', "'"), ('&quot;', '"'), ('&nbsp;', ' ')):
        s = s.replace(a, b)
    return s.strip()


def to_int(s):
    s = (s or '').strip().replace(',', '')
    return int(s) if re.fullmatch(r'-?\d+', s) else None


def to_num(s):
    s = (s or '').strip()
    return float(s) if re.fullmatch(r'-?\d*\.?\d+', s) else None


def parse_year(year, html):
    """一届选秀 -> [dict]。

    轮次不在数据行里，而是靠 `<tr class="over_header thead">Round N</tr>` 这种分隔行
    切开的，所以必须**按顺序**扫行、边扫边记当前轮次；只挑数据行的话轮次就丢了。

    老年份（尤其 1947-1955）没有总顺位号，只有本轮第几个，pick_overall 是空的。
    这时 PICK_NUM 留空，ROUND_PICK 用本轮计数补上——顺位号缺失是真的没有，
    不是抓漏了，编一个出来会让「1954年状元」这种说法凭空成立。

    **轮次会往回跳**：有属地选秀的年份（1949 最明显）B-R 把属地那几个排在最前面，
    于是行序上的轮次是 1→2→1→2→3……。所以本轮计数按轮各记一个、不清零，
    清零的话第二段的第 1 个会和属地那个撞成同一个键。
    """
    rows = []
    rnd = 1
    seq = {}
    ordinal = 0
    for tr in ROW_RE.findall(html):
        m = ROUND_RE.search(tr)
        if m:
            rnd = int(m.group(1))
            continue
        cells = {k: v for k, v in CELL_RE.findall(tr)}
        if 'player' not in cells:
            continue
        name = text_of(cells['player'])
        if not name or name == 'Player':
            continue
        ordinal += 1
        seq[rnd] = seq.get(rnd, 0) + 1
        # 主键用页面自己的 Rk（一届之内唯一且稳定）；万一缺就退回行序
        rk = to_int(text_of(cells.get('ranker', ''))) or ordinal
        slug = SLUG_RE.search(cells['player'])
        rows.append({
            'year': year,
            'rk': rk,
            'round': rnd,
            'round_pick': seq[rnd],
            'pick': to_int(text_of(cells.get('pick_overall', ''))),
            'team': text_of(cells.get('team_id', '')) or None,
            'name': name,
            'slug': slug.group(1) if slug else None,
            'college': text_of(cells.get('college_name', '')) or None,
            'seasons': to_int(text_of(cells.get('seasons', ''))),
            'g': to_int(text_of(cells.get('g', ''))),
            'pts': to_int(text_of(cells.get('pts', ''))),
            'trb': to_int(text_of(cells.get('trb', ''))),
            'ast': to_int(text_of(cells.get('ast', ''))),
            'ws': to_num(text_of(cells.get('ws', ''))),
            'bpm': to_num(text_of(cells.get('bpm', ''))),
            'vorp': to_num(text_of(cells.get('vorp', ''))),
        })
    return rows


def parse_all(years):
    out = []
    for year in years:
        path = CACHE / f'{year}.html'
        if not path.exists():
            continue
        rows = parse_year(year, path.read_text(encoding='utf-8'))
        if not rows:
            print(f'  !! {year}: 一行都没解析出来')
        out.extend(rows)
    return out


# ─────────────────────────────────────────── 入库

SCHEMA = """
CREATE TABLE IF NOT EXISTS nba_draft (
  DRAFT_ID    varchar(32)  NOT NULL,
  DRAFT_YEAR  smallint     NOT NULL,
  ROUND_NUM   smallint     NOT NULL,
  ROUND_PICK  smallint     NULL COMMENT '本轮第几个',
  PICK_NUM    smallint     NULL COMMENT '总顺位；老年份没有',
  TEAM        varchar(8)   NULL,
  PLAYER_NAME varchar(120) NULL,
  BR_SLUG     varchar(32)  NULL COMMENT '关联 nba_career_totals.BR_ID',
  COLLEGE     varchar(160) NULL,
  SEASONS     smallint     NULL,
  G           int          NULL,
  PTS         int          NULL,
  TRB         int          NULL,
  AST         int          NULL,
  WS          decimal(6,1) NULL,
  BPM         decimal(5,1) NULL,
  VORP        decimal(6,1) NULL,
  PRIMARY KEY (DRAFT_ID),
  KEY idx_year (DRAFT_YEAR, PICK_NUM),
  KEY idx_slug (BR_SLUG)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""


def sql_of(rows):
    def q(v):
        return 'NULL' if v is None else "'" + sync.esc(str(v)) + "'"

    def n(v):
        return 'NULL' if v is None else str(v)

    parts = ['SET NAMES utf8mb4;', SCHEMA, f'DELETE FROM {TABLE};']
    vals = []
    for r in rows:
        # 主键用「年-Rk」：老年份没有总顺位，用总顺位做键会让它们全撞在一起；
        # 而 Rk 是 B-R 自己给这一届从 1 排到底的行号，一届之内一定唯一
        did = f"{r['year']}-{r['rk']}"
        vals.append('(' + ','.join([
            q(did), n(r['year']), n(r['round']), n(r['round_pick']), n(r['pick']),
            q(r['team']), q(r['name']), q(r['slug']), q(r['college']),
            n(r['seasons']), n(r['g']), n(r['pts']), n(r['trb']), n(r['ast']),
            n(r['ws']), n(r['bpm']), n(r['vorp']),
        ]) + ')')
    for i in range(0, len(vals), 500):
        parts.append(
            f'INSERT INTO {TABLE} (DRAFT_ID,DRAFT_YEAR,ROUND_NUM,ROUND_PICK,PICK_NUM,'
            'TEAM,PLAYER_NAME,BR_SLUG,COLLEGE,SEASONS,G,PTS,TRB,AST,WS,BPM,VORP) VALUES\n'
            + ',\n'.join(vals[i:i + 500]) + ';')
    return '\n'.join(parts)


def apply_sql(sql):
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode('utf-8'), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace')[:1200])


# ─────────────────────────────────────────── 入口

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scrape', action='store_true')
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--status', action='store_true')
    ap.add_argument('--years', default=f'{FIRST_YEAR}-{LAST_YEAR}')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    lo, _, hi = a.years.partition('-')
    years = list(range(int(lo), int(hi or lo) + 1))

    if a.status:
        have = sorted(int(p.stem) for p in CACHE.glob('*.html')) if CACHE.exists() else []
        missing = [y for y in years if y not in have]
        print(f'缓存 {len(have)} 年' + (f'，缺 {missing}' if missing else '，齐了'))
        return
    if a.scrape:
        scrape(years)
        return
    if a.build:
        rows = parse_all(years)
        by_year = {}
        for r in rows:
            by_year[r['year']] = by_year.get(r['year'], 0) + 1
        print(f'{len(rows)} 个选秀权，{len(by_year)} 届')
        no_slug = [r for r in rows if not r['slug']]
        print(f'没有 B-R 链接的（多为从未打过 NBA 的）：{len(no_slug)}')
        if a.dry_run:
            for y in sorted(by_year)[:3] + sorted(by_year)[-3:]:
                first = next(r for r in rows if r['year'] == y)
                print(f"  {y}: {by_year[y]} 人，状元 {first['name']} ({first['team']})")
            return
        apply_sql(sql_of(rows))
        print('applied.')
        return
    ap.print_help()


if __name__ == '__main__':
    main()
