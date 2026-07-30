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
