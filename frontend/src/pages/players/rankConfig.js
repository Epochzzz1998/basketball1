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

/**
 * 最早的赛季：1946-47（BAA 元年，官方算作 NBA 历史的起点）。
 * 锚点没动过——公式仍是 (1975+n)-(1976+n)，所以 1976-77 依旧是第 1 季、2025-26 依旧是第 50 季，
 * 1976 年之前自然落到 0 和负数（1975-76 = 0，1946-47 = -29）。这样回补 30 个老赛季
 * 不用改动已有的 13 万行，也不用重建 STATS_ID。负数只是内部键，界面上永远显示年份。
 */
export const EARLIEST_SEASON = -29

export const seasonOptions = [
  // 全部 80 个赛季，最新在前
  ...Array.from({ length: LATEST_SEASON - EARLIEST_SEASON + 1 },
    (_, i) => ({ value: LATEST_SEASON - i, label: seasonYearLabel(LATEST_SEASON - i) })),
  { value: CAREER_SEASON, label: '生涯场均' },
]

/**
 * 全站统一的「没有数据」占位符。
 *
 * 用 Number.isFinite 而不是 `v == null` 来判断：`== null` 只挡得住 null 和 undefined，
 * 挡不住 NaN 和 Infinity。而 NaN 恰恰是最常见的来源——上游只要做过一次
 * `0/0`（比如战绩 0 胜 0 负算胜率）或者 `Number(undefined) - Number(x)`，
 * 结果就是 NaN，然后 `.toFixed()` 老老实实吐出字符串 "NaN" 显示在表格里。
 * 空串同理：`Number('')` 是 0，会把"没有值"显示成真实的 0。
 */
export const EMPTY = '-'

/** 任何非有限数（null / undefined / NaN / Infinity / 空串）都当作没有数据 */
export const numOrNull = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// 后端 BigDecimal 序列化成 20.100000 这样，统一格式化显示
export const fmtNum = (v, d = 1) => {
  const n = numOrNull(v)
  return n == null ? EMPTY : n.toFixed(d)
}

// 命中率：库里存 0.453 小数，展示统一为 45.3%
export const fmtPct = (v, d = 1) => {
  const n = numOrNull(v)
  return n == null ? EMPTY : `${(n * 100).toFixed(d)}%`
}

/** 带正负号的差值（如「较上季 +2.3」）。算不出来就给占位符，不要显示 "+NaN" */
export const fmtDelta = (v, d = 1) => {
  const n = numOrNull(v)
  return n == null ? EMPTY : `${n >= 0 ? '+' : ''}${n.toFixed(d)}`
}

/** 比率：分母为 0 或任一侧缺失都给占位符（0 胜 0 负不该显示 "NaN%"，也不该显示 "0.0%"） */
export const fmtRatio = (num, den, d = 1) => {
  const a = numOrNull(num), b = numOrNull(den)
  return a == null || !b ? EMPTY : `${((a / b) * 100).toFixed(d)}%`
}

/**
 * 由命中/出手现算命中率。单场数据库里只存命中和出手，没存命中率，两处
 * （球员逐场表、单场详情的 box score）都要算，所以放在这儿共用。
 *
 * 出手为 0 或该列根本不存在（1980 年前没有三分线，整列存 NULL）都给 '-'。
 * 不写 0.0%：那会把"这场没出手"显示成"投了全不中"，是两回事。
 */
export const fmtMadePct = (made, att, d = 1) => fmtRatio(made, att, d)

/* ===== NBA 现行两套场次资格线（只挡展示、不删数据）=====
 * 数据王/场均榜：出场 ≥ 球队场次 70%（82 场赛季 = 58 场）；
 * 荣誉评选（MVP/DPOY/最佳阵容/防阵/MIP）：≥65 场（以出场数近似"20 分钟有效出场"）；
 * 特例名单：官方批准参评的伤病豁免球员（2025-26：东契奇/坎宁安/文班亚马）。 */
export const STAT_QUALIFY_GAMES = 58   // 82 场赛季下的取值，仅作没有赛季上下文时的兜底
export const HONOR_QUALIFY_GAMES = 65
export const HONOR_EXEMPT_PLAYERS = new Set(['nba-3945274', 'nba-4432166', 'nba-5104157'])

/**
 * 这一季的球队场次，用当季最多出场数近似（被交易的人可能略多于球队场次，够用了）。
 * 拿不到行时退回 82。
 */
export const seasonGames = (rows) => {
  const max = Math.max(0, ...(rows || []).map((r) => Number(r?.playerAppearance ?? 0)))
  return max || 82
}

/**
 * 资格线 = 球队场次的 70%。规则本来就是这么定义的，58 只是 82 场赛季下的取值——
 * 写死 58 会让场次不同的赛季全部失真：
 *   · 1947-48 只打 48 场，58 场是 121%，**一个人都合格不了**
 *   · 1998-99 停摆季 50 场，实测合格人数为 0，那一季的排行榜一直是空的
 *   · 50 年代普遍 66-72 场，58 场相当于 81%-88%，只剩个位数的人
 * 按当季实际场次折算后分别是 34 / 35 / 47-51 场。
 * 取上整不是四舍五入：82 × 0.7 = 57.4，官方线是 58（向上取整），四舍五入会得到 57，
 * 等于把现有每一张榜单都悄悄挪一位。
 */
export const qualifyGamesOf = (rows) => Math.ceil(seasonGames(rows) * 0.7)

/** 无赛季上下文时的旧签名（82 场口径）；有 rows 就用 statQualifiedIn */
export const statQualified = (r) => Number(r?.playerAppearance ?? 0) >= STAT_QUALIFY_GAMES

/** 给定当季全部行，返回该季的「够不够场次」判定 */
export const statQualifiedIn = (rows) => {
  const line = qualifyGamesOf(rows)
  return (r) => Number(r?.playerAppearance ?? 0) >= line
}
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
 * 生涯档的资格线用官方生涯榜的口径，不是赛季口径。
 * 赛季那套「球队场次 70%」套到生涯汇总行上会算成 1622 × 70% = 1136 场——
 * 4832 名球员里只有 76 人过线，其余全被标成「场次不足」。
 * NBA 官方生涯榜：场均类要求 400 场；命中率类要求 2000 记投篮 / 250 记三分 / 1200 记罚球。
 */
export const CAREER_QUALIFY_GAMES = 400
export const CAREER_PCT_QUALIFY = {
  playerAccuracy: { madeField: 'playerAvgFgm', min: 2000 },
  playerThreeAccuracy: { madeField: 'playerAvgTpm', min: 250 },
  playerFreethrowAccuracy: { madeField: 'playerAvgFtm', min: 1200 },
}

/** 这批行是不是生涯汇总（seasonNum=99）。资料卡选「生涯」时拿到的就是这种池子 */
const isCareerPool = (rows) => (rows || []).some((r) => Number(r?.seasonNum) === CAREER_SEASON)

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
/**
 * 不设资格线的项。出场数本身就是资格线的度量——拿它给它自己设门槛是循环的：
 * 打了 30 场的人会被标成"场次不足"，可"出场 30 场"这个数字本身完全有效，
 * 而且这张榜的榜首按定义就是出场最多的人，根本不需要门槛。
 */
const NO_QUALIFY_FIELDS = new Set(['playerAppearance'])

export const boardPool = (rows, field, season, po = false) => {
  const all = rows || []
  if (NO_QUALIFY_FIELDS.has(field)) return all
  // 季后赛不设资格线：58 场、300 记投篮这些都是常规赛口径，季后赛最多打 28 场，
  // 套上去等于全员不合格——名次全没了，还会一律标成「场次不足」。
  // 联盟排行页早就绕开了（stage === 'po' 直接用原始列表），资料卡和对比页漏了。
  if (po) return all
  // 生涯汇总池：走官方生涯榜门槛，赛季那套折算在这里没有意义
  if (isCareerPool(all)) {
    const rule = CAREER_PCT_QUALIFY[field]
    return rule
      ? all.filter((r) => Number(r[rule.madeField] ?? 0) * Number(r.playerAppearance ?? 0) >= rule.min)
      : all.filter((r) => Number(r.playerAppearance ?? 0) >= CAREER_QUALIFY_GAMES)
  }
  let out
  // 门槛按当季实际场次折算（见 qualifyGamesOf）：命中数门槛同理按场次比例缩放，
  // 48 场的赛季要求 300 记投篮是不可能完成的
  const games = seasonGames(all)
  const qualifies = statQualifiedIn(all)
  const scale = games / 82
  const pctRule = PCT_QUALIFY[field]
  if (pctRule) {
    const min = pctRule.min * scale
    out = all.filter((r) => Number(r[pctRule.madeField] ?? 0) * Number(r.playerAppearance ?? 0) >= min)
  } else {
    const ok = all.filter(qualifies)
    if (!AVG_CROWN_FIELDS.has(field)) {
      out = ok
    } else {
      const line = qualifyGamesOf(all)
      const bestOk = ok.length ? Math.max(...ok.map((r) => Number(r[field] ?? 0))) : 0
      const padded = all.filter((r) => !qualifies(r)
        && (Number(r[field] ?? 0) * Number(r.playerAppearance ?? 0)) / line >= bestOk)
      out = all.filter((r) => qualifies(r) || padded.includes(r))
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
export const qualifiedFor = (rows, field, row, po = false) =>
  po || (!!row?.playerId && boardPool(rows, field, undefined, po).some((r) => r.playerId === row.playerId))

/**
 * 位置分组筛选：全站排行共用这一份。
 *
 * 库里的位置值是混的——既有细分的 PG/SG/SF/PF，也有本来就粗粒度的 G/F/C，
 * 另有少量 GF（摇摆人）和 NA。所以不做枚举映射，按「位置串里含不含这个字母」判断：
 * PG/SG/G/GF 都算后卫，SF/PF/F/GF 都算前锋，C 算中锋。GF 前后卫都算得上，
 * 这是筛选不是分桶，两边都出现反而合理；NA 哪一档都不进。
 */
export const POSITION_GROUPS = [
  { value: 'all', label: '全部' },
  { value: 'G', label: '后卫' },
  { value: 'F', label: '前锋' },
  { value: 'C', label: '中锋' },
]

export const inPositionGroup = (row, group) =>
  !group || group === 'all' || String(row?.playerPosition || '').toUpperCase().includes(group)

/** 按位置筛一批行（榜单先按资格线取池子，再筛位置——顺序反了会改变补场规则的基准） */
export const filterByPosition = (rows, group) =>
  !group || group === 'all' ? (rows || []) : (rows || []).filter((r) => inPositionGroup(r, group))


/**
 * 生涯总数的项：资料卡的生涯总数块、历史总榜、历史球员最小档案共用这一份。
 * 顺序参考主流数据站：先体量，再基础数据，最后投篮细项。
 * 打铁三项在后端是算式（出手 − 命中），不是真列。
 */
export const CAREER_TOTAL_STATS = [
  { key: 'g', label: '出场数' },
  { key: 'mp', label: '时间' },
  { key: 'pts', label: '得分' },
  { key: 'trb', label: '篮板' },
  { key: 'orb', label: '前场篮板' },
  { key: 'drb', label: '后场篮板' },
  { key: 'ast', label: '助攻' },
  { key: 'tov', label: '失误' },
  { key: 'stl', label: '抢断' },
  { key: 'blk', label: '盖帽' },
  { key: 'pf', label: '犯规' },
  { key: 'fga', label: '出手' },
  { key: 'fg', label: '进球' },
  { key: 'fgMiss', label: '打铁' },
  { key: 'fg3a', label: '三分出手' },
  { key: 'fg3', label: '三分命中' },
  { key: 'fg3Miss', label: '三分打铁' },
  { key: 'fta', label: '罚球次数' },
  { key: 'ft', label: '罚球命中' },
  { key: 'ftMiss', label: '罚球打铁' },
  { key: 'tplDbl', label: '三双' },
]

/** 整数带千分位（生涯总数动辄五位数，不分节读不出来） */
export const fmtTotal = (v) => (v == null ? '-' : Number(v).toLocaleString('en-US'))

/** 不达标的原因，决定标签文案 */
export const unqualifiedReason = (field) => (PCT_QUALIFY[field] ? '出手不足' : '场次不足')

/** 名次 = 池子里比他强的人数 + 1；asc 项（失误/犯规）越少越前 */
export const rankIn = (rows, field, value, asc, po = false) => {
  const pool = boardPool(rows, field, undefined, po)
  if (value == null || !pool.length) {
    return null
  }
  return 1 + pool.filter((r) => (asc ? Number(r[field] ?? 0) < value : Number(r[field] ?? 0) > value)).length
}

/** 池子里跟他同值的人数（>1 就是并列）。ORtg/DRtg 这类整数指标同分极多，
 *  只写「联盟第 3」会让人以为是独一份。 */
export const tiedCount = (rows, field, value, po = false) => {
  if (value == null) {
    return 0
  }
  return boardPool(rows, field, undefined, po).filter((r) => Number(r[field] ?? 0) === Number(value)).length
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
/**
 * 已消失的历史球队（1947-1955 为主）。这些队没有任何现役球队继承其历史，所以不能并进
 * NBA_TEAM_NAMES——那份是"现役 30 队"，球队卡片墙直接遍历它，混进来会多出 15 张死卡片。
 * 这里只供显示用（teamZh），点进去没有球队页是符合事实的：这些队真的不存在了。
 */
export const DEFUNCT_TEAM_NAMES = {
  BLB: '巴尔的摩子弹', WSC: '华盛顿国会', CHS: '芝加哥雄鹿', INO: '印城奥林匹亚',
  STB: '圣路易斯轰炸机', PRO: '普罗维登斯压路机', PIT: '匹兹堡铁人', DTF: '底特律猎鹰',
  SHE: '谢博伊根红皮', CLR: '克利夫兰反抗者', WAT: '滑铁卢老鹰', INJ: '印城喷气机',
  DNN: '丹佛掘金(1949)', TRH: '多伦多哈士奇', AND: '安德森包装工',
}

export const teamZh = (code) => {
  const c = String(code ?? '').trim().toUpperCase()
  return NBA_TEAM_NAMES[c] || DEFUNCT_TEAM_NAMES[c] || String(code ?? '')
}

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
 * 高阶数据的统一定义，排行榜、资料卡、数据表共用这一份。
 * pct=按百分比渲染（库里存 0-1 小数）；rate=已经是 0-100 的比率，后面直接加 %；
 * asc=越小越好（失误率、防守效率）。
 */
export const ADVANCED_STATS = [
  { field: 'playerPerReal', label: 'PER', note: '联盟平均 15' },
  { field: 'playerTsPct', label: '真实命中率', pct: true },
  { field: 'playerUsgPct', label: '使用率', rate: true },
  { field: 'playerOffEff', label: '进攻效率', digits: 0, note: '每百回合得分' },
  { field: 'playerDefEff', label: '防守效率', digits: 0, order: 'asc', asc: true, note: '越低越好' },
  { field: 'playerNetEff', label: '净效率', digits: 0 },
  { field: 'playerBpm', label: 'BPM', note: '每百回合高于联盟平均' },
  { field: 'playerObpm', label: '进攻BPM' },
  { field: 'playerDbpm', label: '防守BPM' },
  { field: 'playerVorp', label: 'VORP', note: '相对替补级球员的价值' },
  { field: 'playerWs', label: '胜利贡献' },
  { field: 'playerOws', label: '进攻胜利贡献' },
  { field: 'playerDws', label: '防守胜利贡献' },
  { field: 'playerWs48', label: 'WS/48', digits: 3 },
  { field: 'playerOrbPct', label: '前板率', rate: true },
  { field: 'playerDrbPct', label: '后板率', rate: true },
  { field: 'playerTrbPct', label: '篮板率', rate: true },
  { field: 'playerAstPct', label: '助攻率', rate: true },
  { field: 'playerStlPct', label: '抢断率', rate: true },
  { field: 'playerBlkPct', label: '盖帽率', rate: true },
  { field: 'playerTovPct', label: '失误率', rate: true, order: 'asc', asc: true, note: '越低越好' },
]

/**
 * 只用于深链、不在单项排行页出卡片的项。资料卡的名次胶囊会跳到 /rankings/:field，
 * 那一页要拿 label 做标题；这三项加进 RANKING_STATS 会凭空多出三张排行卡，
 * 所以单列一份。
 */
export const DRILL_ONLY_STATS = [
  { field: 'playerAvgFga', label: '场均投篮出手' },
  { field: 'playerAvgTpa', label: '场均三分出手' },
  { field: 'playerAvgFta', label: '场均罚球出手' },
]

/** 高阶数据缺失时的占位。生涯汇总行没有高阶指标（B-R 只按赛季发布，不发生涯合计），
 *  1976-77 也没有效率值。空着比写 0 诚实——0 会被当成"真的是 0"。 */
export const ADV_EMPTY = '/'

/** 高阶值的显示：小数百分比 → 45.3%；0-100 比率 → 19.6%；其余按位数。
 *  null / 空串 / 非数都归到占位符，别让 NaN 漏到界面上 */
export const fmtAdv = (v, s) => {
  const n = numOrNull(v)
  if (n == null) return ADV_EMPTY
  return s.pct ? fmtPct(n) : s.rate ? `${n.toFixed(1)}%` : fmtNum(n, s.digits ?? 1)
}

/**
 * 联盟单项排行榜配置：每项一张卡。field=驼峰列名（须在 P3-1 排序白名单内），
 * digits=小数位（默认 1），order 默认 desc（防守效率越低越好用 asc），note 显示在卡片标题旁。
 */
export const RANKING_STATS = [
  { field: 'playerAvgScore', label: '得分' },
  { field: 'playerAvgReb', label: '篮板' },
  { field: 'playerAvgOffReb', label: '前场篮板' },
  { field: 'playerAvgDefReb', label: '后场篮板' },
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
  // 正负值只有季后赛有（赛季级别的数据源没有，逐场累加目前只覆盖季后赛）
  { field: 'playerAvgPn', label: '正负值', poOnly: true, note: '仅季后赛' },
]
