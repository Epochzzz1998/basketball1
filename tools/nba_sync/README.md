# NBA 数据同步工具

把真实 NBA 数据（ESPN 公开 JSON 接口）同步进 dream 库的球员数据模块。
桌面上有「NBA数据同步.command」双击即可；或命令行：

```bash
python3 tools/nba_sync/sync.py              # 同步当前赛季（ESPN 2026 = 2025-26）
python3 tools/nba_sync/sync.py --dry-run    # 只生成 SQL 不入库
python3 tools/nba_sync/sync.py --season 2025  # 回补别的赛季（2024-25）
```

- 依赖：无（纯标准库）；需要本机 docker 里的 mysql 容器在跑。
- DB 密码：读环境变量 `DREAM_DB_PWD`，或本目录下 git 忽略的 `.dbpwd` 文件。
- 赛季号换算：ESPN 年份 − 2008 = 站内 season_num（2026 → 18 → 显示 2025-2026 赛季）。
  前端 `rankConfig.js` 的 `LATEST_SEASON` 要与最新赛季保持一致。

幂等设计（每天重复跑安全）：

- 球员按 `nba-<espnId>` 主键 upsert；`PLAYER_NAME` **只在首次插入时写**——
  之后手工汉化的中文名不会被同步覆盖（英文名永远存在 `NAME_EN`）；
- 赛季数据行按（本赛季 + nba- 前缀）整删整插；生涯行（season 50）按出场数加权重算；
- `team_season` 只更新胜负与失分；`PLAYOFF_RESULT`（总冠军等）**手工维护、永不触碰**；
- 荣誉列（MVP_RANK/DPOY_RANK/最佳阵容）与 `season_award`（FMVP 等）同样手工维护
  （在 超管 → 球员管理 → 数据 里填），同步不会动它们。

数据源没有的字段（界面已裁掉展示）：PIE / WS / 进攻防守净效率 / 正负值 / 首发数 /
前后场篮板拆分。`PLAYER_PER` 存的是经典效率值 EFF（得分+板+助+断+帽−打铁−失误），
界面标签为「效率值」。
