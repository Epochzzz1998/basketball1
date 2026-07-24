/** 球员数据模块共享配置：赛季选项、数字格式化、单项排行榜配置、NBA 队名映射 */

// 第 N 赛季 = (2007+N)-(2008+N)：第 1 赛季即 2008-2009 赛季
export const seasonYearLabel = (n) =>
  n === 50 ? '生涯场均' : `${2007 + Number(n)}-${2008 + Number(n)} 赛季`

// 数据表的赛季列用：只留年份后两位，如 2008-2009 → 08-09（生涯档=生涯）
export const seasonShort = (n) =>
  Number(n) === 50
    ? '生涯'
    : `${String(2007 + Number(n)).slice(-2)}-${String(2008 + Number(n)).slice(-2)}`

// 最新赛季（NBA 真实数据从第 18 季 = 2025-2026 起；同步工具每天维护这一季）
export const LATEST_SEASON = 18

export const seasonOptions = [
  // 最新在前，老赛季仍可选（没数据的显示空态）
  ...Array.from({ length: LATEST_SEASON }, (_, i) => ({ value: LATEST_SEASON - i, label: seasonYearLabel(LATEST_SEASON - i) })),
  { value: 50, label: '生涯场均' },
]

// 后端 BigDecimal 序列化成 20.100000 这样，统一格式化显示
export const fmtNum = (v, d = 1) => (v == null ? '-' : Number(v).toFixed(d))

// 命中/出手 成对显示，如 "10.2/19.5"（投篮、三分、罚球通用）
export const fmtPair = (made, att, d = 1) =>
  made == null && att == null ? '-' : `${fmtNum(made, d)}/${fmtNum(att, d)}`

// 篮板 = 总数（前场/后场），如 "8.5（2.1/6.4）"；无分项数据时只显示总数
export const fmtReb = (total, off, def) =>
  off == null && def == null ? fmtNum(total) : `${fmtNum(total)}（${fmtNum(off)}/${fmtNum(def)}）`

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
  { field: 'playerAccuracy', label: '投篮%', digits: 3 },
  { field: 'playerThreeAccuracy', label: '三分%', digits: 3 },
  { field: 'playerFreethrowAccuracy', label: '罚球%', digits: 3 },
  { field: 'playingTime', label: '上场时间' },
  { field: 'playerAppearance', label: '出场', digits: 0 },
  { field: 'playerPer', label: '效率值', note: '得分+板+助+断+帽−打铁−失误' },
  { field: 'playerAvgTurnover', label: '失误', note: '场均最多' },
]
