import { Link } from 'react-router-dom'
import { fmtNum as num, fmtPair, fmtPct, fmtReb } from './rankConfig'
import { TeamNames } from '../../components/TeamLogo'

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
      render: (text, row) => <Link to={`/players/${row.playerId}`}>{text}</Link>,
    },
    { title: '球队', dataIndex: 'playerTeam', width: 78, render: (v) => <TeamNames value={v} /> },
    { title: '位置', dataIndex: 'playerPosition', width: 46 },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 80, ...srt, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 48, ...srt, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 48, ...srt, render: (v) => num(v) },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 112, ...srt,
      // nowrap：名字长换行把行撑高时，前后场拆分不许跟着折行
      render: (_, r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb)}</span>,
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 48, ...srt, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 88, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 56, ...srt, render: (v) => fmtPct(v) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 88, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 56, ...srt, render: (v) => fmtPct(v) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 88, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 56, ...srt, render: (v) => fmtPct(v) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 48, ...srt, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 48, ...srt, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 48, ...srt, render: (v) => num(v) },
    { title: '效率值', dataIndex: 'playerPer', width: 58, ...srt, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 50, ...srt },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 56, ...srt },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 72 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 72 },
  ]
}

export const FULL_COLUMNS_SCROLL_X = 2004

/* ===== 移动端紧凑表格 =====
 * 手机上全量表横向太长、频繁横滑：紧凑列宽（12px 字号下正好不挤）配合
 * index.css 里 .stat-compact 的字号/内边距媒体查询，一屏约多看 40% 的列。 */
const COMPACT_W = {
  // 首发/出场 74：生涯行最长 "1620/1622" 12px 下不换行；篮板 94：最长 "18.7(6.4/12.3)" 一行；
  // 投篮/三分/罚球 74：最长 "11.5/23.2" 一行（62 会折行）；
  // 球队 66：中文队名最长四字（凯尔特人），12px 下 48px 加内边距，52 会折行
  playerName: 86, playerTeam: 66, playerPosition: 36, playerAppearance: 74, playingTime: 42,
  playerAvgScore: 42, playerAvgReb: 94, playerAvgAss: 42, playerAvgFgm: 74, playerAccuracy: 50,
  playerAvgTpm: 74, playerThreeAccuracy: 50, playerAvgFtm: 74, playerFreethrowAccuracy: 50,
  playerAvgBlock: 42, playerAvgSteal: 42, playerAvgTurnover: 42, playerPer: 46,
  mvpRank: 42, dpoyRank: 46, allDbaTeam: 58, allDefTeam: 58, seasonNum: 52, playoffResult: 76,
}

/** 列表 → 紧凑列表：命中紧凑表的用表值，其余按 0.72 收缩（下限 40）；
 * 同时去掉表头排序（窄列里排序箭头和标题文字重叠，移动端排序一律砍掉） */
export const compactColumns = (cols) =>
  cols.map(({ sorter, sortOrder, defaultSortOrder, ...c }) => ({
    ...c, width: COMPACT_W[c.dataIndex] ?? Math.max(40, Math.round((c.width || 60) * 0.72)),
  }))

/** 横向滚动宽度 = 列宽求和（列随紧凑与否变化，滚动宽度跟着算） */
export const sumColWidth = (cols) => cols.reduce((s, c) => s + (c.width || 0), 0)

// 季后赛表用：荣誉四列（MVP/DPOY/最佳阵容/最佳防守）是常规赛评选，季后赛数据里无意义
export const HONOR_COLUMN_KEYS = ['mvpRank', 'dpoyRank', 'allDbaTeam', 'allDefTeam']
export const PLAYOFF_COLUMNS_SCROLL_X = FULL_COLUMNS_SCROLL_X - 272
