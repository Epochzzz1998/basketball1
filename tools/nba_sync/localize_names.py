# -*- coding: utf-8 -*-
"""Apply Chinese display names from zh_names.py to dream_player.

Only rows still in the untouched state (PLAYER_NAME = NAME_EN) are updated, so
hand-tuned names are never overwritten and the pass is safe to re-run any time —
typically after a sync inserts new players (sync writes PLAYER_NAME on first
insert only, using the English name).

Usage:
  python3 localize_names.py            # apply via docker mysql
  python3 localize_names.py --dry-run  # just report coverage, write no SQL
"""
import os
import subprocess
import sys
import tempfile

import sync
from zh_names import ZH_NAMES

HERE = os.path.dirname(os.path.abspath(__file__))


def db_password():
    pwd = os.environ.get('DREAM_DB_PWD')
    if not pwd:
        try:
            with open(os.path.join(HERE, '.dbpwd'), encoding='utf-8') as f:
                pwd = f.read().strip()
        except FileNotFoundError:
            sys.exit('set DREAM_DB_PWD or create tools/nba_sync/.dbpwd')
    return pwd


def mysql(pwd, sql, capture=True):
    # 走 sync.mysql_cmd()：数据库早就不在跑脚本这台机器上了，自己拼 docker exec
    # 会在本机找不到 docker 时直接失败——而这个脚本的典型用法正是「sync 插了新人，
    # 顺手本地化一下」，那时候人已经在别处了。设 DREAM_DB_SSH 即可远程执行。
    r = subprocess.run(sync.mysql_cmd(['-N']), input=sql.encode('utf-8'),
                       stdout=subprocess.PIPE if capture else None,
                       stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.exit('mysql failed: ' + r.stderr.decode('utf-8', 'replace')[:500])
    return r.stdout.decode('utf-8', 'replace') if capture else ''


def main():
    dry = '--dry-run' in sys.argv
    pwd = db_password()

    rows = mysql(pwd, "SELECT NAME_EN FROM dream_player WHERE PLAYER_NAME = NAME_EN;")
    pending = [n for n in rows.split('\n') if n.strip()]
    known = [n for n in pending if n in ZH_NAMES]
    unknown = sorted(set(pending) - set(ZH_NAMES))
    print(f'untranslated rows: {len(pending)}  (in map: {len(known)}, missing from map: {len(unknown)})')
    for n in unknown[:20]:
        print('  missing zh name:', n)
    if dry or not known:
        return

    esc = lambda s: s.replace('\\', '\\\\').replace("'", "''")
    sql = ['SET NAMES utf8mb4;', 'START TRANSACTION;']
    for en in known:
        sql.append("UPDATE dream_player SET PLAYER_NAME='%s' WHERE NAME_EN='%s' AND PLAYER_NAME=NAME_EN;"
                   % (esc(ZH_NAMES[en]), esc(en)))
    sql.append('COMMIT;')
    mysql(pwd, '\n'.join(sql), capture=False)

    left = mysql(pwd, "SELECT COUNT(*) FROM dream_player WHERE PLAYER_NAME = NAME_EN;").strip()
    print(f'applied {len(known)} names, still untranslated: {left}')


if __name__ == '__main__':
    main()
