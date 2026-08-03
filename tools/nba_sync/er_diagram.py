# -*- coding: utf-8 -*-
"""数据库 ER 图生成器：information_schema → Obsidian 的 mermaid 文档。

## 为什么是「生成」而不是手画

站长要求 ER 图**以后要跟着库同步更新**。手画的图从画完那天起就开始过期，而且没有任何
信号提醒它过期了。生成式的约定是：**改了表结构就重跑一次这个脚本**，实体和列永远是
现读的；跑一次的成本是几秒。

## 什么是生成的、什么是手工维护的

  实体（表、列、类型、主键/唯一键、列注释）  →  information_schema 现读
  关系连线                                  →  本文件底部的 RELATIONS，手工维护

关系没法自动生成：这个库**刻意不建外键约束**（历史数据靠脚本整表灌入，外键会让灌入
变慢很多，见 GameRatingController 的说明），所以表之间的关联只存在于代码逻辑里，
只能由人写下来。新加了带关联的表，往 RELATIONS 里补一行即可。

## 防遗漏的两道保险

  · 没归进任何域的表自动落进「未分组」一节——新表忘了归类会在文档里显眼地出现，
    而不是悄悄消失；
  · RELATIONS 引用了不存在的表会打警告并跳过——表改名后旧连线不会烂在图里。

用法：
  DREAM_DB_SSH=dream python3 er_diagram.py            # 写入 Obsidian
  DREAM_DB_SSH=dream python3 er_diagram.py --stdout   # 只打印，不落盘
"""
import argparse
import datetime
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sync

OUT = Path('/Users/epoch/Obsidian/Epoch/篮球项目改造/04-运维与性能/57-数据库ER图.md')

# ─────────────────────────────────────────── 域的划分（表 → 哪一节）

DOMAINS = OrderedDict([
    ('用户与消息', [
        'dream_user', 'user_information', 'user_follow', 'user_block', 'user_remark',
        'dream_private_message', 'push_subscription', 'push_device', 'site_announcement',
    ]),
    ('论坛社区', [
        'forum_category', 'forum_topic', 'forum_topic_member', 'forum_topic_join_request',
        'forum_topic_file', 'topic_subscription', 'topic_pin', 'topic_seen',
        'topic_chat_message', 'topic_chat_read',
        'dream_news', 'dream_news_comment', 'news_favorite', 'news_viewer',
        'forum_rating_item', 'forum_rating_vote', 'forum_poll_item', 'forum_poll_vote',
    ]),
    ('日程', ['schedule_event', 'schedule_recur_done']),
    ('NBA 数据', [
        'dream_player', 'player_alias', 'player_stats', 'player_playoff_stats',
        'player_playoff_round_stats',
        'player_game_stats', 'game_absence', 'game_period_score',
        'team_season', 'season_award', 'nba_career_totals', 'nba_draft',
    ]),
    ('赛后评分（NBA 与 LoL 共用）', [
        'game_rating', 'game_player_rating', 'game_comment', 'game_rating_reply',
    ]),
    ('开黑战绩', ['lol_account', 'lol_match', 'lol_match_player', 'lol_summoner']),
    ('烤串台账', [
        'bbq_staff', 'bbq_skewer_type', 'bbq_wage_record', 'bbq_wage_skewer', 'bbq_settlement',
    ]),
    ('遗留（无引用，待清理确认）', ['burning_comment', 'burning_like']),
])

# ─────────────────────────────────────────── 关系（手工维护）
# mermaid 记号：||--o{ 一对多；}o--|| 多对一；|o--o| 一对零或一；.. 表示弱关联（逻辑同键）

RELATIONS = {
    '用户与消息': [
        'dream_user ||--o{ user_information : "RECEIVER_ID 收消息"',
        'dream_user ||--o{ user_follow : "FOLLOWER_ID 关注 FOLLOWEE_ID"',
        'dream_user ||--o{ user_block : "屏蔽"',
        'dream_user ||--o{ user_remark : "备注名"',
        'dream_user ||--o{ dream_private_message : "SENDER_ID / RECEIVER_ID"',
        'dream_user ||--o{ push_subscription : "Web Push 订阅"',
        'dream_user ||--o{ push_device : "App 推送设备(FCM)"',
    ],
    '论坛社区': [
        'forum_category ||--o{ forum_topic : "CATEGORY_ID"',
        'forum_topic ||--o{ dream_news : "TOPIC_ID"',
        'forum_topic ||--o{ forum_topic_member : "成员三权"',
        'forum_topic ||--o{ forum_topic_join_request : "加入申请"',
        'forum_topic ||--o{ forum_topic_file : "文件系统"',
        'forum_topic_file ||--o{ forum_topic_file : "PARENT_ID 成树"',
        'forum_topic ||--o{ topic_subscription : "订阅"',
        'forum_topic ||--o{ topic_pin : "按人置顶"',
        'forum_topic ||--o{ topic_seen : "新活动游标"',
        'forum_topic ||--o{ topic_chat_message : "群聊"',
        'forum_topic ||--o{ topic_chat_read : "群聊已读游标"',
        'dream_news ||--o{ dream_news_comment : "NEWS_ID"',
        'dream_news_comment ||--o{ dream_news_comment : "COMMENT_REL_ID 楼中楼"',
        'dream_news ||--o{ news_favorite : "收藏"',
        'dream_news ||--o{ news_viewer : "浏览去重"',
        'dream_news ||--o{ forum_rating_item : "帖内打分项"',
        'forum_rating_item ||--o{ forum_rating_vote : "打分票"',
        'dream_news ||--o{ forum_poll_item : "帖内投票项"',
        'forum_poll_item ||--o{ forum_poll_vote : "投票票"',
    ],
    '日程': [
        'dream_user ||--o{ schedule_event : "OWNER_ID / ASSIGNEE_ID"',
        'schedule_event ||--o{ schedule_recur_done : "循环日程按日完成"',
    ],
    'NBA 数据': [
        'dream_player ||--o{ player_alias : "外号/别名,检索用"',
        'dream_player ||--o{ player_stats : "常规赛逐季(99=生涯)"',
        'dream_player ||--o{ player_playoff_stats : "季后赛逐季"',
        'dream_player ||--o{ player_playoff_round_stats : "季后赛分轮次"',
        'dream_player ||--o{ player_game_stats : "逐场(TYPE 2常规/3季后)"',
        'dream_player ||--o{ game_absence : "缺阵(DNP/INACTIVE)"',
        'player_game_stats }o..o{ game_period_score : "同一 GAME_ID 的节次比分"',
        'player_game_stats }o..o{ game_absence : "同一 GAME_ID"',
        'nba_career_totals |o--o| dream_player : "PLAYER_ID 可空映射"',
        'nba_draft }o--o| nba_career_totals : "BR_SLUG = BR_ID"',
        'season_award }o--o| dream_player : "获奖人"',
    ],
    '赛后评分（NBA 与 LoL 共用）': [
        'dream_user ||--o{ game_rating : "整场打分,一人一条"',
        'dream_user ||--o{ game_player_rating : "按人打分"',
        'dream_user ||--o{ game_comment : "短评,只增不改"',
        'game_comment ||--o{ game_rating_reply : "TARGET_ID"',
    ],
    '开黑战绩': [
        'dream_user ||--o{ lol_account : "绑定 Riot 账号"',
        'lol_match ||--o{ lol_match_player : "MATCH_ID(只存站内成员)"',
    ],
    '烤串台账': [
        'dream_user ||--o{ bbq_staff : "店员档案"',
        'dream_user ||--o{ bbq_wage_record : "工时记录"',
        'bbq_wage_record ||--o{ bbq_wage_skewer : "RECORD_ID 串数明细"',
        'bbq_skewer_type ||--o{ bbq_wage_skewer : "TYPE_ID(快照价)"',
        'dream_user ||--o{ bbq_settlement : "结清记录"',
    ],
    '遗留（无引用，待清理确认）': [],
}

# 各域图下面的补充说明（图说不清的口径写在这里）
NOTES = {
    'NBA 数据': [
        '`player_game_stats.GAME_ID` 形如 `202604180CLE`（B-R 的日期+主队码）；`GAME_STAT_ID` 主键含球队码（1978 年有一场重赛，同一人同一场为两队各出场一次）。',
        '`nba_career_totals` 覆盖 1947 年至今全联盟（含大量本库没有资料卡的人），是 B-R slug → 本库球员 id 的**唯一**映射点。',
        '`team_season`、`season_award` 按 `(SEASON_NUM, …)` 组合主键，与球员表靠赛季号并联，无外键。',
    ],
    '赛后评分（NBA 与 LoL 共用）': [
        '四张表只按 `(GAME_ID, PLAYER_ID)` 键：`GAME_ID` 既可以是 NBA 的 `202604180CLE` 也可以是 LoL 的 `OC1_654943407`（两种命名空间不会撞）；`PLAYER_ID` 相应地是球员 id 或 PUUID。接口靠 `kind` 参数分流。',
    ],
    '开黑战绩': [
        '`lol_match.RAW_GZ` 存 Riot 原始 JSON（gzip），一经写入不再变；对局详情、十人名单校验、足迹名字全部从它解出。',
        '`lol_account` 有两个 PUUID：`PUUID` 是本地规范身份（永不变），`API_PUUID` 是当前 key 下调接口用的（换 key 自愈重解析）。',
        '`lol_summoner` 按 PUUID 缓存路人段位，后台每轮补 30 个。',
    ],
    '遗留（无引用，待清理确认）': [
        '这两张表 0 行且代码中无活跃引用，保留待确认后删除。',
    ],
}

MERMAID_KEY = {'PRI': 'PK', 'UNI': 'UK'}


def fetch_columns():
    """{table: [(col, type, key, comment)]}，排除 *_bak_* 备份表"""
    q = ("select TABLE_NAME, COLUMN_NAME, DATA_TYPE, ifnull(COLUMN_KEY,''), "
         "ifnull(COLUMN_COMMENT,'') from information_schema.columns "
         "where TABLE_SCHEMA='dream' and TABLE_NAME not like '%\\_bak\\_%' "
         "order by TABLE_NAME, ORDINAL_POSITION")
    p = subprocess.run(sync.mysql_cmd(['-N']), input=q.encode('utf-8'), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace')[:500])
    tables = OrderedDict()
    for line in p.stdout.decode('utf-8', 'replace').splitlines():
        parts = line.split('\t')
        if len(parts) != 5:
            continue
        t, col, typ, key, comment = parts
        tables.setdefault(t, []).append((col, typ, key, comment))
    return tables


def fetch_bak_tables():
    q = ("select TABLE_NAME from information_schema.tables "
         "where TABLE_SCHEMA='dream' and TABLE_NAME like '%\\_bak\\_%' order by TABLE_NAME")
    p = subprocess.run(sync.mysql_cmd(['-N']), input=q.encode('utf-8'), capture_output=True)
    return [x for x in p.stdout.decode('utf-8', 'replace').split() if x]


def clean_comment(s):
    """列注释进 mermaid 的引号里：去掉会撞语法的字符，截到一眼能读的长度"""
    s = s.replace('"', "'").replace('\n', ' ').replace('`', '').strip()
    return (s[:36] + '…') if len(s) > 37 else s


def entity_block(name, cols):
    lines = [f'    {name} {{']
    for col, typ, key, comment in cols:
        parts = [f'        {typ} {col}']
        if key in MERMAID_KEY:
            parts.append(MERMAID_KEY[key])
        c = clean_comment(comment)
        if c:
            parts.append(f'"{c}"')
        lines.append(' '.join(parts))
    lines.append('    }')
    return '\n'.join(lines)


def build(tables):
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    assigned = set()
    out = []
    out.append('# 57 - 数据库 ER 图\n')
    out.append(f'> 生成时间：{now} ｜ 库：`dream`（迷你主机 MySQL 8）｜ 表 {len(tables)} 张（不含备份表）\n')
    out.append('> **这份文档是生成的，不要手改实体部分。** 改了表结构后重跑：\n>')
    out.append('> ```\n> cd ~/IdeaProjects/basketball/tools/nba_sync && DREAM_DB_SSH=dream python3 er_diagram.py\n> ```\n>')
    out.append('> 实体（表/列/主键/注释）来自 information_schema 现读；**关系连线在脚本的 RELATIONS 里手工维护**——'
               '这个库刻意不建外键（历史数据整表灌入，外键拖慢太多），表间关联只存在于代码里。'
               '新表没归类会落到文末「未分组」一节，提醒去脚本里补。\n')

    for domain, wanted in DOMAINS.items():
        present = [t for t in wanted if t in tables]
        missing = [t for t in wanted if t not in tables]
        for t in present:
            assigned.add(t)
        if missing:
            print(f'!! 域「{domain}」里这些表已不在库中: {missing}')
        if not present:
            continue
        out.append(f'\n## {domain}\n')
        out.append('```mermaid')
        out.append('erDiagram')
        for line in RELATIONS.get(domain, []):
            ends = [w for w in line.split() if w not in ('||--o{', '}o--||', '|o--o|', '}o--o|', '}o..o{', ':')]
            head = line.split()[0]
            tail = line.split()[2]
            if head not in tables or tail not in tables:
                print(f'!! 关系引用了不存在的表，已跳过: {line}')
                continue
            out.append(f'    {line}')
        for t in present:
            out.append(entity_block(t, tables[t]))
        out.append('```')
        for note in NOTES.get(domain, []):
            out.append(f'\n- {note}')

    orphans = [t for t in tables if t not in assigned]
    if orphans:
        out.append('\n## 未分组（新表？去 er_diagram.py 的 DOMAINS 里归类）\n')
        out.append('```mermaid')
        out.append('erDiagram')
        for t in orphans:
            out.append(entity_block(t, tables[t]))
        out.append('```')

    baks = fetch_bak_tables()
    if baks:
        out.append('\n## 备份表（不入图）\n')
        out.append('、'.join(f'`{b}`' for b in baks))
    out.append('')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stdout', action='store_true')
    ap.add_argument('--out', default=str(OUT))
    a = ap.parse_args()
    tables = fetch_columns()
    doc = build(tables)
    if a.stdout:
        print(doc)
        return
    Path(a.out).write_text(doc, encoding='utf-8')
    print(f'已写入 {a.out}（{len(tables)} 张表，{len(doc)} 字符）')


if __name__ == '__main__':
    main()
