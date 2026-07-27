/** 球员数据模块共享配置：赛季选项、数字格式化、单项排行榜配置、NBA 队名映射 */

// 第 N 赛季 = (SEASON_BASE+N)-(SEASON_BASE+1+N)：第 1 赛季即 1976-77（锚点 1976 = ABA 合并元年，覆盖 50 年）
export const SEASON_BASE = 1975

// 生涯档 sentinel：99（DB 列是 decimal(2,0)，99 是天花板；最新赛季 50 之后还有 48 年增长空间）
export const CAREER_SEASON = 99

export const seasonYearLabel = (n) =>
  Number(n) === CAREER_SEASON ? '生涯场均' : `${SEASON_BASE + Number(n)}-${SEASON_BASE + 1 + Number(n)} 赛季`

// 数据表的赛季列用：只留年份后两位，如 1986-1987 → 86-87（生涯档=生涯）
export const seasonShort = (n) =>
  Number(n) === CAREER_SEASON
    ? '生涯'
    : `${String(SEASON_BASE + Number(n)).slice(-2)}-${String(SEASON_BASE + 1 + Number(n)).slice(-2)}`

// 最新赛季（第 50 季 = 2025-2026；同步工具每天维护这一季，ESPN 年份 − 1976 = 赛季号）
export const LATEST_SEASON = 50

export const seasonOptions = [
  // 最近 50 年、最新在前；老赛季未回补前显示空态
  ...Array.from({ length: LATEST_SEASON }, (_, i) => ({ value: LATEST_SEASON - i, label: seasonYearLabel(LATEST_SEASON - i) })),
  { value: CAREER_SEASON, label: '生涯场均' },
]

// 后端 BigDecimal 序列化成 20.100000 这样，统一格式化显示
export const fmtNum = (v, d = 1) => (v == null ? '-' : Number(v).toFixed(d))

// 命中率：库里存 0.453 小数，展示统一为 45.3%
export const fmtPct = (v, d = 1) => (v == null ? '-' : `${(Number(v) * 100).toFixed(d)}%`)

/* ===== NBA 现行两套场次资格线（只挡展示、不删数据）=====
 * 数据王/场均榜：出场 ≥ 球队场次 70%（82 场赛季 = 58 场）；
 * 荣誉评选（MVP/DPOY/最佳阵容/防阵/MIP）：≥65 场（以出场数近似"20 分钟有效出场"）；
 * 特例名单：官方批准参评的伤病豁免球员（2025-26：东契奇/坎宁安/文班亚马）。 */
export const STAT_QUALIFY_GAMES = 58
export const HONOR_QUALIFY_GAMES = 65
export const HONOR_EXEMPT_PLAYERS = new Set(['nba-3945274', 'nba-4432166', 'nba-5104157'])
export const statQualified = (r) => Number(r?.playerAppearance ?? 0) >= STAT_QUALIFY_GAMES
// 荣誉榜"以官方为准"：行上已带官方评选结果（MVP/DPOY 名次、入选阵容）的直接放行——
// 这些值本身来自官方公布（同步/手工录入），场次线只兜底没有官方结论的行
export const honorEligible = (r) =>
  r?.mvpRank != null || r?.dpoyRank != null || !!r?.allDbaTeam || !!r?.allDefTeam
  || Number(r?.playerAppearance ?? 0) >= HONOR_QUALIFY_GAMES || HONOR_EXEMPT_PLAYERS.has(r?.playerId)

/* 官方明确认定的数据王覆盖名单（回补历史赛季用）：若官方认定的得分王等
 * 按 58 场线会被挡掉，在此登记后无条件参榜——官方结论优先于推算。
 * 形如 { 12: { playerAvgScore: 'nba-1966' } }（第 12 季得分王=詹姆斯示例）。 */
export const OFFICIAL_STAT_LEADERS = {}

// 适用"补场计算"的场均项（得分/篮板/助攻/抢断/盖帽/上场时间王）
export const AVG_CROWN_FIELDS = new Set([
  'playerAvgScore', 'playerAvgReb', 'playerAvgAss', 'playerAvgSteal', 'playerAvgBlock', 'playingTime',
])

// 命中率榜不看场次、看命中数（NBA 官方门槛，82 场赛季）：投篮 300 中 / 三分 82 中 / 罚球 125 中
// ——不设的话低出手中锋会以 2 投 2 中 100% 霸榜
export const PCT_QUALIFY = {
  playerAccuracy: { madeField: 'playerAvgFgm', min: 300 },
  playerThreeAccuracy: { madeField: 'playerAvgTpm', min: 82 },
  playerFreethrowAccuracy: { madeField: 'playerAvgFtm', min: 125 },
}

/**
 * 榜单与名次共用同一个池子，全站只此一处规则——同一个「联盟第 N」在排行榜和资料卡上
 * 必须是同一个意思（曾经不是：字母哥投篮% 榜上第 6、资料卡第 40）。
 *
 * 两类门槛：
 *  · 命中率项（投篮%/三分%/罚球%）看**命中数**（300/82/125）——不设的话 3 投 3 中的人
 *    以 100% 霸榜；
 *  · 场均项看**场次 58 场**（球队场次 70%），外加 NBA 的补场规则：缺的场次全按 0 补满
 *    58 场后场均仍是联盟第一的，照样算数据王。
 *
 * 不在池子里的人：榜单里不出现，资料卡/对比页也不给名次，改标「场次不足 / 出手不足」。
 * 放开池子试过一版，结果是打 1-3 场的人霸占抢断榜和「失误最少」榜，比藏人更糟。
 */
export const boardPool = (rows, field, season) => {
  const all = rows || []
  let out
  const pctRule = PCT_QUALIFY[field]
  if (pctRule) {
    out = all.filter((r) => Number(r[pctRule.madeField] ?? 0) * Number(r.playerAppearance ?? 0) >= pctRule.min)
  } else {
    const ok = all.filter(statQualified)
    if (!AVG_CROWN_FIELDS.has(field)) {
      out = ok
    } else {
      const bestOk = ok.length ? Math.max(...ok.map((r) => Number(r[field] ?? 0))) : 0
      const padded = all.filter((r) => !statQualified(r)
        && (Number(r[field] ?? 0) * Number(r.playerAppearance ?? 0)) / STAT_QUALIFY_GAMES >= bestOk)
      out = all.filter((r) => statQualified(r) || padded.includes(r))
    }
  }
  const forcedId = season != null ? OFFICIAL_STAT_LEADERS[season]?.[field] : undefined
  if (forcedId && !out.some((r) => r.playerId === forcedId)) {
    const row = all.find((r) => r.playerId === forcedId)
    if (row) out = [...out, row]
  }
  return out
}

/** 这名球员在该项上有没有名次；没有就该显示「场次不足/出手不足」而不是一个数字 */
export const qualifiedFor = (rows, field, row) =>
  !!row?.playerId && boardPool(rows, field).some((r) => r.playerId === row.playerId)

/** 不达标的原因，决定标签文案 */
export const unqualifiedReason = (field) => (PCT_QUALIFY[field] ? '出手不足' : '场次不足')

/** 名次 = 池子里比他强的人数 + 1；asc 项（失误/犯规）越少越前 */
export const rankIn = (rows, field, value, asc) => {
  const pool = boardPool(rows, field)
  if (value == null || !pool.length) {
    return null
  }
  return 1 + pool.filter((r) => (asc ? Number(r[field] ?? 0) < value : Number(r[field] ?? 0) > value)).length
}

/** 榜单行：池子内按该项排序 */
export const qualifiedBoard = (rows, field, season) =>
  [...boardPool(rows, field, season)].sort((a, b) => Number(b[field] ?? 0) - Number(a[field] ?? 0))

// 命中/出手 成对显示，如 "10.2/19.5"（投篮、三分、罚球通用）
export const fmtPair = (made, att, d = 1) =>
  made == null && att == null ? '-' : `${fmtNum(made, d)}/${fmtNum(att, d)}`

// 篮板 = 总数(前场/后场)，如 "8.5(2.1/6.4)"；半角括号不换行，窄列一行放得下
export const fmtReb = (total, off, def) =>
  off == null && def == null ? fmtNum(total) : `${fmtNum(total)}(${fmtNum(off)}/${fmtNum(def)})`

// 交易链 'CHI->BOS' → 'CHI→BOS'：原样输出会在 '-' 处断成「CHI- >BOS」；替换所有箭头
// （.replace('->') 只换第一个，多次交易如 'MEM->PHI->BOS->GSW' 会漏）。默认箭头后垫
// 零宽空格，窄列只在队码边界换行；标签类宽松场合可传 ' → '。
export const fmtTeamChain = (v, sep = '\u2192\u200b') => String(v || '').split('->').join(sep)

// \u961f\u7801 \u2192 \u4e2d\u6587\u961f\u540d\uff08\u6570\u636e\u8868\u4e00\u5f8b\u663e\u793a\u4e2d\u6587\uff1b\u751f\u6daf\u6c47\u603b\u884c\u7684\u5360\u4f4d\u7b26 '/' \u4e0e\u8ba4\u4e0d\u51fa\u7684\u961f\u7801\u539f\u6837\u8f93\u51fa\uff09
export const teamZh = (code) => NBA_TEAM_NAMES[String(code ?? '').trim().toUpperCase()] || String(code ?? '')

// \u4ea4\u6613\u94fe\u7684\u4e2d\u6587\u7248\uff1a'CHI->BOS' \u2192 '\u516c\u725b\u2192\u51ef\u5c14\u7279\u4eba'\uff08\u7bad\u5934\u540e\u540c\u6837\u57ab\u96f6\u5bbd\u7a7a\u683c\uff0c\u7a84\u5217\u53ea\u5728\u961f\u540d\u8fb9\u754c\u65ad\u884c\uff09
export const fmtTeamChainZh = (v, sep = '\u2192\u200b') =>
  String(v || '').split('->').map((s) => teamZh(s)).join(sep)

// 季后赛成绩 → Tag 颜色（球队排行/球队页共用）
export const PLAYOFF_TAG = {
  总冠军: 'gold', 总决赛: 'volcano', 分区决赛: 'purple', 半决赛: 'geekblue', 首轮: 'cyan', 未进季后赛: 'default',
}

// 由「轮次 + 出战场次」反推季后赛胜负：每赢一轮 +4 胜（夺冠=16 胜），
// 剩余场次先记为止步轮的胜场（最多 3），其余是此前各轮输掉的场次。
export const playoffRecord = (result, games) => {
  const roundsWon = { 首轮: 0, 半决赛: 1, 分区决赛: 2, 总决赛: 3, 总冠军: 4 }[result]
  if (roundsWon == null || !games) return null
  if (result === '总冠军') return { wins: 16, losses: games - 16 }
  const rem = Math.max(0, games - 4 * roundsWon - 4)
  const wins = 4 * roundsWon + Math.min(3, rem)
  return { wins, losses: games - wins }
}

// 查某队所属的东西部与分区
export const teamRegion = (code) => {
  for (const [conf, divs] of Object.entries(NBA_STRUCTURE)) {
    for (const [div, teams] of Object.entries(divs)) {
      if (teams.includes(code)) return { conf, div }
    }
  }
  return {}
}

// 东西部与分区（球队排行的范围筛选用）
export const NBA_STRUCTURE = {
  东部: {
    大西洋赛区: ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'],
    中部赛区: ['CHI', 'CLE', 'DET', 'IND', 'MIL'],
    东南赛区: ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'],
  },
  西部: {
    西北赛区: ['DEN', 'MIN', 'OKC', 'POR', 'UTA'],
    太平洋赛区: ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'],
    西南赛区: ['DAL', 'HOU', 'MEM', 'NOP', 'SAS'],
  },
}

// NBA 30 队简写 → 中文名（球队卡片显示用；数据里的队码已规范化对齐）
export const NBA_TEAM_NAMES = {
  ATL: '老鹰', BOS: '凯尔特人', BKN: '篮网', CHA: '黄蜂', CHI: '公牛',
  CLE: '骑士', DAL: '独行侠', DEN: '掘金', DET: '活塞', GSW: '勇士',
  HOU: '火箭', IND: '步行者', LAC: '快船', LAL: '湖人', MEM: '灰熊',
  MIA: '热火', MIL: '雄鹿', MIN: '森林狼', NOP: '鹈鹕', NYK: '尼克斯',
  OKC: '雷霆', ORL: '魔术', PHI: '76人', PHX: '太阳', POR: '开拓者',
  SAC: '国王', SAS: '马刺', TOR: '猛龙', UTA: '爵士', WAS: '奇才',
}

/**
 * 联盟单项排行榜配置：每项一张卡。field=驼峰列名（须在 P3-1 排序白名单内），
 * digits=小数位（默认 1），order 默认 desc（防守效率越低越好用 asc），note 显示在卡片标题旁。
 */
export const RANKING_STATS = [
  { field: 'playerAvgScore', label: '得分' },
  { field: 'playerAvgReb', label: '篮板' },
  { field: 'playerAvgAss', label: '助攻' },
  { field: 'playerAvgSteal', label: '抢断' },
  { field: 'playerAvgBlock', label: '盖帽' },
  { field: 'playerAvgFgm', label: '场均投篮命中', note: '每场命中球数' },
  { field: 'playerAvgTpm', label: '场均三分命中', note: '每场命中三分数' },
  { field: 'playerAccuracy', label: '投篮%', pct: true },
  { field: 'playerThreeAccuracy', label: '三分%', pct: true },
  { field: 'playerFreethrowAccuracy', label: '罚球%', pct: true },
  { field: 'playingTime', label: '上场时间' },
  { field: 'playerAppearance', label: '出场', digits: 0 },
  { field: 'playerPer', label: '效率值', note: '得分+板+助+断+帽−打铁−失误' },
  { field: 'playerAvgTurnover', label: '失误', note: '场均最多' },
  { field: 'playerAvgPf', label: '犯规', note: '场均最多' },
]
