import { Link } from 'react-router-dom'
import { fmtNum as num, fmtPair, fmtReb } from './rankConfig'

/**
 * 球员全量数据列（总览/球队页/荣誉完整数据页共用）。
 * serverSort=true 时对 P3-1 排序白名单内的列开启表头排序（服务端排序）；
 * 成对列（投篮/三分/罚球）与前后场分板不在白名单，不给排序。
 */
export function buildFullStatColumns({ serverSort = true } = {}) {
  const srt = serverSort ? { sorter: true } : {}
  // 列宽尽量收窄（不压文字）方便移动端一屏多看；出场两列合成「首发/出场」。
  return [
    {
      title: '球员', dataIndex: 'playerName', fixed: 'left', width: 100,
      render: (text, row) => <Link to={`/players/${row.playerId}`}>{text}</Link>,
    },
    { title: '球队', dataIndex: 'playerTeam', width: 72 },
    { title: '位置', dataIndex: 'playerPosition', width: 60 },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 82, ...srt, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 60, ...srt, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 62, ...srt, render: (v) => num(v) },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 120, ...srt,
      render: (_, r) => fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb),
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 60, ...srt, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 86, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 68, ...srt, render: (v) => num(v, 3) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 86, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 68, ...srt, render: (v) => num(v, 3) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 86, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 68, ...srt, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 58, ...srt, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 58, ...srt, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 58, ...srt, render: (v) => num(v) },
    { title: '效率值', dataIndex: 'playerPer', width: 58, ...srt, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 58, ...srt },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 62, ...srt },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 76 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 76 },
  ]
}

export const FULL_COLUMNS_SCROLL_X = 1990

// 季后赛表用：荣誉四列（MVP/DPOY/最佳阵容/最佳防守）是常规赛评选，季后赛数据里无意义
export const HONOR_COLUMN_KEYS = ['mvpRank', 'dpoyRank', 'allDbaTeam', 'allDefTeam']
export const PLAYOFF_COLUMNS_SCROLL_X = FULL_COLUMNS_SCROLL_X - 272
