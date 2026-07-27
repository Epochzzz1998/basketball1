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
    { title: '效率值EFF', dataIndex: 'playerPer', width: 78, ...srt, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 50, ...srt },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 56, ...srt },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 72 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 72 },
  ]
}

/**
 * 高阶列的表头宽度。原来按 `label.length` 分档，但中文字宽差不多是拉丁字母的一倍，
 * 「进攻胜利贡献」（6 字）和「WS/48」（5 字）按字数算是同一档，结果前者必定折行。
 * 改成按字形估：中文算一个 em，拉丁/数字/斜杠算 0.62 em，再加两侧内边距。
 * 下限 46 是给数值留的（"-2.3"、"0.123" 这类比表头还宽）。
 */
export const headerWidth = (label, em, pad) =>
  Math.max(46, Math.ceil([...label].reduce((w, c) => w + (/[一-鿿]/.test(c) ? em : em * 0.62), 0)) + pad)

/** 桌面端 14px 字号 + 左右各 6px 内边距（.stat-compact 的规则） */
const advWidth = (label) => headerWidth(label, 14, 14)

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
      width: advWidth(a.label),
      render: (v) => fmtAdv(v, a),
    })),
  ])
}

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
  mvpRank: 42, dpoyRank: 46, allDbaTeam: 58, allDefTeam: 58, seasonNum: 52, playoffResult: 76,
  // 逐场数据表（单场 box score）：都是整数，比场均窄；结果列要放下「胜 105-95」
  gameDate: 60, round: 60, win: 78, starter: 40, pts: 40, reb: 40, offReb: 40, defReb: 40, ast: 40,
  fgm: 56, tpm: 56, ftm: 56, stl: 40, blk: 40, tov: 40, pf: 40, plusMinus: 46,
  playerAvgPn: 50,
  // 高阶列按标签实际字形算（12px 字号、左右各 5px 内边距），别再统一乘 0.72——
  // 那样「进攻胜利贡献」只剩 62px，六个汉字铁定折行
  ...Object.fromEntries(ADVANCED_STATS.map((a) => [a.field, headerWidth(a.label, 12, 10)])),
}

// 移动端表头省字：桌面写「效率值EFF」是为了跟真实 PER 区分开，手机上那三个字母
// 只是把列撑宽，去掉不影响理解（要查区别有「指标说明」）
const COMPACT_TITLE = { playerPer: '效率值' }

/** 列表 → 紧凑列表：命中紧凑表的用表值，其余按 0.72 收缩（下限 40）；
 * 同时去掉表头排序（窄列里排序箭头和标题文字重叠，移动端排序一律砍掉） */
export const compactColumns = (cols) =>
  cols.map(({ sorter, sortOrder, defaultSortOrder, ...c }) => ({
    ...c,
    title: COMPACT_TITLE[c.dataIndex] ?? c.title,
    width: COMPACT_W[c.dataIndex] ?? Math.max(40, Math.round((c.width || 60) * 0.72)),
  }))

/** 横向滚动宽度 = 列宽求和（列随紧凑与否变化，滚动宽度跟着算） */
export const sumColWidth = (cols) => cols.reduce((s, c) => s + (c.width || 0), 0)

// 季后赛表用：荣誉四列（MVP/DPOY/最佳阵容/最佳防守）是常规赛评选，季后赛数据里无意义
export const HONOR_COLUMN_KEYS = ['mvpRank', 'dpoyRank', 'allDbaTeam', 'allDefTeam']
// 常规赛表用：正负值只有季后赛有数据（1997 起），常规赛视图整列去掉
export const PLAYOFF_ONLY_COLUMN_KEYS = ['playerAvgPn']
export const PLAYOFF_COLUMNS_SCROLL_X = FULL_COLUMNS_SCROLL_X - 272
