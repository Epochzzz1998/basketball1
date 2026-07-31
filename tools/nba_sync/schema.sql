-- 比赛评分 / 球员打分 / 未出场名单 —— 建表
--
-- 三张表的分工：
--   game_rating         一个人对**一场比赛**的评分和短评
--   game_player_rating  一个人对**某场里某个球员**的评分
--   game_absence        某场比赛里报了名但没上场的人（DNP + 未激活）
--
-- 为什么评分拆成两张而不是一张带 PLAYER_ID 的：
--   一张表的话「评比赛」那一行的 PLAYER_ID 只能是 NULL，而 MySQL 的唯一索引
--   **不约束 NULL**——(GAME_ID, USER_ID, NULL) 可以插进去任意多次，
--   一个人就能给同一场比赛刷出十条评分。用空串当哨兵也行，但那要求每个查询
--   都记得 `PLAYER_ID = ''` 这个约定，漏一处就把球员分混进比赛分里。
--   拆开之后两张表的唯一键都落在 NOT NULL 列上，约束由数据库自己保证。

CREATE TABLE IF NOT EXISTS `game_rating` (
  `RATING_ID`   varchar(36)  NOT NULL COMMENT 'uuid',
  `GAME_ID`     varchar(32)  NOT NULL COMMENT 'player_game_stats.GAME_ID，形如 202310240DEN',
  `USER_ID`     varchar(100) NOT NULL COMMENT 'dream_user.USER_ID',
  `SCORE`       tinyint               DEFAULT NULL COMMENT '1..5；允许为空 = 只写了短评没打分',
  `COMMENT_TXT` varchar(300)          DEFAULT NULL COMMENT '短评；空 = 只打分不说话',
  `CREATE_TIME` datetime     NOT NULL,
  `UPDATE_TIME` datetime              DEFAULT NULL COMMENT '改分时更新；列表按它排，改过的会重新冒头',
  PRIMARY KEY (`RATING_ID`),
  UNIQUE KEY `uk_game_rating` (`GAME_ID`, `USER_ID`),
  KEY `idx_game_rating_game` (`GAME_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='对一场比赛的评分与短评。(GAME_ID, USER_ID) 唯一：再评就是改，不会叠加';

CREATE TABLE IF NOT EXISTS `game_player_rating` (
  `RATING_ID`   varchar(36)  NOT NULL COMMENT 'uuid',
  `GAME_ID`     varchar(32)  NOT NULL,
  `PLAYER_ID`   varchar(100) NOT NULL COMMENT 'dream_player.PLAYER_ID',
  `USER_ID`     varchar(100) NOT NULL,
  `SCORE`       tinyint      NOT NULL COMMENT '1..5',
  `CREATE_TIME` datetime     NOT NULL,
  `UPDATE_TIME` datetime              DEFAULT NULL,
  PRIMARY KEY (`RATING_ID`),
  UNIQUE KEY `uk_game_player_rating` (`GAME_ID`, `PLAYER_ID`, `USER_ID`),
  KEY `idx_game_player_rating_game` (`GAME_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='某场比赛里对某个球员的评分。一人一场一球员只有一条';

-- ─────────────────────────────────────────────────────────────
-- 未出场名单
--
-- 为什么**不**塞进 player_game_stats：
--   那张表现在的含义是「这个人这场打了」，整站的场均、生涯累计、排行榜全都
--   直接 count/sum 它。往里加没上场的行，哪怕数据列全是 NULL，
--   `count(*)` 也会立刻多出来——一个人的生涯场次会从 1200 变成 1500。
--   要么改掉所有聚合查询，要么单独一张表。单独一张表只影响用到它的地方。
--
-- 两种「没上场」在 B-R 页面上是两个不同的位置，含义也不同，所以 KIND 分开记：
--   DNP      box score 表里有名字、没有分钟数，取而代之是一个 reason 单元格。
--            这些人**穿了球衣坐在板凳上**（Did Not Play - Coach's Decision 等）。
--   INACTIVE 页面底部单独一块 `Inactive:`，按队列出。这些人在名单里但当天不可用
--            （伤病、未报名）。
CREATE TABLE IF NOT EXISTS `game_absence` (
  `GAME_ID`   varchar(32)  NOT NULL,
  `PLAYER_ID` varchar(100) NOT NULL,
  `TEAM`      varchar(32)           DEFAULT NULL COMMENT '三字母队码，和 player_game_stats.PLAYER_TEAM 一致',
  `KIND`      varchar(10)  NOT NULL COMMENT 'DNP=报名未出场 / INACTIVE=未激活',
  `REASON`    varchar(60)           DEFAULT NULL COMMENT 'B-R 给的原文，如 Did Not Play - Coach''s Decision',
  PRIMARY KEY (`GAME_ID`, `PLAYER_ID`),
  KEY `idx_game_absence_player` (`PLAYER_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='当场大名单里没上场的人。主键就是 (GAME_ID, PLAYER_ID)，重跑爬虫不会产生重复';

-- ─────────────────────────────────────────────────────────────
-- 追加（2026-07-30 第二轮）：刻度改 1-5、球员短评、回复
--
-- 刻度从 1-10 改成 1-5：十档在手机上是十个小方块，实际没人分得清 7 分和 8 分的差别，
-- 而档位一少，**评分分布**才画得出形状——五根柱子看得出「大家一致」还是「两极」，
-- 十根柱子在几十个人以下永远是一片稀疏的毛刺。
-- 已有数据按 ceil(旧分/2) 折算：10→5、9→5、8→4…… 满分仍是满分。
UPDATE game_rating        SET SCORE = CEILING(SCORE / 2) WHERE SCORE > 5;
UPDATE game_player_rating SET SCORE = CEILING(SCORE / 2) WHERE SCORE > 5;

-- 球员短评和球员评分是同一件事的两面（我怎么看他这场），所以放同一行，
-- 由 (GAME_ID, PLAYER_ID, USER_ID) 那个唯一键一起管住：一个人对一个人一场只有一个态度
ALTER TABLE game_player_rating
  ADD COLUMN COMMENT_TXT varchar(300) DEFAULT NULL COMMENT '对这个球员这一场的短评' AFTER SCORE;

-- 短评下面的回复。TARGET_ID 指向被回复那条短评的 RATING_ID——
-- 两张评分表的主键都是 UUID，不会撞，所以这一张表同时服务比赛短评和球员短评，
-- 不用再分两套表两套接口。
--
-- 只做两层（短评 → 回复），回复里 @ 谁靠 REPLY_TO_USER 记。无限层级在这种规模的
-- 讨论里只会产生一条越缩越窄的竖条，而想表达的其实就是「我在回你」。
CREATE TABLE IF NOT EXISTS `game_rating_reply` (
  `REPLY_ID`      varchar(36)  NOT NULL COMMENT 'uuid',
  `GAME_ID`       varchar(32)  NOT NULL COMMENT '冗余一份，好按比赛一次把回复全取回来',
  `TARGET_ID`     varchar(36)  NOT NULL COMMENT '被回复的短评：game_rating / game_player_rating 的 RATING_ID',
  `USER_ID`       varchar(100) NOT NULL,
  `REPLY_TO_USER` varchar(100)          DEFAULT NULL COMMENT '回复楼中楼时指向的人，用来显示「回复 @某某」',
  `CONTENT`       varchar(300) NOT NULL,
  `CREATE_TIME`   datetime     NOT NULL,
  PRIMARY KEY (`REPLY_ID`),
  KEY `idx_grr_target` (`TARGET_ID`),
  KEY `idx_grr_game` (`GAME_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='比赛/球员短评下面的回复，两层';

-- 球员分改成可空。加了短评之后「不打分只留一句话」成了合法状态，
-- 和 game_rating.SCORE 的口径对齐——两张表都是「分和短评至少有一个」，
-- 而不是「必须打分」。少了这一步的表现是提交时 500：Column 'SCORE' cannot be null。
ALTER TABLE game_player_rating MODIFY COLUMN SCORE tinyint DEFAULT NULL COMMENT '1..5；允许为空 = 只写了短评没打分';

-- ─────────────────────────────────────────────────────────────
-- 追加（2026-07-30 第三轮）：评论和评分彻底分家
--
-- 规则变了：**分能改，评论不能改**。
--   分  一人一场（或一人一场一球员）只有一条，再打就是覆盖。
--   评论 想说几次说几次，每次一条新的；发出去就定了，只能删不能改。
--
-- 原来两者挤在评分行里（COMMENT_TXT），那种结构只支持「一条可改的评论」——
-- 它把「一个人的态度只有一个」这条规则**顺带**加在了评论上，而评论不该受这条约束。
-- 一场比赛看到一半骂一句、看完再夸一句，是两句话，不是一句话改了两遍。
CREATE TABLE IF NOT EXISTS `game_comment` (
  `COMMENT_ID`  varchar(36)  NOT NULL COMMENT 'uuid',
  `GAME_ID`     varchar(32)  NOT NULL,
  `PLAYER_ID`   varchar(100) NOT NULL DEFAULT '' COMMENT '空串 = 评这场比赛本身；否则是评这个球员',
  `USER_ID`     varchar(100) NOT NULL,
  `CONTENT`     varchar(300) NOT NULL,
  `CREATE_TIME` datetime     NOT NULL,
  PRIMARY KEY (`COMMENT_ID`),
  KEY `idx_game_comment_game` (`GAME_ID`, `PLAYER_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='比赛/球员短评。一个人可以发多条，发出去不能改——所以这里没有唯一键也没有 UPDATE_TIME';

-- PLAYER_ID 用空串而不是 NULL 当「评比赛本身」的哨兵：这张表**没有唯一键**，
-- 所以 NULL 不会带来 game_rating 那种「唯一索引管不住 NULL」的问题；
-- 用空串纯粹是为了让按 PLAYER_ID 分组的代码不用到处判 null。

-- 把旧的单条评论搬过来，然后把列去掉
INSERT INTO game_comment (COMMENT_ID, GAME_ID, PLAYER_ID, USER_ID, CONTENT, CREATE_TIME)
SELECT RATING_ID, GAME_ID, '', USER_ID, COMMENT_TXT, IFNULL(UPDATE_TIME, CREATE_TIME)
FROM game_rating WHERE COMMENT_TXT IS NOT NULL AND COMMENT_TXT <> '';
INSERT INTO game_comment (COMMENT_ID, GAME_ID, PLAYER_ID, USER_ID, CONTENT, CREATE_TIME)
SELECT RATING_ID, GAME_ID, PLAYER_ID, USER_ID, COMMENT_TXT, IFNULL(UPDATE_TIME, CREATE_TIME)
FROM game_player_rating WHERE COMMENT_TXT IS NOT NULL AND COMMENT_TXT <> '';
-- 搬迁时沿用 RATING_ID 当 COMMENT_ID，这样 game_rating_reply.TARGET_ID
-- 不用改就仍然指向正确的那条——回复本来就是挂在「这段话」上的

-- 只剩评论的行（撤了分只留话）现在没有存在意义了，删掉
DELETE FROM game_rating        WHERE SCORE IS NULL;
DELETE FROM game_player_rating WHERE SCORE IS NULL;

ALTER TABLE game_rating        DROP COLUMN COMMENT_TXT;
ALTER TABLE game_player_rating DROP COLUMN COMMENT_TXT;

-- 评分行现在只剩一件事：这个人给了几分。为空就没有存在的理由，改回 NOT NULL
ALTER TABLE game_rating        MODIFY COLUMN SCORE tinyint NOT NULL COMMENT '1..5';
ALTER TABLE game_player_rating MODIFY COLUMN SCORE tinyint NOT NULL COMMENT '1..5';

ALTER TABLE game_rating_reply
  MODIFY COLUMN TARGET_ID varchar(36) NOT NULL COMMENT '被回复的那条 game_comment.COMMENT_ID';

-- 短评和回复的时间戳改成毫秒精度。
--
-- 它们是**按时间排的会话**，而 datetime 只到秒：同一秒里发的两条谁在前谁在后
-- 由数据库随手决定，实测连发三条短评就会乱序。评分表不用改——那里的时间只是
-- 元信息，没有任何东西按它排。
ALTER TABLE game_comment      MODIFY COLUMN CREATE_TIME datetime(3) NOT NULL;
ALTER TABLE game_rating_reply MODIFY COLUMN CREATE_TIME datetime(3) NOT NULL;

-- ── 短评/回复支持 @ 提及（2026-07-31）
-- 存的是 [{"id":"..","name":".."}]，发布那一刻按全站昵称解析出来的（MentionUtil.resolveTextMentions）。
-- 为什么连 name 一起存：正文里写的是**当时**的昵称，对方改名之后只能靠旧名在文本里定位，
-- 显示则用读取时补上的当前昵称。只存 id 的话，改名之后那段文字就再也标不出来了。
ALTER TABLE game_comment ADD COLUMN MENTIONS varchar(1000) DEFAULT NULL COMMENT '被@到的人 [{id,name}]';
ALTER TABLE game_rating_reply ADD COLUMN MENTIONS varchar(1000) DEFAULT NULL COMMENT '被@到的人 [{id,name}]';

-- ── 0 场赛季行（2026-07-31）
-- 没有建表语句：这是 absence_roster_rows.py 往 player_stats 里补的普通行，
-- PLAYER_APPEARANCE = 0、其余数值列 NULL。记在这里是因为它有一条必须知道的约束：
-- sync.py 每次同步都会 DELETE 掉整季的 nba-% 行再重插，所以这些 0 场行
-- **每次 sync 之后都要重新跑一遍 absence_roster_rows.py**，它不是一次性数据修复。
