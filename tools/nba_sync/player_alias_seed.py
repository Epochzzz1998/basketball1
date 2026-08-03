#!/usr/bin/env python3
"""Seed player_alias — the nicknames people type into the search box.

Why a table and not an algorithm: "字母哥" and "阿德托昆博" share no character and no
syllable, so edit distance, pinyin and embeddings all fail on them by construction.
Nicknames are pure convention; they can only be looked up.

Keyed on the English name, never the Chinese one: NAME_EN comes straight from the data
source and never moves, while PLAYER_NAME is a localization that gets revised (and is
still English for ~1400 players who were never localized).

Ambiguity is reported, never guessed. Several English names belong to two players
(Charles Jones, Mike James…); when that happens the script takes the one with more
career points and prints the choice so it can be eyeballed, and refuses outright if the
two are close enough that "more famous" is not obvious.

    python3 player_alias_seed.py --dry     # resolve and report, write nothing
    python3 player_alias_seed.py           # insert (idempotent, insert ignore)
"""
import subprocess
import sys

import sync

# English name -> the words people actually type. Chinese nicknames first, then any
# initials that are common enough to be worth the false positives (two-letter ones like
# AD also match a bare "A"; the career-points ordering keeps that harmless).
ALIASES = {
    # ── 现役 ──
    'Giannis Antetokounmpo': ['字母哥', '希腊怪兽'],
    'Thanasis Antetokounmpo': ['字母弟'],
    'Anthony Davis': ['浓眉', '浓眉哥', 'AD'],
    'LeBron James': ['詹皇', '老詹', '小皇帝', '勒布朗', 'LBJ'],
    'Stephen Curry': ['萌神', '库有引力', '库日天', '萌神库里'],
    'Joel Embiid': ['大帝'],
    'James Harden': ['大胡子', '灯泡'],
    'Russell Westbrook': ['威少'],
    'Kevin Durant': ['杜少', '死神', 'KD'],
    'Paul George': ['泡椒', 'PG13'],
    'Draymond Green': ['追梦'],
    'Klay Thompson': ['汤神'],
    'Kawhi Leonard': ['小卡', '可乐'],
    'Chris Paul': ['CP3', '保罗大师'],
    'Nikola Jokic': ['约老师', '老约'],
    'Ja Morant': ['莫少'],
    'Zion Williamson': ['胖虎'],
    'Donovan Mitchell': ['蜘蛛侠'],
    'Karl-Anthony Towns': ['KAT'],
    'Shai Gilgeous-Alexander': ['SGA'],
    'Victor Wembanyama': ['文班', '外星人'],
    'Damian Lillard': ['利拉德时间', 'Dame'],
    'Rudy Gobert': ['法国铁塔'],

    # ── 退役 ──
    'Michael Jordan': ['飞人', '篮球之神', 'MJ', '乔帮主'],
    'Kobe Bryant': ['黑曼巴', '曼巴'],
    'Shaquille O\'Neal': ['大鲨鱼', '鲨鱼'],
    'Tim Duncan': ['石佛', '大基本功'],
    'Manu Ginobili': ['妖刀'],
    'Allen Iverson': ['答案', 'AI'],
    'Hakeem Olajuwon': ['大梦'],
    'Kareem Abdul-Jabbar': ['天勾'],
    'Magic Johnson': ['魔术师'],
    'Larry Bird': ['大鸟'],
    'Wilt Chamberlain': ['张大帅'],
    'Bill Russell': ['指环王'],
    'Patrick Ewing': ['大猩猩'],
    'Gary Payton': ['手套'],
    'Vince Carter': ['半人半神'],
    'Dirk Nowitzki': ['德国战车', '司机'],
    'Carmelo Anthony': ['甜瓜'],
    'Dwyane Wade': ['闪电侠'],
    'Yao Ming': ['大姚'],
    'Tracy McGrady': ['麦迪', 'TMac'],
    'Kevin Garnett': ['狼王', 'KG'],
    'Ben Wallace': ['大本'],
    'Ray Allen': ['雷神'],
    'Karl Malone': ['邮差'],
    'George Gervin': ['冰人'],
    'Oscar Robertson': ['大O'],
    'Jason Williams': ['白巧克力'],
    'Gilbert Arenas': ['大将军'],
    'Metta World Peace': ['慈世平'],
    'Steve Nash': ['风之子'],
    'Dennis Rodman': ['大虫'],
    'Charles Barkley': ['飞猪'],
    'David Robinson': ['海军上将'],
    'Reggie Miller': ['米勒时刻'],
    'Dominique Wilkins': ['人类电影精华'],
    'Jerry West': ['Logo男'],
}


def rows(sql):
    p = subprocess.run(sync.mysql_cmd(['-N']), input=sql, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(p.stderr[:600])
    return [ln.split('\t') for ln in p.stdout.splitlines() if ln.strip()]


def main():
    dry = '--dry' in sys.argv

    wanted = sorted(ALIASES)
    quoted = ','.join("'" + n.replace("'", "''") + "'" for n in wanted)
    # 生涯得分用来在重名里挑「那个有名的」——同名两人的知名度差距在这张表里就是得分差距
    found = {}
    for name, pid, pts in rows(
            f"select p.NAME_EN, p.PLAYER_ID, ifnull(max(c.PTS), 0) "
            f"from dream_player p left join nba_career_totals c on c.PLAYER_ID = p.PLAYER_ID "
            f"where p.NAME_EN in ({quoted}) group by p.NAME_EN, p.PLAYER_ID;"):
        found.setdefault(name, []).append((pid, int(float(pts))))

    resolved, skipped = {}, []
    for name in wanted:
        cands = sorted(found.get(name, []), key=lambda x: -x[1])
        if not cands:
            skipped.append((name, 'NAME_EN 在 dream_player 里没有'))
        elif len(cands) == 1:
            resolved[name] = cands[0][0]
        elif cands[0][1] >= max(2 * cands[1][1], cands[1][1] + 2000):
            # 差距悬殊才敢认（名气差距在得分上是数量级的）；否则宁可不录
            resolved[name] = cands[0][0]
            print(f'  重名取高分：{name} -> {cands[0][0]} ({cands[0][1]} 分)，'
                  f'另一位 {cands[1][0]} ({cands[1][1]} 分)')
        else:
            skipped.append((name, f'重名且得分接近，无法判断：{cands[:2]}'))

    # 已经能被现有的「两列 LIKE」搜到的别名不录：'科比' 本来就命中 "科比·布莱恩特"，
    # 录进去只是让表变大。这一步顺带能发现录错的字——查不到目标球员才是真别名。
    pairs, redundant = [], []
    for name in sorted(resolved):
        pid = resolved[name]
        for a in ALIASES[name]:
            esc = a.replace("'", "''")
            hit = rows(f"select 1 from dream_player where PLAYER_ID = '{pid}' "
                       f"and (PLAYER_NAME like '%{esc}%' or NAME_EN like '%{esc}%') limit 1;")
            (redundant if hit else pairs).append((a, name))
    pairs = [(a, resolved[n]) for a, n in pairs]

    print(f'\n解析：{len(resolved)}/{len(wanted)} 人，真外号 {len(pairs)} 条')
    for a, name in redundant:
        print(f'  冗余（名字本来就搜得到）：{a} -> {name}')
    for name, why in skipped:
        print(f'  跳过 {name}：{why}')

    if dry:
        print('\n--dry：未写库')
        return
    values = ','.join("('" + a.replace("'", "''") + "','" + p + "')" for a, p in pairs)
    rows(f'insert ignore into player_alias (ALIAS, PLAYER_ID) values {values};')
    n = rows('select count(*) from player_alias;')[0][0]
    print(f'\nplayer_alias 现有 {n} 条')


if __name__ == '__main__':
    main()
