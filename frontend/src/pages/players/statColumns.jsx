import { Link } from 'react-router-dom'
import { fmtNum as num, fmtPair, fmtPct, ADVANCED_STATS, fmtAdv } from './rankConfig'
import { TeamNames } from '../../components/TeamLogo'
import { withGlossary } from './statGlossary'

/**
 * 球员全量数据列（总览/球队页/荣誉完整数据页共用）。
 * 表头一律不带排序（排序箭头会把"首发/出场"这类表头挤到换行，PC 移动端都去掉；
 * 排行需求走「联盟排行/完整排行」页）。serverSort 参数保留只为兼容旧调用。
 */
export function buildFullStatColumns({ serverSort = true } = {}) {
  const srt = {}
  // 列宽尽量收窄（不压文字）方便移动端一屏多看；出场两列合成「首发/出场」。
  return [
    {
      title: '球员', dataIndex: 'playerName', fixed: 'left', width: 96,
      // 带上该行的赛季：从任何一张按赛季组织的表点进去，资料卡都停在同一个赛季
      // （生涯汇总行的 seasonNum 是 99，点过去正好落在生涯档）
      render: (text, row) => (
        <Link to={`/players/${row.playerId}${row.seasonNum != null ? `?seasonNum=${row.seasonNum}` : ''}`}>{text}</Link>
      ),
    },
    { title: '球队', dataIndex: 'playerTeam', width: 78, render: (v) => <TeamNames value={v} /> },
    { title: '位置', dataIndex: 'playerPosition', width: 46 },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 80, ...srt, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 48, ...srt, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 48, ...srt, render: (v) => num(v) },
    { title: '篮板', dataIndex: 'playerAvgReb', width: 48, ...srt, render: (v) => num(v) },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 48, ...srt, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 88, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 56, ...srt, render: (v) => fmtPct(v) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 88, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 56, ...srt, render: (v) => fmtPct(v) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 88, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 56, ...srt, render: (v) => fmtPct(v) },
    // 前后场篮板独立成列（原来挤在篮板列里写成 "8.5(2.1/6.4)"，窄列很难读）
    { title: '前板', dataIndex: 'playerAvgOffReb', width: 48, ...srt, render: (v) => num(v) },
    { title: '后板', dataIndex: 'playerAvgDefReb', width: 48, ...srt, render: (v) => num(v) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 48, ...srt, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 48, ...srt, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 48, ...srt, render: (v) => num(v) },
    { title: '犯规', dataIndex: 'playerAvgPf', width: 48, ...srt, render: (v) => num(v) },
    { title: '效率值', dataIndex: 'playerPer', width: 78, ...srt, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 50, ...srt },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 56, ...srt },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 72 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 72 },
  ]
}

/**
 * 一段文字在给定字号下的估算宽度：中文一个 em，大写字母 0.75 em，其余（数字/小写/符号）
 * 0.62 em。大写单独算是因为 W、M 这些明显更宽——'WS/48' 一度按 0.62 估成 48px 而折行。
 */
const textWidth = (s, em) =>
  Math.ceil([...s].reduce((w, c) => w + em * (/[一-鿿]/.test(c) ? 1 : /[A-Z]/.test(c) ? 0.75 : 0.62), 0))

/**
 * 表头文字需要的列宽。原来高阶列按 `label.length` 分档，但中文字宽差不多是拉丁字母的
 * 一倍，「进攻胜利贡献」（6 字）和「WS/48」（5 字）按字数算落在同一档，结果前者必折行。
 */
export const headerWidth = (label, em, pad) => textWidth(label, em) + pad

/**
 * 高阶列宽 = max(表头宽, 数值宽)。「使用率」只有 3 个字，但格子里要放 "100.0%"
 * 六个字符——瓶颈在数值不在表头，只按标签算百分比就会换行。
 * 下限 48 只在这儿加：逐场表那些 40px 的整数列不该被这个下限顶宽。
 */
export const advColWidth = (a, em, pad) =>
  Math.max(48, headerWidth(a.label, em, pad), textWidth(a.pct || a.rate ? '100.0%' : '-12.3', em) + pad)

/** 桌面端 14px 字号 + 左右各 6px 内边距（.stat-compact 的规则） */
const advWidth = (a) => advColWidth(a, 14, 14)

/**
 * 高阶数据列。基础表已经 20+ 列，再把 20 个高阶指标并进去就没法看了，
 * 所以拆成两组、由页面上的「基础 / 高阶」开关切换（AllPlayerSeasonStats、生涯表都接了）。
 */
export function buildAdvancedStatColumns({ po = false } = {}) {
  return withGlossary([
    {
      title: '球员', dataIndex: 'playerName', fixed: 'left', width: 96,
      render: (text, row) => (
        <Link to={`/players/${row.playerId}${row.seasonNum != null ? `?seasonNum=${row.seasonNum}` : ''}`}>{text}</Link>
      ),
    },
    { title: '球队', dataIndex: 'playerTeam', width: 78, render: (v) => <TeamNames value={v} /> },
    // 出场场次不在这儿重复——基础表已经有「首发/出场」。时间留着：使用率、篮板率
    // 这些率值得配上场时间才读得懂
    { title: '时间', dataIndex: 'playingTime', width: 48, render: (v) => num(v) },
    ...(po ? [{ title: '正负值', dataIndex: 'playerAvgPn', width: 62, render: (v) => num(v) }] : []),
    ...ADVANCED_STATS.map((a) => ({
      title: a.label,
      dataIndex: a.field,
      width: advWidth(a),
      render: (v) => fmtAdv(v, a),
    })),
  ])
}


/* ===== 接口列裁剪：告诉后端"我只渲染这些列" =====
 * 字段表从列定义推导，不另手写一份——手写的那份迟早跟列定义脱节，而脱节的表现是
 * 某一列静默变成 "-"（后端没返回），排查起来像数据出了问题。 */

// 少数列除了自己的 dataIndex 还要读别的字段：成对列（命中/出手）、首发/出场
const COLUMN_EXTRA_FIELDS = {
  playerAvgFgm: ['playerAvgFga'],
  playerAvgTpm: ['playerAvgTpa'],
  playerAvgFtm: ['playerAvgFta'],
  playerAppearance: ['playerFrAppearance'],
}

/** 一组列真正要读的字段（含成对列的伴随字段） */
export const fieldsOfColumns = (cols) => [...new Set(
  cols.flatMap((c) => [c.dataIndex, ...(COLUMN_EXTRA_FIELDS[c.dataIndex] || [])]).filter(Boolean),
)]

/**
 * 不出现在表里、但前端逻辑要用的字段：位置（位置筛选）和出场（58 场资格线）。
 * 高阶视图的列里两个都没有——漏掉的话资格线会把所有人判成不合格、位置筛选一个人都留不下，
 * 而且是静默的（表格照常渲染，只是空了）。
 */
const LOGIC_FIELDS = ['playerPosition', 'playerAppearance']

/** 数据表两种视图各自要的字段（榜单页、球队名单、完整排行共用） */
export const BASIC_TABLE_FIELDS = [...new Set([...fieldsOfColumns(buildFullStatColumns()), ...LOGIC_FIELDS])].join(',')
export const ADVANCED_TABLE_FIELDS = [...new Set([...fieldsOfColumns(buildAdvancedStatColumns({ po: true })), ...LOGIC_FIELDS])].join(',')

/**
 * 排行卡要的字段：身份 + 位置（筛选）+ 出场（资格线）+ 所排的那一项。
 * 命中率项的资格线看命中数，所以要把对应的命中数列一起带上——漏了它资格线会
 * 把所有人都判成出手不足。
 */
const PCT_MADE_FIELD = {
  playerAccuracy: 'playerAvgFgm',
  playerThreeAccuracy: 'playerAvgTpm',
  playerFreethrowAccuracy: 'playerAvgFtm',
}

export const rankCardFields = (field) => [...new Set([
  'playerTeam', 'playerPosition', 'playerAppearance', field, PCT_MADE_FIELD[field],
].filter(Boolean))].join(',')

export const FULL_COLUMNS_SCROLL_X = 2034

/* ===== 移动端紧凑表格 =====
 * 手机上全量表横向太长、频繁横滑：紧凑列宽（12px 字号下正好不挤）配合
 * index.css 里 .stat-compact 的字号/内边距媒体查询，一屏约多看 40% 的列。 */
const COMPACT_W = {
  // 首发/出场 74：生涯行最长 "1620/1622" 12px 下不换行；篮板/前板/后板各自独立成列后只放一个数；
  // 投篮/三分/罚球 74：最长 "11.5/23.2" 一行（62 会折行）；
  // 球队 66：中文队名最长四字（凯尔特人），12px 下 48px 加内边距，52 会折行；
  // 三个百分比列 56：满命中率 "100.0%" 六字符，50 会把它挤到第二行
  playerName: 86, playerTeam: 66, oppTeam: 66, playerPosition: 36, playerAppearance: 74, playingTime: 42,
  playerAvgScore: 42, playerAvgReb: 42, playerAvgOffReb: 42, playerAvgDefReb: 42, playerAvgAss: 42, playerAvgFgm: 74, playerAccuracy: 56,
  playerAvgTpm: 74, playerThreeAccuracy: 56, playerAvgFtm: 74, playerFreethrowAccuracy: 56,
  playerAvgBlock: 42, playerAvgSteal: 42, playerAvgTurnover: 42, playerAvgPf: 42, playerPer: 46,
  mvpRank: 42, dpoyRank: 46, allDbaTeam: 58, allDefTeam: 58, seasonNum: 60, playoffResult: 76,
  // 逐场数据表（单场 box score）：都是整数，比场均窄；结果列要放下「胜 105-95」
  gameDate: 60, round: 60, win: 78, starter: 40, pts: 40, reb: 40, offReb: 40, defReb: 40, ast: 40,
  fgm: 56, tpm: 56, ftm: 56, stl: 40, blk: 40, tov: 40, pf: 40, plusMinus: 46,
  playerAvgPn: 50,
  // 高阶列按标签和数值实际字形算（12px 字号、左右各 5px 内边距），别再统一乘 0.72——
  // 那样「进攻胜利贡献」只剩 62px，六个汉字铁定折行
  ...Object.fromEntries(ADVANCED_STATS.map((a) => [a.field, advColWidth(a, 12, 10)])),
}

/** 列表 → 紧凑列表：命中紧凑表的用表值，其余按 0.72 收缩（下限 40）；
 * 同时去掉表头排序（窄列里排序箭头和标题文字重叠，移动端排序一律砍掉） */
export const compactColumns = (cols) =>
  cols.map(({ sorter, sortOrder, defaultSortOrder, ...c }) => {
    const w = COMPACT_W[c.dataIndex] ?? Math.max(40, Math.round((c.width || 60) * 0.72))
    // 表头文字比给定宽度还长就以文字为准。pts/reb/ast 这些 dataIndex 被逐场表（标题
    // 「得分」）和球队排行（标题「场均得分」）共用，按前者调窄会把后者压折行
    return { ...c, width: typeof c.title === 'string' ? Math.max(w, headerWidth(c.title, 12, 10)) : w }
  })

/** 横向滚动宽度 = 列宽求和（列随紧凑与否变化，滚动宽度跟着算） */
export const sumColWidth = (cols) => cols.reduce((s, c) => s + (c.width || 0), 0)

// 季后赛表用：荣誉四列（MVP/DPOY/最佳阵容/最佳防守）是常规赛评选，季后赛数据里无意义
export const HONOR_COLUMN_KEYS = ['mvpRank', 'dpoyRank', 'allDbaTeam', 'allDefTeam']
// 常规赛表用：正负值只有季后赛有数据（1997 起），常规赛视图整列去掉
export const PLAYOFF_ONLY_COLUMN_KEYS = ['playerAvgPn']
export const PLAYOFF_COLUMNS_SCROLL_X = FULL_COLUMNS_SCROLL_X - 272
