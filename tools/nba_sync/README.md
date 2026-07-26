# NBA 数据同步工具

把真实 NBA 数据（ESPN 公开 JSON 接口）同步进 dream 库的球员数据模块。
桌面上有「NBA数据同步.command」双击即可；或命令行：

```bash
python3 tools/nba_sync/sync.py              # 同步当前赛季（ESPN 2026 = 2025-26）
python3 tools/nba_sync/sync.py --dry-run    # 只生成 SQL 不入库
python3 tools/nba_sync/sync.py --season 2025  # 回补别的赛季（2024-25）
```

库内覆盖 ESPN 1987-2026 **四十个赛季**（站内第 1-40 季）。注意：

- 短赛季（2011-12 停摆 66 场、2019-20 约 65-75 场、2020-21 为 72 场）的 58/65 场
  资格线与命中数门槛沿用 82 场标准，官方认定的数据王被挡时按"官方优先"登记覆盖；
- 历史球队按特许经营权归入现队：超音速(≤07-08)=OKC、新泽西网(≤11-12)=BKN；
- byathlete 索引对停摆/新冠季只收录达标球员、正常赛季也偶有漏人（2013 漏 Avery
  Bradley），同步内置"相邻赛季对账"：缺席者逐个查 core 个人统计并合成补行；
- **1994 年（1993-94 季）之前 byathlete 索引完全不可用**（core 逐人统计却深到 80 年代）——
  这些赛季用 `--ids-file`（B-R 名单解析成 espn id 并按当季场次校验身份）驱动发现；
- 1984-2002 首轮五战三胜：夺冠 15 胜（非 16），轮次阈值 15/11/7/3 自动按年代切换；
- 球队一律按**特许经营 id** 映射到现队（分季规则：1988-2002 老黄蜂在 ESPN 挂鹈鹕 id，
  按 NBA 2014 裁定改归现黄蜂 CHA）；温哥华灰熊=MEM、子弹=WAS、超音速=OKC、新泽西=BKN；
- 1994 前 byteam 不可用：球队场均仅得分/失分（由 standings 总分推导），其余列为空。

- 依赖：无（纯标准库）；需要本机 docker 里的 mysql 容器在跑。
- DB 密码：读环境变量 `DREAM_DB_PWD`，或本目录下 git 忽略的 `.dbpwd` 文件。
- 赛季号换算：ESPN 年份 − 1986 = 站内 season_num（2026 → 40 → 显示 2025-2026 赛季；第 1 季=1986-1987，覆盖最近 40 年）。
  前端 `rankConfig.js` 的 `LATEST_SEASON` 要与最新赛季保持一致。
  注意：生涯档 sentinel 是 50，赛季号最多扩到 49，再往前回补需另起 sentinel。

幂等设计（每天重复跑安全）：

- 球员按 `nba-<espnId>` 主键 upsert；`PLAYER_NAME` **只在首次插入时写**——
  之后手工汉化的中文名不会被同步覆盖（英文名永远存在 `NAME_EN`）；
  号码/生日只在新值非空时覆盖（回补老赛季不会抹掉现役信息）；
- **赛季球队归属是"冻结"的**：来自 core API `/seasons/{y}/athletes/{id}` 的
  season 对象（`team`=该季结束时的球队、`teams`=季内先后效力链，写成 `DAL->LAL`）。
  byathlete 列表里的 team 是球员**当下**的东家、休赛期转会会把它改掉——绝不能用于
  赛季行（阵容必须停留在该季总决赛结束时）。季后赛行只归链条最后一队；
- 赛季数据行按（本赛季 + nba- 前缀）整删整插；生涯行（season 50）按出场数加权重算；
- `team_season` 每次更新胜负、**球队真实场均**（得分/失分/篮板/助攻/抢断/盖帽/失误 + 季后赛套）
  与 **PLAYOFF_RESULT（全部 30 队自动推导）**：按各队季后赛胜场数定轮次
  （16 胜=总冠军、12+=总决赛、8+=分区决赛、4+=半决赛、其余首轮；没进的=未进季后赛）；
- **赛季荣誉自动同步**（ESPN core API awards）：MVP/DPOY 获奖者（rank=1）、最佳阵容
  一/二/三阵、最佳防守一/二阵（现实中防守阵容只有两阵）、season_award 的
  fmvp/smoy/mip/roy（最佳新秀）。写入是**只加不清**：整删整插赛季数据行前会把
  荣誉列（MVP_RANK/DPOY_RANK/入阵）暂存进临时表、插完回填——手工补的
  MVP/DPOY 2-10 名投票排名每天重跑也不会被冲掉。
- **回补历史赛季的资格原则：官方认定优先于推算。** 官方明确的得分王等数据王
  若够不着 58 场线，在前端 `rankConfig.js` 的 `OFFICIAL_STAT_LEADERS` 按
  `{赛季号: {字段: 'nba-espnId'}}` 登记即可无条件参榜；荣誉行只要带官方
  名次/入阵结果就自动放行（`honorEligible`），65 场线只兜底无官方结论的行。
  MVP/DPOY 完整投票名次（2-10 名）ESPN 不提供，可查免费的
  Basketball-Reference `awards/awards_<年>.html` 手工录入。

球员的**首发/替补场次与前后场篮板拆分**走逐球员接口（~800 次并发请求，全程 1-2 分钟）。
数据源确实没有的字段（界面已裁掉展示）：PIE / WS / 进攻防守净效率 / 正负值。
`PLAYER_PER` 存的是经典效率值 EFF（得分+板+助+断+帽−打铁−失误），界面标签为「效率值」。

## 球员姓名汉化（zh_names.py + localize_names.py）

展示名 `PLAYER_NAME` 已全量汉化（2026-07，2826 人），英文名永存 `NAME_EN`，
后端搜索两列都命中。`zh_names.py` 是 NAME_EN → 中文名的完整字典（主流媒体译名；
Jr.=小、II/III/IV=二世/三世/四世，连字符姓保留）。同步工具只在**首插**时写
PLAYER_NAME（英文），所以每次同步进来新球员后跑一遍：

```bash
python3 localize_names.py --dry-run   # 看有多少未译、字典缺谁
python3 localize_names.py             # 应用（只改 PLAYER_NAME=NAME_EN 的行，手工改名永不覆盖）
```

字典没有的新名字：把 `"英文名": "中文名"` 加进 `zh_names.py` 再跑即可。

## 季后赛轮次细分（po_round_stats.py）

表 `player_playoff_round_stats`：一名球员一个赛季一轮一行（1 首轮 / 2 半决赛 /
3 分区决赛 / 4 总决赛），字段与 `player_playoff_stats` 同构，另加 `ROUND` 和 `OPP_TEAM`。

数据源是 **B-R 的免费系列赛页**，不是 ESPN：ESPN 的球员单场数据只到 1993 年，
而且从不标注轮次；B-R 每轮一个页面、轮次直接写在 URL 里，一路覆盖到 1947 年。

```bash
python3 po_round_stats.py --scrape                 # 全部 50 季，约 45 分钟
python3 po_round_stats.py --scrape --seasons 2026  # 只补当季（每年季后赛结束后跑一次）
python3 po_round_stats.py --build --dry-run        # 出 SQL + 对账报告，不入库
python3 po_round_stats.py --build                  # 入库（按赛季整删整插）
```

- **两段式**：`--scrape` 把每季结果落到 `po_rounds_cache/<年>.json`，已缓存的赛季直接跳过，
  中途断了重跑不会重复抓；`--build` 只读缓存，改匹配逻辑可以反复跑不碰网络。
  缓存和生成的 SQL 都不进 git（同 `nba_sync_*.sql` 的规矩），权威结果在库里、有每日备份兜底；
  真丢了重跑一次 `--scrape` 即可。
- **限速**：B-R 约 20 次/分钟，脚本固定 3.5 秒一次；碰到 429 会退避 90 秒再试。
  别改小 `DELAY`，被封要等一小时。
- **身份匹配**：B-R 只给名字。先在「该队该赛季季后赛名单」（十几个人）里匹配，
  再退到 `br_ids_cache.json` 的 slug 映射，再退到全库唯一同名，都不中就报出来不写。
- **对账是硬门槛**：每名球员各轮场次之和必须等于 `player_playoff_stats` 里的整季场次，
  `--build` 会打印不一致的行。2025 季实测 405 行、零不一致。

## 逐场数据（game_logs.py）

表 `player_game_stats`：一名球员一场一行，含对手、主客、胜负、比分、首发、正负值。
`SEASON_TYPE` 2 = 常规赛、3 = 季后赛；季后赛行带 `ROUND`。

这里用 **ESPN**，因为它的 box score 直接带球员 ESPN id，就是我们的主键 `nba-<espnId>`，
完全不用猜名字。代价是只能追到 1993 年（更早的比赛 ESPN 有赛程但球员数据为空，已探测）。

```bash
python3 game_logs.py --season 2026 --type po    # 当季季后赛，85 场约 15 秒
python3 game_logs.py --season 2026 --type reg   # 当季常规赛，1239 场
```

- 轮次是**推导**的：season type 3 固定 16 队 4 轮，按对阵分组、每队的第 N 个系列赛就是第 N 轮。
  季中附加赛在 season type 5，不会混进来。
- 只写 `dream_player` 里已有的球员，避免产生孤儿行。
- 校验：逐场累加应等于 `player_playoff_stats` 的整季场均。第 50 季实测 227 人四项零误差。
