#!/usr/bin/env python3
"""Backfill pre-1994 NBA seasons (ESPN's byathlete index starts 1993-94, and its
per-athlete core stats are PATCHY before that — e.g. McHale/Petrović 404).

Row source for these seasons is Basketball-Reference per-game tables (regular +
playoffs, all needed columns incl. GS/ORB/DRB). ESPN is still used for:
  - identity ids (nba-<espnId>) so era-spanning careers stay one player;
    players ESPN never indexed get site-local ids 'nba-br<slug>'
  - team W/L, playoff rounds, season awards (those endpoints reach the 80s)

Usage: python3 br_backfill.py --season 1993 [--dry-run]
Idempotent like sync.py: wholesale per-season DELETE+INSERT with the honors
temp-table stash, career recompute, additive award writes.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync  # reuse: get/esc/num/code_of/code_of_id/fetch_* /career_sql/STAT_COLS/mysql_cmd
import po_rounds_br  # authoritative playoff rounds from B-R series lists

CACHE = Path(__file__).parent / 'br_ids_cache.json'
BR2CODE = {'CHH': 'CHA', 'WSB': 'WAS', 'VAN': 'MEM', 'SEA': 'OKC', 'NJN': 'BKN', 'PHO': 'PHX',
           'NOH': 'NOP', 'NOK': 'NOP', 'BRK': 'BKN', 'CHO': 'CHA',
           # 1976-1986 era franchises (mapped to their modern lines)
           'BUF': 'LAC', 'SDC': 'LAC', 'NOJ': 'UTA', 'KCK': 'SAC', 'NYN': 'BKN',
           # 1947-1975：有现代血脉的历史球队。彻底消失的（芝加哥雄鹿 CHS、华盛顿国会 WSC、
           # 圣路易斯轰炸机 STB…）刻意不映射——没有任何现役球队继承它们，硬塞给谁都是错的
           'PHW': 'GSW', 'SFW': 'GSW', 'MNL': 'LAL', 'SYR': 'PHI', 'ROC': 'SAC', 'CIN': 'SAC', 'KCO': 'SAC', 'TRI': 'ATL', 'MLH': 'ATL', 'STL': 'ATL', 'FTW': 'DET', 'CHP': 'WAS', 'CHZ': 'WAS', 'BAL': 'WAS', 'CAP': 'WAS', 'SDR': 'HOU'}


# NFD 折不掉的拉丁字母。NFD 的原理是把「基字母 + 组合符」拆开再丢掉组合符，
# 而下面这些是**独立码位**，压根没有分解形式，NFD 对它们完全无效。
#
# 这不是理论问题：B-R 写 "Ömer Aşık"，名单里存的是 "Omer Asik"。
# Ö 和 ş 都能折（Ö→O+分音符、ş→s+下加符），**土耳其无点 ı(U+0131) 折不掉**，
# 于是 'omer asık' 永远等不到 'omer asik' —— 2011-2013 三个赛季 230 条数据
# 就卡在这一个字符上，而且不报错，只是静静地变成 unresolved。
UNDECOMPOSABLE = str.maketrans({
    'ı': 'i', 'İ': 'i',              # 土耳其（Ömer Aşık、Ersan İlyasova）
    'ø': 'o', 'Ø': 'o',              # 挪威 / 丹麦
    'đ': 'd', 'Đ': 'd',              # 塞尔维亚 / 克罗地亚（Đorđe）
    'ł': 'l', 'Ł': 'l',              # 波兰
    'ð': 'd', 'Ð': 'd', 'þ': 'th', 'Þ': 'th',   # 冰岛
    'ß': 'ss', 'æ': 'ae', 'Æ': 'ae', 'œ': 'oe', 'Œ': 'oe',
    'ħ': 'h', 'ŧ': 't', 'ŋ': 'n', 'ƶ': 'z',
})


def norm(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.translate(UNDECOMPOSABLE)   # NFD 之后还剩的那批，见上面的说明
    s = s.lower().replace('.', '').replace("'", '').replace('-', ' ').replace('*', '')
    return re.sub(r'\s+', ' ', s).strip()


def league_of(year):
    """1947-1949 联盟叫 BAA，B-R 的 URL 也用 BAA_；官方把 BAA 记录算进 NBA 历史，所以要抓。"""
    return 'BAA' if year <= 1949 else 'NBA'


def fetch_br_standings(year):
    """teamCode -> {wins, losses, ppg, oppg, reb, ast, stl, blk, tov} from the B-R season
    page. ESPN standings come back EMPTY before the mid-80s; B-R has W/L plus full team
    per-game splits in one page (secondary tables are hidden inside HTML comments)."""
    req = urllib.request.Request(
        f'https://www.basketball-reference.com/leagues/{league_of(year)}_{year}.html', headers=sync.UA)
    page = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    page = page.replace('<!--', '').replace('-->', '')
    out = {}
    # 表 id 随年代变：分区制时期是 divs_standings_E / _W，1970 年前是单表
    # divs_standings_（后缀为空）。不写死 id，扫所有 divs_standings 开头的表。
    for m in re.finditer(r'<table[^>]*id="divs_standings[^"]*".*?</table>', page, re.S):
        for br, w, l in re.findall(
                rf'/teams/([A-Z]{{3}})/{year}\.html[^>]*>[^<]+</a>.*?'
                rf'data-stat="wins"[^>]*>(\d+)<.*?data-stat="losses"[^>]*>(\d+)<',
                m.group(0), re.S):
            out[BR2CODE.get(br, br)] = {'wins': int(w), 'losses': int(l)}

    def table_vals(table_id, stat_keys):
        m = re.search(rf'<table[^>]*id="{table_id}".*?</table>', page, re.S)
        res = {}
        if not m:
            return res
        for row in re.findall(r'<tr[^>]*>.*?</tr>', m.group(0), re.S):
            t = re.search(rf'/teams/([A-Z]{{3}})/{year}\.html', row)
            if not t:
                continue
            vals = {}
            for k in stat_keys:
                mm = re.search(rf'data-stat="{k}"[^>]*>([0-9.]+)<', row)
                if mm:
                    vals[k] = float(mm.group(1))
            res[BR2CODE.get(t.group(1), t.group(1))] = vals
        return res

    team_pg = table_vals('per_game-team', ('pts', 'trb', 'ast', 'stl', 'blk', 'tov'))
    opp_pg = table_vals('per_game-opponent', ('opp_pts', 'pts'))
    for code, st in out.items():
        pg = team_pg.get(code, {})
        st['ppg'] = pg.get('pts')
        st['reb'], st['ast'], st['stl'] = pg.get('trb'), pg.get('ast'), pg.get('stl')
        st['blk'], st['tov'] = pg.get('blk'), pg.get('tov')
        opp = opp_pg.get(code, {})
        st['oppg'] = opp.get('opp_pts') or opp.get('pts')
    return out


def strip_suffix(n):
    return re.sub(r'\s+(jr|sr|ii|iii|iv|v)$', '', n)


# Cyrillic / Greek letters that render identically to Latin ones. B-R writes some names in
# native orthography — "Egor Dёmin" carries a **Cyrillic** ё, and NFD-stripping its diaeresis
# leaves a Cyrillic е, invisibly different from Latin e, so the name silently never matches.
HOMOGLYPH = str.maketrans({
    'а': 'a', 'в': 'b', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p',
    'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd',
    'α': 'a', 'ε': 'e', 'ο': 'o', 'ρ': 'p', 'υ': 'u', 'ι': 'i', 'κ': 'k', 'ν': 'v',
})


def key(name):
    """The name form every roster lookup should use: normalised, then homoglyph-folded."""
    return norm(name).translate(HOMOGLYPH)


def initial_key(k):
    """'ronald holland' -> 'r|holland'. Catches the nickname gap (a box score's "Ron Holland"
    vs the roster's "Ronald Holland II") without the false positives a bare surname match
    would give. Only safe inside one team's roster for one season, and only when the key has
    a single claimant — a wrong player is worse than an unresolved row."""
    parts = k.split()
    return f'{parts[0][0]}|{parts[-1]}' if len(parts) >= 2 and parts[0] else None


def fetch_html(url):
    req = urllib.request.Request(url, headers=sync.UA)
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


def parse_br_pergame(url):
    """B-R per-game table -> {norm_name: {name, slug, pos, chain[teams], stats{}}}.
    Multi-stint players: TOT/xTM row wins the stats, stint rows build the team chain."""
    page = fetch_html(url)
    m = re.search(r'<table[^>]*id="per_game_stats"[^>]*>(.*?)</table>', page, re.S)
    if not m:
        return {}
    players = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(1), re.S):
        cells = dict(re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S))
        raw_name = cells.get('player') or cells.get('name_display') or ''
        a = re.search(r'href="/players/[a-z]/([a-z0-9]+)\.html"[^>]*>([^<]+)</a>', raw_name)
        if not a:
            continue
        slug, name = a.group(1), a.group(2).strip()
        team = re.sub(r'<[^>]*>', '', cells.get('team_id') or cells.get('team_name_abbr') or '').strip()

        def fv(*keys):
            for k in keys:
                v = re.sub(r'<[^>]*>', '', cells.get(k) or '').strip()
                if v not in ('', '—'):
                    try:
                        return float(v)
                    except ValueError:
                        pass
            return None

        row = {
            'name': name, 'slug': slug,
            'pos': re.sub(r'<[^>]*>', '', cells.get('pos') or '').split('-')[0].strip(),
            'team': team,
            'gp': fv('g', 'games'), 'gs': fv('gs', 'games_started'), 'mp': fv('mp_per_g'),
            'fg': fv('fg_per_g'), 'fga': fv('fga_per_g'), 'fgp': fv('fg_pct'),
            'tp': fv('fg3_per_g'), 'tpa': fv('fg3a_per_g'), 'tpp': fv('fg3_pct'),
            'ft': fv('ft_per_g'), 'fta': fv('fta_per_g'), 'ftp': fv('ft_pct'),
            'orb': fv('orb_per_g'), 'drb': fv('drb_per_g'), 'trb': fv('trb_per_g'),
            'ast': fv('ast_per_g'), 'stl': fv('stl_per_g'), 'blk': fv('blk_per_g'),
            'tov': fv('tov_per_g'), 'pf': fv('pf_per_g'), 'pts': fv('pts_per_g'),
        }
        if row['gp'] is None:
            continue
        key = slug  # B-R slug is the stable per-person key
        cur = players.get(key)
        total_row = team in ('TOT', '2TM', '3TM', '4TM', '5TM')
        if cur is None:
            players[key] = {**row, 'chain': [] if total_row else [BR2CODE.get(team, team)]}
            if total_row:
                players[key]['team'] = None
        else:
            if total_row:
                for f in ('gp', 'gs', 'mp', 'fg', 'fga', 'fgp', 'tp', 'tpa', 'tpp', 'ft', 'fta', 'ftp',
                          'orb', 'drb', 'trb', 'ast', 'stl', 'blk', 'tov', 'pts'):
                    cur[f] = row[f]
            else:
                code = BR2CODE.get(team, team)
                if code not in cur['chain']:
                    cur['chain'].append(code)
    return players


def search_espn_ids(name):
    q = urllib.parse.quote(norm(name))
    try:
        d = sync.get(f'https://site.web.api.espn.com/apis/search/v2?region=us&lang=en&limit=10&query={q}')
    except Exception:
        return []
    ids = []
    for res in d.get('results', []):
        for c in res.get('contents', []):
            m = re.match(r's:40~l:46~a:(\d+)$', c.get('uid') or '')
            if m:
                ids.append((c.get('displayName') or '', m.group(1)))
    return ids


def core_gp(aid, year):
    try:
        d = sync.get(f'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba'
                     f'/seasons/{year}/types/2/athletes/{aid}/statistics', retries=1)
        for cat in d.get('splits', {}).get('categories', []):
            for s2 in cat.get('stats', []):
                if s2['name'] == 'gamesPlayed':
                    return int(s2.get('value') or 0)
    except Exception:
        return None
    return None


def db_query(q):
    res = subprocess.run(sync.mysql_cmd(), input=q.encode(), capture_output=True)
    return [line.split('\t') for line in res.stdout.decode('utf-8').splitlines()[1:]]


def load_db_names():
    """norm name -> pid, AMBIGUOUS names dropped (two 'Charles Smith's must not merge)"""
    seen = {}
    for pid, name in db_query("SELECT PLAYER_ID, NAME_EN FROM dream_player WHERE PLAYER_ID LIKE 'nba-%';"):
        for key in {norm(name), strip_suffix(norm(name))}:
            seen.setdefault(key, set()).add(pid)
    return {k: next(iter(v)) for k, v in seen.items() if len(v) == 1}


def resolve_ids(players, year, db_names, cache, search_espn=True):
    """slug -> site player id (nba-<espnId> preferred, nba-br<slug> fallback).
    Safety rails against same-name merges: names duplicated within the season skip
    name matching entirely, and any pid may be claimed by only ONE slug per season."""
    name_counts = {}
    for p in players.values():
        name_counts[norm(p['name'])] = name_counts.get(norm(p['name']), 0) + 1
    out = {}
    used = set()
    searched = 0
    for slug, p in players.items():
        pid = cache.get(slug)
        if not pid:
            ambiguous = name_counts[norm(p['name'])] > 1
            if not ambiguous:
                pid = db_names.get(norm(p['name'])) or db_names.get(strip_suffix(norm(p['name'])))
            if not pid and not ambiguous and search_espn:
                hits = search_espn_ids(p['name'])
                searched += 1
                nba_ids = [aid for _, aid in hits]
                if len(set(nba_ids)) == 1:
                    pid = f'nba-{nba_ids[0]}'  # unambiguous search hit
                elif nba_ids:
                    for aid in nba_ids[:5]:  # disambiguate by that season's games when core has them
                        gp = core_gp(aid, year)
                        if gp is not None and abs(gp - (p['gp'] or 0)) <= 1:
                            pid = f'nba-{aid}'
                            break
                        time.sleep(0.1)
                time.sleep(0.2)
        if not pid or pid in used:
            pid = f'nba-br{slug}'  # site-local identity (never merged, slug is per-person)
        used.add(pid)
        out[slug] = pid
        cache[slug] = pid
    print(f'  ids: {len(out)} players ({searched} searched, '
          f'{sum(1 for v in out.values() if v.startswith("nba-br"))} br-local)')
    return out


def stat_row(table, season_num, suffix, pid, p, team):
    pct = lambda v: sync.num(v, 4) if v is not None else 'NULL'
    eff = ((p['pts'] or 0) + (p['trb'] or 0) + (p['ast'] or 0) + (p['stl'] or 0) + (p['blk'] or 0)
           - ((p['fga'] or 0) - (p['fg'] or 0)) - ((p['fta'] or 0) - (p['ft'] or 0)) - (p['tov'] or 0))
    gp = int(p['gp'])
    gs = None if p['gs'] is None else int(p['gs'])
    vals = [
        f"'{pid}-{suffix}'", f"'{pid}'", str(season_num), str(season_num),
        f"'{sync.esc(team)}'", f"'{sync.esc(p['pos'] or '')}'", str(gp),
        sync.num(p['mp'], 1), sync.num(p['pts']), sync.num(p['trb']),
        sync.num(p['ast']), sync.num(p['stl']), sync.num(p['blk']),
        # 犯规：STAT_COLS 在补犯规那一批加了 PLAYER_AVG_PF，这个脚本当时漏改，
        # 从那以后一直是 29 列配 28 个值（久未运行才没暴露）
        sync.num(p['tov']), sync.num(p['pf']), sync.num(p['fg']), sync.num(p['fga']),
        pct(p['fgp']), sync.num(p['tp']), sync.num(p['tpa']),
        pct(p['tpp']), sync.num(p['ft']), sync.num(p['fta']),
        pct(p['ftp']), sync.num(eff, 1),
        'NULL' if gs is None else str(gs),
        'NULL' if gs is None else str(max(0, gp - gs)),
        sync.num(p['orb']), sync.num(p['drb']),
    ]
    return f"INSERT INTO {table} ({sync.STAT_COLS}) VALUES ({', '.join(vals)});"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', type=int, required=True, help='ESPN/B-R year, e.g. 1993 = 1992-93')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    year = args.season
    season_num = year - 1976
    print(f'== B-R backfill: {year - 1}-{str(year)[2:]} -> site season {season_num} ==')

    print('[1/5] B-R per-game tables')
    lg = league_of(year)
    reg = parse_br_pergame(f'https://www.basketball-reference.com/leagues/{lg}_{year}_per_game.html')
    time.sleep(3.5)
    po = parse_br_pergame(f'https://www.basketball-reference.com/playoffs/{lg}_{year}_per_game.html')
    time.sleep(3.5)
    # 只要打过 1 场就留：15 场那条线会误杀赛季报销的明星（与 sync.py 同一口径）
    reg = {k: v for k, v in reg.items() if (v['gp'] or 0) >= 1}
    po = {k: v for k, v in po.items() if k in reg}
    print(f'  regular {len(reg)}, playoffs {len(po)}')
    # 解析失败的下限按年代给：老联盟本来就只有一百来号人，1949-50 才 11 支队
    floor = 200 if year >= 1977 else 60 if year >= 1955 else 40
    if len(reg) < floor:
        sys.exit(f'ABORT: B-R parse looks broken ({len(reg)} < {floor})')

    print('[2/5] identity resolution (DB names -> ESPN search -> br-local)')
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    # 1970 年前直接走「库内名字 -> br-local」，不发 ESPN 搜索：那边没有这些球员，
    # 每季 160 次请求换不来一个 id，却要多花三四分钟
    ids = resolve_ids(reg, year, load_db_names(), cache, search_espn=year >= 1970)
    CACHE.write_text(json.dumps(cache))

    print('[3/5] teams / standings / playoff rounds / awards (ESPN)')
    teams = sync.get(f'{sync.BASE_SITE}/teams')['sports'][0]['leagues'][0]['teams']
    team_ids = {sync.code_of(t['team']['abbreviation']): t['team']['id'] for t in teams}
    id_to_code = {str(v): k for k, v in team_ids.items()}
    try:
        standings = sync.fetch_standings(year, id_to_code)
    except Exception as e:
        print(f'  ESPN 排名接口这一年不可用（{type(e).__name__}），转 B-R')
        standings = {}
    # old years: ESPN returns W/L but no points at all (or nothing) — B-R page has the lot
    if not standings or all(st.get('ppg') is None for st in standings.values()):
        print('  ESPN standings unusable this year -> B-R season page (W/L + team per-game)')
        standings = fetch_br_standings(year)
    # ESPN playoff schedules are incomplete this far back — rounds come from B-R series lists。
    # 1976 年前赛制年年变、球队大量已消失，解析不出来不该让整季入库失败：记一笔继续走，
    # 球员数据才是这一趟的主体。
    try:
        po_results = po_rounds_br.rounds_map(year)
    except Exception as e:
        print(f'  ！季后赛轮次解析失败，本季不写 PLAYOFF_RESULT：{e}')
        po_results = {}
    time.sleep(3.5)
    awards = sync.fetch_awards(year)

    print('[4/5] generating SQL')
    lines = ['SET NAMES utf8mb4;', 'START TRANSACTION;']
    # players upsert (name on INSERT only, keep hand translations; identity extras best-effort)
    for slug, p in reg.items():
        pid = ids[slug]
        lines.append(
            "INSERT INTO dream_player (PLAYER_ID, PLAYER_NAME, PLAYER_NUMBER, PLAYER_BIRTHDAY, NAME_EN, ESPN_ID) "
            f"VALUES ('{pid}', '{sync.esc(p['name'])}', '', NULL, '{sync.esc(p['name'])}', "
            f"{('NULL' if pid.startswith('nba-br') else repr(pid[4:]))}) "
            "ON DUPLICATE KEY UPDATE NAME_EN=NAME_EN;")
    # honors stash (same guarantee as sync.py)
    lines.append("DROP TEMPORARY TABLE IF EXISTS tmp_nba_honors;")
    lines.append(
        "CREATE TEMPORARY TABLE tmp_nba_honors AS SELECT PLAYER_ID, MVP_RANK, DPOY_RANK, ALL_DBA_TEAM, ALL_DEF_TEAM "
        f"FROM player_stats WHERE PLAYER_ID LIKE 'nba-%' AND SEASON_NUM={season_num} AND "
        "(MVP_RANK IS NOT NULL OR DPOY_RANK IS NOT NULL OR ALL_DBA_TEAM IS NOT NULL OR ALL_DEF_TEAM IS NOT NULL);")
    for table, rows, suffix in (('player_stats', reg, f's{season_num}'),
                                ('player_playoff_stats', po, f'p{season_num}')):
        lines.append(f"DELETE FROM {table} WHERE PLAYER_ID LIKE 'nba-%' AND SEASON_NUM={season_num};")
        for slug, p in rows.items():
            chain = [c for c in p['chain'] if c]
            team = ('->'.join(chain) if table == 'player_stats' else (chain[-1] if chain else '')) or ''
            lines.append(stat_row(table, season_num, suffix, ids[slug], p, team))
        lines.append(sync.career_sql(table))
    lines.append(
        "UPDATE player_stats ps JOIN tmp_nba_honors t ON ps.PLAYER_ID=t.PLAYER_ID "
        f"AND ps.SEASON_NUM={season_num} SET ps.MVP_RANK=t.MVP_RANK, ps.DPOY_RANK=t.DPOY_RANK, "
        "ps.ALL_DBA_TEAM=t.ALL_DBA_TEAM, ps.ALL_DEF_TEAM=t.ALL_DEF_TEAM;")
    lines.append("DROP TEMPORARY TABLE IF EXISTS tmp_nba_honors;")
    # season honors from ESPN awards feed (winners + teams), same additive writes as sync
    def upd(setter, espn_id):
        return f"UPDATE player_stats SET {setter} WHERE PLAYER_ID='nba-{espn_id}' AND SEASON_NUM={season_num};"
    for field, col in (('mvp', 'MVP_RANK=1'), ('dpoy', 'DPOY_RANK=1')):
        if awards.get(field):
            lines.append(upd(col, awards[field]))
    for espn_id, tier in awards['all_nba'].items():
        lines.append(upd(f"ALL_DBA_TEAM='{tier}'", espn_id))
    for espn_id, tier in awards['all_def'].items():
        lines.append(upd(f"ALL_DEF_TEAM='{tier}'", espn_id))
    lines.append(f"DELETE FROM season_award WHERE SEASON_NUM={season_num} AND AWARD IN ('fmvp','smoy','mip','roy');")
    for field in ('fmvp', 'smoy', 'mip', 'roy'):
        if awards.get(field):
            lines.append("INSERT INTO season_award (SEASON_NUM, AWARD, PLAYER_ID) "
                         f"VALUES ({season_num}, '{field}', 'nba-{awards[field]}');")
    # team_season: W/L + ppg/oppg; when the B-R fallback supplied per-game detail
    # (reb/ast/stl/blk/tov) write it too — ESPN-era pre-1994 rows keep those NULL
    for code, st in standings.items():
        result = po_results.get(code, '未进季后赛')
        lines.append(
            "INSERT INTO team_season (TEAM_CODE, SEASON_NUM, WINS, LOSSES, PTS_ALLOWED, PTS, "
            "REB, AST, STL, BLK, TOV, PLAYOFF_RESULT) "
            f"VALUES ('{sync.esc(code)}', {season_num}, {st['wins']}, {st['losses']}, "
            f"{sync.num(st.get('oppg'))}, {sync.num(st.get('ppg'))}, "
            f"{sync.num(st.get('reb'))}, {sync.num(st.get('ast'))}, {sync.num(st.get('stl'))}, "
            f"{sync.num(st.get('blk'))}, {sync.num(st.get('tov'))}, '{sync.esc(result)}') "
            "ON DUPLICATE KEY UPDATE WINS=VALUES(WINS), LOSSES=VALUES(LOSSES), "
            "PTS_ALLOWED=VALUES(PTS_ALLOWED), PTS=VALUES(PTS), REB=VALUES(REB), AST=VALUES(AST), "
            "STL=VALUES(STL), BLK=VALUES(BLK), TOV=VALUES(TOV), PLAYOFF_RESULT=VALUES(PLAYOFF_RESULT);")
    lines.append("COMMIT;")

    out = Path(__file__).parent / f'nba_sync_{year}.sql'
    out.write_text('\n'.join(lines), encoding='utf8')
    print(f'  SQL: {out} ({len(lines)} statements)')
    if args.dry_run:
        print('dry-run: not executed')
        return
    print('[5/5] executing against dream DB via docker...')
    res = subprocess.run(sync.mysql_cmd(), stdin=out.open('rb'), capture_output=True)
    if res.returncode != 0:
        sys.exit(f'MYSQL ERROR:\n{res.stderr.decode()[:2000]}')
    print(f'DONE: {len(reg)} regular rows, {len(po)} playoff rows, {len(standings)} teams.')


if __name__ == '__main__':
    main()
