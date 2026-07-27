#!/usr/bin/env python3
"""PLAYOFF_RESULT from Basketball-Reference series summaries.

ESPN's team playoff schedules are incomplete for older seasons (1988 Lakers
return 15 of 24 games), so win-count thresholds under-label rounds. The B-R
playoff page lists every series as "<round>: <winner> over <loser> (4-2)" —
authoritative round placement for all 16 teams.

Usable standalone (fix a season in place) or imported by br_backfill:
  python3 po_rounds_br.py --season 2000          # update team_season in place
  python3 po_rounds_br.py --season 2000 --dry-run
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

# B-R full team names -> site codes (historical franchises included)
NAME2CODE = {
    'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN', 'New Jersey Nets': 'BKN',
    'Charlotte Hornets': 'CHA', 'Charlotte Bobcats': 'CHA', 'Chicago Bulls': 'CHI',
    'Cleveland Cavaliers': 'CLE', 'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN',
    'Detroit Pistons': 'DET', 'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU',
    'Indiana Pacers': 'IND', 'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL',
    'Memphis Grizzlies': 'MEM', 'Vancouver Grizzlies': 'MEM', 'Miami Heat': 'MIA',
    'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP', 'New Orleans Hornets': 'NOP', 'New Orleans/Oklahoma City Hornets': 'NOP',
    'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC', 'Seattle SuperSonics': 'OKC',
    'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX',
    'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS',
    'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA',
    'Washington Wizards': 'WAS', 'Washington Bullets': 'WAS',
    # 1976-1986 era franchises
    'Buffalo Braves': 'LAC', 'San Diego Clippers': 'LAC', 'New Orleans Jazz': 'UTA',
    'Kansas City Kings': 'SAC', 'New York Nets': 'BKN',
    # 1947-1975：只列出「有现代血脉」的队，其余（芝加哥雄鹿、华盛顿国会、圣路易斯轰炸机…）
    # 是已消失的球队，没有任何现役球队继承它们的历史，所以刻意不映射——落到 None 直接丢弃，
    # 总比硬塞给一支无关的现役球队强。
    'Syracuse Nationals': 'PHI', 'Philadelphia Warriors': 'GSW', 'San Francisco Warriors': 'GSW',
    'Minneapolis Lakers': 'LAL', 'Rochester Royals': 'SAC', 'Cincinnati Royals': 'SAC',
    'Kansas City-Omaha Kings': 'SAC', 'Fort Wayne Pistons': 'DET',
    'Tri-Cities Blackhawks': 'ATL', 'Milwaukee Hawks': 'ATL', 'St. Louis Hawks': 'ATL',
    'Baltimore Bullets': 'WAS', 'Chicago Zephyrs': 'WAS', 'Chicago Packers': 'WAS',
    'Capital Bullets': 'WAS', 'San Diego Rockets': 'HOU', 'Seattle SuperSonics': 'OKC',
}
ROUND_LABEL = [
    ('Finals', None),  # handled specially (winner champion / loser finals)
    ('Conference Finals', '分区决赛'),
    ('Conference Semifinals', '半决赛'),
    ('Conference First Round', '首轮'),
    ('Semifinals', '半决赛'),   # pre-conference naming variants
    ('First Round', '首轮'),
]


def old_charlotte(code, year):
    # keep consistent with sync.code_of_id: 1988-2002 Charlotte history belongs to CHA
    return code


def fetch_series(year):
    """[(round_name, winner_code, loser_code)] from the B-R playoff page"""
    lg = 'BAA' if year <= 1949 else 'NBA'   # 1947-1949 联盟叫 BAA，URL 同样是 BAA_
    req = urllib.request.Request(f'https://www.basketball-reference.com/playoffs/{lg}_{year}.html',
                                 headers=sync.UA)
    page = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    # series rows appear as: <span><strong>Western Conference First Round</strong></span> ...
    #   <a href="/teams/LAL/2000.html">Los Angeles Lakers</a> over
    #   <a href="/teams/SAC/2000.html">Sacramento Kings</a>
    out = []
    # 必须锁定「系列赛表格」那一种形状：<strong>标签</strong></span></td><td>赢家 over 输家。
    # 页面上还有一份导航列表，标签是缩写（"East Conf Finals"）且不带 over；早先的正则用
    # .*? 会从导航标签一路跨到表格第一行，把总决赛错配成分区决赛的标签。
    pat = re.compile(
        r'<strong>\s*([A-Za-z /]*?(?:Finals|First Round|Semifinals))\s*</strong>\s*</span>\s*</td>\s*'
        r'<td>\s*<a[^>]*>([^<]+)</a>\s*over\s*<a[^>]*>([^<]+)</a>', re.S)
    for m in pat.finditer(page):
        rnd, winner, loser = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        w, l = NAME2CODE.get(winner), NAME2CODE.get(loser)
        if w and l:
            out.append((rnd, w, l))
    return out


def expected_series(year):
    """这一季至少该解析出几组系列赛。赛制历年多变，所以老年代只设一个下限，
    真正的正确性检查是「必须找得到总决赛」——那一条比数量更能发现解析失败。"""
    if year >= 1984:
        return 15      # 16 队
    if year >= 1977:
        return 11      # 12 队，前两号种子轮空首轮
    if year >= 1975:
        return 9       # 10 队
    if year >= 1967:
        return 5       # 分区半决赛/决赛 + 总决赛，队数逐年变
    return 3           # 1947-1966：最少三组


def rounds_map(year):
    """teamCode -> PLAYOFF_RESULT for that season, from B-R series list"""
    series = fetch_series(year)
    expected = expected_series(year)
    if len(series) < expected:
        raise RuntimeError(f'{year}: only {len(series)} series parsed (expected {expected})')
    res = {}
    champ = False
    for rnd, w, l in series:
        # 总决赛那一组的标签就是 "Finals"/"NBA Finals"，没有东西部前缀。
        # 1976 年前分区叫 Division 不叫 Conference，"Eastern Division Finals" 若按
        # 「含 Finals 且不含 Conference」判定会被当成总冠军——所以改成看有没有前缀。
        head = rnd.replace('NBA', '').strip()
        if head == 'Finals':
            res[w] = '总冠军'
            res[l] = '总决赛'
            champ = True
        elif 'Conference Finals' in rnd or 'Division Finals' in rnd:
            res.setdefault(l, '分区决赛')
        elif 'Semifinals' in rnd:
            res.setdefault(l, '半决赛')
        elif 'First Round' in rnd:
            res.setdefault(l, '首轮')
    if not champ:
        raise RuntimeError(f'{year}: parsed {len(series)} series but found no championship series')
    return res


def apply(year, dry=False):
    season_num = year - 1976
    res = rounds_map(year)
    champ = [c for c, r in res.items() if r == '总冠军']
    print(f'{year} (season {season_num}): {len(res)} playoff teams, champion={champ}')
    lines = [f"UPDATE team_season SET PLAYOFF_RESULT='未进季后赛' WHERE SEASON_NUM={season_num};"]
    for code, r in res.items():
        lines.append(f"UPDATE team_season SET PLAYOFF_RESULT='{r}' WHERE SEASON_NUM={season_num} "
                     f"AND TEAM_CODE='{sync.esc(code)}';")
    sql = 'START TRANSACTION;\n' + '\n'.join(lines) + '\nCOMMIT;\n'
    if dry:
        print(sql[:600])
        return res
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:500])
    return res


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', type=int, required=True, help='ESPN/B-R year')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    apply(a.season, a.dry_run)
    time.sleep(1)
