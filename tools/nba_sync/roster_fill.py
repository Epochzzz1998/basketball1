# -*- coding: utf-8 -*-
"""把 ESPN 的 30 队完整名单补进 dream_player。

## 为什么需要这一步

`sync.py` 只给**有数据的人**建 dream_player 行：它遍历的是 byathlete 统计流，
名单（`fetch_rosters()`）只拿来补号码/位置/生日。于是一个整季没上过场的人——
赛季报销的老将、一场没打的新秀——在这个库里**根本不存在**。

后果不是"少个人"这么简单：
  · 比赛详情的未出场名单里，他的名字解析不出 PLAYER_ID，整条被丢掉；
  · 他的生涯逐季表缺这一季；
  · 球队的赛季名单里看不到他。

名单接口本来就在拉（30 队各一次），把它的结果落库，这三件事一起解决。

## 只 upsert，不删

名单是**当前**名单。用它去删任何东西都是错的——休赛期一转会，上赛季的人就
不在名单里了，删了等于抹掉历史。所以这里只新增和补充身份字段。

PLAYER_NAME 只在**首次插入**时写（写英文名），和 sync.py 同一个约定：
手工/词典翻译过的中文名不能被英文名覆盖。新插进来的人跑一次
`localize_names.py` 就能拿到中文名（在 zh_names.py 词典里的话）。

用法：
  python3 roster_fill.py --dry-run     # 只报告会新增谁
  python3 roster_fill.py               # 实际写库
  DREAM_DB_SSH=dream python3 roster_fill.py   # 数据库在别的机器上
"""
import argparse
import subprocess

import sync


def existing_ids():
    """库里已有的 PLAYER_ID 集合（只取 nba- 开头的，B-R 回补出来的历史球员不参与）"""
    p = subprocess.run(sync.mysql_cmd(), input=b"SELECT PLAYER_ID FROM dream_player;",
                       capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:500])
    out = set()
    for line in p.stdout.decode('utf-8', 'replace').splitlines()[1:]:
        line = line.strip()
        if line:
            out.add(line)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    print('[1/3] 拉 ESPN 30 队名单')
    ident, _ = sync.fetch_rosters()
    print(f'  名单共 {len(ident)} 人')

    print('[2/3] 比对库里已有的人')
    have = existing_ids()
    fresh = [(eid, info) for eid, info in ident.items() if f'nba-{eid}' not in have]
    print(f'  库里已有 {len(have)} 人，其中名单里的新面孔 {len(fresh)} 人')
    for eid, info in sorted(fresh, key=lambda x: x[1]['team']):
        print(f"    {info['team']:>3}  {info['name']:<26} #{info['jersey'] or '-':<3} "
              f"{info['pos'] or '-':<3} espnId={eid}")

    if not ident:
        print('名单是空的，不写库')
        return

    lines = ['SET NAMES utf8mb4;', 'START TRANSACTION;']
    for eid, info in ident.items():
        name = info.get('name') or ''
        if not name:
            continue
        dob = f"'{info['dob']}'" if info.get('dob') else 'NULL'
        # 和 sync.py 那条 upsert 逐字同构：PLAYER_NAME 只在插入时写，
        # 号码空串不覆盖已有值，生日 NULL 不覆盖已有值
        lines.append(
            "INSERT INTO dream_player (PLAYER_ID, PLAYER_NAME, PLAYER_NUMBER, PLAYER_BIRTHDAY, NAME_EN, ESPN_ID) "
            f"VALUES ('nba-{eid}', '{sync.esc(name)}', '{sync.esc(info.get('jersey') or '')}', {dob}, "
            f"'{sync.esc(name)}', '{sync.esc(eid)}') "
            "ON DUPLICATE KEY UPDATE "
            "PLAYER_NUMBER=IF(VALUES(PLAYER_NUMBER)='', PLAYER_NUMBER, VALUES(PLAYER_NUMBER)), "
            "PLAYER_BIRTHDAY=IFNULL(VALUES(PLAYER_BIRTHDAY), PLAYER_BIRTHDAY), NAME_EN=VALUES(NAME_EN);")
    lines.append('COMMIT;')
    sql = '\n'.join(lines) + '\n'

    print(f'[3/3] {len(ident)} 条 upsert（{len(sql)//1024} KB）')
    if a.dry_run:
        print('dry-run，没有写库')
        return
    p = subprocess.run(sync.mysql_cmd(), input=sql.encode('utf-8'), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:800])
    print('applied.')


if __name__ == '__main__':
    main()
