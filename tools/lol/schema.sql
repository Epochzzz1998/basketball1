-- 开黑战绩模块 —— 建表
-- 详见 vault 02-论坛社区/46-开黑战绩模块-策略.md
--
-- 三张表的分工：
--   lol_account       站内用户 ←→ Riot 账号的绑定关系（一对多，允许小号）
--   lol_match         一场对局的公共信息 + 原始 JSON
--   lol_match_player  这场里**已绑定用户**那几行（路人不存，他们在 RAW_GZ 里）

CREATE TABLE IF NOT EXISTS `lol_account` (
  `ACCOUNT_ID`  varchar(36)  NOT NULL COMMENT 'uuid',
  `USER_ID`     varchar(36)  NOT NULL COMMENT 'dream_user.USER_ID; 一个人可以绑多个小号',
  `GAME_NAME`   varchar(64)  NOT NULL COMMENT 'Riot ID 的前半段',
  `TAG_LINE`    varchar(16)  NOT NULL COMMENT 'Riot ID 的后半段（#后面）',
  `PUUID`       varchar(100) NOT NULL COMMENT '抓取全靠它；绑定时解析一次，之后永不再调 account-v1',
  `PLATFORM`    varchar(8)   NOT NULL DEFAULT 'oc1' COMMENT 'oc1 / tw2 …；决定 league-v4 打哪个主机',
  `REGION`      varchar(8)   NOT NULL DEFAULT 'sea' COMMENT 'match-v5 的区域路由；澳服是 sea 不是 asia',
  `ENABLED`     char(1)      NOT NULL DEFAULT '1' COMMENT '0=暂停抓取但保留数据',
  `BACKFILLED`  char(1)      NOT NULL DEFAULT '0' COMMENT '首次回填是否跑完；调度器据此决定要不要补历史',
  `BIND_TIME`   datetime     NOT NULL,
  `LAST_SYNC`   datetime              DEFAULT NULL COMMENT '最后一次成功拉到对局列表的时刻',
  `LAST_ERROR`  varchar(200)          DEFAULT NULL COMMENT '最后一次失败原因；用于「静默停止抓取」的排查',
  PRIMARY KEY (`ACCOUNT_ID`),
  UNIQUE KEY `uk_lol_account_puuid` (`PUUID`),
  KEY `idx_lol_account_user` (`USER_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Riot 账号绑定。PUUID 唯一：同一个游戏账号不允许被两个站内用户认领';

CREATE TABLE IF NOT EXISTS `lol_match` (
  `MATCH_ID`      varchar(32)  NOT NULL COMMENT '形如 OC1_1234567890；前缀是平台值不是区域值',
  `PLATFORM`      varchar(8)   NOT NULL,
  `QUEUE_ID`      int          NOT NULL COMMENT '400=匹配征召 420=单双排 430=盲选 440=灵活 450=大乱斗',
  `GAME_MODE`     varchar(24)           DEFAULT NULL,
  `GAME_START`    datetime     NOT NULL,
  `GAME_DURATION` int          NOT NULL COMMENT '秒',
  `GAME_VERSION`  varchar(32)           DEFAULT NULL COMMENT '将来算「这个版本谁最强」要用',
  `END_RESULT`    varchar(24)           DEFAULT NULL COMMENT 'GameComplete / Abort_* ；非 Complete 的不该进榜',
  `RAW_GZ`        mediumblob            DEFAULT NULL COMMENT 'match-v5 详情原文的 gzip，约 10KB',
  `CREATE_TIME`   datetime     NOT NULL,
  PRIMARY KEY (`MATCH_ID`),
  KEY `idx_lol_match_start` (`GAME_START`),
  KEY `idx_lol_match_queue` (`QUEUE_ID`, `GAME_START`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='一场对局。详情不可变，抓一次存永久，绝不重抓——Riot 的对局历史有保留期，过期就没了';

CREATE TABLE IF NOT EXISTS `lol_match_player` (
  `MATCH_ID`       varchar(32) NOT NULL,
  `PUUID`          varchar(100) NOT NULL,
  `USER_ID`        varchar(36) NOT NULL COMMENT '冗余一份，榜单按站内用户聚合时免一次 join',
  `CHAMPION_ID`    int          DEFAULT NULL,
  `CHAMPION_NAME`  varchar(32)  DEFAULT NULL,
  `TEAM_ID`        int          NOT NULL COMMENT '100 / 200；同一场同 TEAM_ID 的绑定用户 ≥2 即为开黑',
  `TEAM_POSITION`  varchar(16)  DEFAULT NULL COMMENT 'TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY，可能为空',
  `WIN`            char(1)     NOT NULL,
  `KILLS`          int         NOT NULL DEFAULT 0,
  `DEATHS`         int         NOT NULL DEFAULT 0,
  `ASSISTS`        int         NOT NULL DEFAULT 0,
  `GOLD`           int         NOT NULL DEFAULT 0,
  `DMG_CHAMP`      int         NOT NULL DEFAULT 0 COMMENT '对英雄总伤害',
  `DMG_TAKEN`      int         NOT NULL DEFAULT 0,
  `VISION`         int         NOT NULL DEFAULT 0,
  `CS`             int         NOT NULL DEFAULT 0 COMMENT '小兵 + 野怪',
  `CHAMP_LEVEL`    int         NOT NULL DEFAULT 0,
  `TIME_PLAYED`    int         NOT NULL DEFAULT 0 COMMENT '秒；提前退出时小于对局时长',
  `KDA`            decimal(6,2) DEFAULT NULL COMMENT 'challenges.kda，Riot 算好的，0 死亡时不是除零',
  `KILL_PART`      decimal(5,4) DEFAULT NULL COMMENT 'challenges.killParticipation',
  `DMG_SHARE`      decimal(5,4) DEFAULT NULL COMMENT 'challenges.teamDamagePercentage',
  `EARLY_SURR`     char(1)     NOT NULL DEFAULT '0' COMMENT '重开局；必须排除在榜单之外',
  PRIMARY KEY (`MATCH_ID`, `PUUID`),
  KEY `idx_lmp_user` (`USER_ID`),
  KEY `idx_lmp_team` (`MATCH_ID`, `TEAM_ID`),
  KEY `idx_lmp_puuid` (`PUUID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='对局里的已绑定用户。只存自己人：那 5 个路人查不出价值，需要时从 lol_match.RAW_GZ 里取';

-- ── 2026-07-30 追加：段位
--
-- 只给**已绑定的成员**存段位，不给对局里那五个路人存。
-- 路人的段位要靠 league-v4 逐个 PUUID 去查，而库里 200 多场对局里的不重复路人有两千多个，
-- 按限流每轮补十个也要跑二十小时——花掉大量配额去填一堆没人关心的名字。
-- 成员只有几个人，每小时刷一遍的代价可以忽略。
ALTER TABLE `lol_account`
  ADD COLUMN `TIER`         varchar(16)  DEFAULT NULL COMMENT 'IRON…CHALLENGER；未定级为 null' AFTER `BACKFILLED`,
  ADD COLUMN `RANK_DIV`     varchar(8)   DEFAULT NULL COMMENT 'I/II/III/IV；大师以上没有小段' AFTER `TIER`,
  ADD COLUMN `LEAGUE_POINT` int          DEFAULT NULL AFTER `RANK_DIV`,
  ADD COLUMN `RANK_WINS`    int          DEFAULT NULL AFTER `LEAGUE_POINT`,
  ADD COLUMN `RANK_LOSSES`  int          DEFAULT NULL AFTER `RANK_WINS`,
  ADD COLUMN `RANK_UPDATED` datetime     DEFAULT NULL COMMENT '上次刷新时刻；调度器据此决定要不要再查' AFTER `RANK_LOSSES`;

-- ── 2026-07-30 追加：对局里所有人的段位（含路人）
--
-- 为什么单独一张表、而不是把段位塞进 lol_match_player：
-- 后者按设计**只存自己人**，而段位要给一场里全部十个人显示。
-- 而且段位是「这个召唤师当前的属性」，和某一场对局无关——
-- 同一个人出现在二十场里，段位只该有一份。
--
-- 为什么不现场去查：一次详情十个人 = 十次 API 调用，占两分钟配额的 10%，
-- 几个人随手点几下就打满了。所以改成后台慢慢填、页面只读库。
CREATE TABLE IF NOT EXISTS `lol_summoner` (
  `PUUID`        varchar(100) NOT NULL,
  `GAME_NAME`    varchar(64)           DEFAULT NULL,
  `TAG_LINE`     varchar(16)           DEFAULT NULL,
  `PLATFORM`     varchar(8)   NOT NULL DEFAULT 'oc1',
  `TIER`         varchar(16)           DEFAULT NULL,
  `RANK_DIV`     varchar(8)            DEFAULT NULL,
  `LEAGUE_POINT` int                   DEFAULT NULL,
  `RANK_UPDATED` datetime              DEFAULT NULL COMMENT 'null = 还没查过；调度器优先补这些',
  `LAST_SEEN`    datetime     NOT NULL COMMENT '最近一次出现在对局里。按它倒序补，先补最近见过的人',
  PRIMARY KEY (`PUUID`),
  KEY `idx_lol_summoner_fill` (`RANK_UPDATED`, `LAST_SEEN`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='对局里出现过的所有召唤师及其当前段位。后台按 LAST_SEEN 倒序逐个补';

-- 这一场的十个人有没有登记过。新入库的对局当场登记，老数据靠后台逐批补扫。
ALTER TABLE `lol_match` ADD COLUMN `SCANNED` char(1) NOT NULL DEFAULT '0'
  COMMENT '参与者是否已登记进 lol_summoner' AFTER `END_RESULT`;

-- ── 2026-07-30 追加：API_PUUID
--
-- **PUUID 是按 API key 加密的**：同一个 Riot ID 用两把 key 解析出来是两串完全不同的值，
-- 拿旧 key 的 PUUID 去调新 key 的接口会得到 400 "Exception decrypting"。
-- 换 key 那一刻，库里所有 PUUID 对新 key 全部失效——这一点在换 personal key 时实际踩到了。
--
-- 解法是把两个身份分开，**不迁移历史数据**：
--   PUUID      = 本地规范身份。历史对局、榜单聚合、RAW_GZ 里的都是它，永不改动。
--   API_PUUID  = 当前 key 下的身份，只用来调 Riot 接口；key 一换就重新解析一次。
--
-- 入库时把任何已知别名归一到 PUUID，所以一个账号在数据里永远只有一个身份，
-- 榜单不会因为换 key 就把同一个人劈成两半。
ALTER TABLE `lol_account`  ADD COLUMN `API_PUUID` varchar(100) DEFAULT NULL
  COMMENT '当前 API key 下的 PUUID，只用于调接口；null = 待解析' AFTER `PUUID`;
ALTER TABLE `lol_summoner` ADD COLUMN `API_PUUID` varchar(100) DEFAULT NULL
  COMMENT '同上。路人靠存下来的 Riot ID 重新解析' AFTER `PUUID`;

-- ─────────────────────────────────────────────────────────────
-- 追加（2026-07-30）：承伤占比
--
-- 为什么这一项要**存**，而「伤转」不用：
--   伤转  = 对英雄伤害 / 自己的经济。分母就在同一行，查询里现算就行。
--   承伤占比 = 自己的承伤 / **全队五个人**的承伤。而这张表按设计只存自己人，
--            另外几个路人的承伤只在 lol_match.RAW_GZ 里——SQL 够不着。
--
-- 老数据靠 LolSyncService.backfillTakenShare() 从 RAW_GZ 补，一次 API 都不用打。
-- 0 是「查过了但原文里没有」的占位：真实的承伤占比不可能是 0
-- （一场里每个人多少都要挨点伤害），所以拿它当哨兵不会和真数据混淆。
ALTER TABLE lol_match_player
  ADD COLUMN TAKEN_SHARE decimal(5,4) DEFAULT NULL
  COMMENT 'challenges.damageTakenOnTeamPercentage；0=查过但原文里没有' AFTER DMG_SHARE;
