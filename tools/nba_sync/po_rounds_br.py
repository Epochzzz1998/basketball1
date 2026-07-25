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
    req = urllib.request.Request(f'https://www.basketball-reference.com/playoffs/NBA_{year}.html',
                                 headers=sync.UA)
    page = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    # series rows appear as: <span><strong>Western Conference First Round</strong></span> ...
    #   <a href="/teams/LAL/2000.html">Los Angeles Lakers</a> over
    #   <a href="/teams/SAC/2000.html">Sacramento Kings</a>
    out = []
    pat = re.compile(
        r'<strong>\s*([A-Za-z /]*?(?:Finals|First Round|Semifinals))\s*</strong>.*?'
        r'<a[^>]*>([^<]+)</a>\s*over\s*<a[^>]*>([^<]+)</a>', re.S)
    for m in pat.finditer(page):
        rnd, winner, loser = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        w, l = NAME2CODE.get(winner), NAME2CODE.get(loser)
        if w and l:
            out.append((rnd, w, l))
    return out


def rounds_map(year):
    """teamCode -> PLAYOFF_RESULT for that season, from B-R series list"""
    series = fetch_series(year)
    if len(series) < 15:
        raise RuntimeError(f'{year}: only {len(series)} series parsed')
    res = {}
    for rnd, w, l in series:
        # the championship series is labeled "Finals" or "NBA Finals" depending on era
        if 'Finals' in rnd and 'Conference' not in rnd and 'Semifinals' not in rnd:
            res[w] = '总冠军'
            res[l] = '总决赛'
        elif 'Conference Finals' in rnd:
            res.setdefault(l, '分区决赛')
        elif 'Semifinals' in rnd:
            res.setdefault(l, '半决赛')
        elif 'First Round' in rnd:
            res.setdefault(l, '首轮')
    return res


def apply(year, dry=False):
    season_num = year - 1986
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
