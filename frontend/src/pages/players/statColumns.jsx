import { Link } from 'react-router-dom'
import { fmtNum as num, fmtPair, fmtReb } from './rankConfig'

/**
 * 球员全量数据列（总览/球队页/荣誉完整数据页共用）。
 * serverSort=true 时对 P3-1 排序白名单内的列开启表头排序（服务端排序）；
 * 成对列（投篮/三分/罚球）与前后场分板不在白名单，不给排序。
 */
export function buildFullStatColumns({ serverSort = true } = {}) {
  const srt = serverSort ? { sorter: true } : {}
  return [
    {
      title: '球员', dataIndex: 'playerName', fixed: 'left', width: 110,
      render: (text, row) => <Link to={`/players/${row.playerId}`}>{text}</Link>,
    },
    { title: '球队', dataIndex: 'playerTeam', width: 100 },
    { title: '位置', dataIndex: 'playerPosition', width: 70 },
    { title: '出场', dataIndex: 'playerAppearance', width: 70, ...srt },
    { title: '先发', dataIndex: 'playerFrAppearance', width: 70, ...srt },
    { title: '替补', dataIndex: 'playerSrAppearance', width: 70, ...srt },
    { title: '时间', dataIndex: 'playingTime', width: 70, ...srt, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 80, ...srt, render: (v) => num(v) },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 130, ...srt,
      render: (_, r) => fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb),
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 80, ...srt, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 100, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 90, ...srt, render: (v) => num(v, 3) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 100, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 90, ...srt, render: (v) => num(v, 3) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 100, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 90, ...srt, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 70, ...srt, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 70, ...srt, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 70, ...srt, render: (v) => num(v) },
    { title: 'PER', dataIndex: 'playerPer', width: 70, ...srt, render: (v) => num(v) },
    { title: 'PIE', dataIndex: 'playerPie', width: 70, ...srt, render: (v) => num(v) },
    { title: 'WS', dataIndex: 'playerWs', width: 70, ...srt, render: (v) => num(v) },
    { title: '进攻效率', dataIndex: 'playerOffEff', width: 90, ...srt, render: (v) => num(v) },
    { title: '防守效率', dataIndex: 'playerDefEff', width: 90, ...srt, render: (v) => num(v) },
    { title: '净效率', dataIndex: 'playerNetEff', width: 80, ...srt, render: (v) => num(v) },
    { title: '正负值', dataIndex: 'playerAvgPn', width: 80, ...srt, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 70, ...srt },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 70, ...srt },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 90 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 90 },
  ]
}

export const FULL_COLUMNS_SCROLL_X = 2560
