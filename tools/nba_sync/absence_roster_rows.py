# -*- coding: utf-8 -*-
"""给「整季在队但一场没打」的球员补一条 0 场的赛季行。

## 要解决什么

利拉德 25-26 赛季报销。他没退役、整季都在开拓者，但 `player_stats` 里没有他这一季
的行——那张表是从「有数据的人」生成的。于是：

  · 他的生涯逐季表缺 25-26 这一格，看起来像凭空消失了一年；
  · 开拓者 25-26 的球员列表里没有他；
  · 新赛季进行中时，「谁在这队但还没上过场」这个问题答不出来。

补一条 `PLAYER_APPEARANCE = 0`、其余数值列全 NULL 的行，这三件事一起解决。
前端本来就把 NULL 渲染成 `-`（rankConfig.EMPTY），不用改渲染。

## 名单从哪来：缺阵数据，不是 ESPN 的当前名单

ESPN 的 `/teams/{id}/roster` 是**此刻**的名单。拿它回填历史赛季是错的——
休赛期一转会，上赛季的归属就全乱了。而 `game_absence` 是逐场记下来的
「那天他在这支队的大名单里」，对每一个赛季都成立。

代价是覆盖面：整季连 Inactive 名单都没被列进去的人（比如整年在发展联盟）拿不到。
那种情况下「他算不算这支队的人」本身也是可争的，宁可漏不可错。

## 为什么必须能反复跑

`sync.py` 每次同步都会 `DELETE FROM player_stats WHERE SEASON_NUM=<那一季>` 再重插。
所以这些 0 场行**每次 sync 之后都要重新生成一遍**，它不是一次性数据修复。
脚本因此设计成幂等的：先删掉本季所有 0 场行，再重新算。

`PLAYER_APPEARANCE = 0` 是这些行的唯一标记，也是安全删除的依据——
库里原本一条 0 场/NULL 场的赛季行都没有（核对过），有数据的人不可能是 0 场。

## 对既有数据的影响（都核过）

  · 生涯汇总行（SEASON_NUM=99）是 `SUM(值×场次)/SUM(场次)` 加权，0 场行分子分母
    都加 0 → **生涯数据一点不变**；
  · 前端资格线是 `场次 >= ceil(当季最多场次×0.7)`，0 场行被挡在所有均值榜之外；
  · 命中数类门槛 `命中×场次 >= 阈值` → 0，同样挡掉；
  · `seasonGames = max(场次)`，0 场行拉不低资格线；
  · 唯一会露面的是「出场次数」榜（那一项本来就不设资格线），排在最后显示 0——这是对的。

用法：
  DREAM_DB_SSH=dream python3 absence_roster_rows.py --season 2026 --dry-run
  DREAM_DB_SSH=dream python3 absence_roster_rows.py --season 2026
"""
import argparse
import subprocess

import sync

SEASON_BASE = 1976


def run_sql(sql, capture=True):
    p = subprocess.run(sync.mysql_cmd(['-N']) if capture else sync.mysql_cmd(),
                       input=sql.encode('utf-8'), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace')[:800])
    return p.stdout.decode('utf-8', 'replace')


def preview(sn):
    """要补的人 [(pid, 名字, 球队, 缺阵场次)]"""
    q = f"""
SELECT a.PLAYER_ID,
       COALESCE(p.PLAYER_NAME, p.NAME_EN, '(库里没有这个人)'),
       SUBSTRING_INDEX(GROUP_CONCAT(a.TEAM ORDER BY g.GAME_DATE DESC), ',', 1),
       COUNT(*)
FROM game_absence a
JOIN (SELECT DISTINCT GAME_ID, GAME_DATE FROM player_game_stats WHERE SEASON_NUM = {sn}) g
  ON g.GAME_ID = a.GAME_ID
LEFT JOIN dream_player p ON p.PLAYER_ID = a.PLAYER_ID
WHERE NOT EXISTS (SELECT 1 FROM player_stats s
                  WHERE s.PLAYER_ID = a.PLAYER_ID AND s.SEASON_NUM = {sn}
                    AND IFNULL(s.PLAYER_APPEARANCE, 0) > 0)
GROUP BY a.PLAYER_ID, p.PLAYER_NAME, p.NAME_EN
ORDER BY 4 DESC;
"""
    rows = []
    for line in run_sql(q).splitlines():
        parts = line.split('\t')
        if len(parts) == 4:
            rows.append(tuple(parts))
    return rows


def apply_sql(sn):
    return f"""
SET NAMES utf8mb4;
START TRANSACTION;

-- 1) 先清掉本季上一轮生成的 0 场行（幂等的关键）
DELETE FROM player_stats WHERE SEASON_NUM = {sn} AND IFNULL(PLAYER_APPEARANCE, 0) = 0;

-- 2) 本季缺阵名单里，没有真实赛季行的人 + 他最后一次出现在名单上的球队
DROP TEMPORARY TABLE IF EXISTS tmp_zero;
CREATE TEMPORARY TABLE tmp_zero (
  pid varchar(100) PRIMARY KEY, team varchar(32), pos varchar(32) DEFAULT ''
);
INSERT INTO tmp_zero (pid, team)
SELECT a.PLAYER_ID,
       SUBSTRING_INDEX(GROUP_CONCAT(a.TEAM ORDER BY g.GAME_DATE DESC), ',', 1)
FROM game_absence a
JOIN (SELECT DISTINCT GAME_ID, GAME_DATE FROM player_game_stats WHERE SEASON_NUM = {sn}) g
  ON g.GAME_ID = a.GAME_ID
WHERE NOT EXISTS (SELECT 1 FROM player_stats s
                  WHERE s.PLAYER_ID = a.PLAYER_ID AND s.SEASON_NUM = {sn})
GROUP BY a.PLAYER_ID;

-- 3) 位置沿用他最近一个有位置的赛季。
--    不能留空：生涯行的位置取的是 `GROUP_CONCAT(位置 ORDER BY 赛季 DESC)` 的第一个，
--    留空的话最新一季恰好是这条 0 场行的人，生涯位置就被抹成空了。
UPDATE tmp_zero z
SET z.pos = IFNULL((SELECT s.PLAYER_POSITION FROM player_stats s
                    WHERE s.PLAYER_ID = z.pid AND s.SEASON_NUM <> 99
                      AND s.PLAYER_POSITION IS NOT NULL AND s.PLAYER_POSITION <> ''
                    ORDER BY s.SEASON_NUM DESC LIMIT 1), '');

-- 4) 写入。数值列一个都不给 → 全 NULL → 前端显示 '-'
INSERT INTO player_stats
  (STATS_ID, PLAYER_ID, SEASON, SEASON_NUM, PLAYER_TEAM, PLAYER_POSITION,
   PLAYER_APPEARANCE, PLAYER_FR_APPEARANCE, PLAYER_SR_APPEARANCE)
SELECT CONCAT(z.pid, '-s{sn}'), z.pid, {sn}, {sn}, z.team, z.pos, 0, 0, 0
FROM tmp_zero z;

DROP TEMPORARY TABLE IF EXISTS tmp_zero;
COMMIT;
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', type=int, required=True, help='ESPN 年份，如 2026 = 2025-26')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    sn = a.season - SEASON_BASE

    rows = preview(sn)
    print(f'{a.season}（第 {sn} 季）：{len(rows)} 人要补 0 场行')
    for pid, name, team, n in rows:
        print(f'  {team:>4}  {name:<24} 缺阵 {n:>3} 场   {pid}')
    if not rows:
        print('没有要补的人')
        return
    if a.dry_run:
        print('dry-run，没有写库')
        return
    run_sql(apply_sql(sn), capture=False)
    print('applied.')


if __name__ == '__main__':
    main()
