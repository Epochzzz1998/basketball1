import { ProTable } from '@ant-design/pro-components'
import { useParams, Link } from 'react-router-dom'
import { Button, Space } from 'antd'
import { playerApi } from '../../api/player'
import { fmtNum as num, fmtPair, fmtReb, seasonYearLabel } from './rankConfig'

const seasonLabel = (s) => (s === 50 ? '生涯' : seasonYearLabel(s))

/**
 * 单个球员的生涯逐季数据（公开）。替代原 player-stats-list.ftl。
 * playerId 来自路由参数 /players/:playerId。
 */
export default function PlayerCareer() {
  const { playerId } = useParams()

  const columns = [
    { title: '赛季', dataIndex: 'seasonNum', width: 130, fixed: 'left', sorter: true, render: seasonLabel },
    { title: '球队', dataIndex: 'playerTeam', width: 100 },
    { title: '位置', dataIndex: 'playerPosition', width: 70 },
    { title: '出场', dataIndex: 'playerAppearance', width: 70, sorter: true },
    { title: '先发', dataIndex: 'playerFrAppearance', width: 70, sorter: true },
    { title: '替补', dataIndex: 'playerSrAppearance', width: 70, sorter: true },
    { title: '时间', dataIndex: 'playingTime', width: 70, sorter: true, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 70, sorter: true, render: (v) => num(v) },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 130, sorter: true,
      render: (_, r) => fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb),
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 70, sorter: true, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 100, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 80, render: (v) => num(v, 3) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 100, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 80, render: (v) => num(v, 3) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 100, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 80, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 70, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 70, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'PER', dataIndex: 'playerPer', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'PIE', dataIndex: 'playerPie', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'WS', dataIndex: 'playerWs', width: 70, sorter: true, render: (v) => num(v) },
    { title: '进攻效率', dataIndex: 'playerOffEff', width: 90, sorter: true, render: (v) => num(v) },
    { title: '防守效率', dataIndex: 'playerDefEff', width: 90, sorter: true, render: (v) => num(v) },
    { title: '净效率', dataIndex: 'playerNetEff', width: 80, sorter: true, render: (v) => num(v) },
    { title: '正负值', dataIndex: 'playerAvgPn', width: 80, sorter: true, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 70, sorter: true },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 70, sorter: true },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 90 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 90 },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Link to="/players"><Button>← 返回赛季榜</Button></Link>
      </Space>
      <ProTable
        headerTitle="生涯逐季数据"
        rowKey="statsId"
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: 2620 }}
        pagination={{ pageSize: 20 }}
        request={async (params, sort) => {
          const sortKey = Object.keys(sort || {})[0]
          const res = await playerApi.listPlayerCareer({
            playerId,
            page: params.current,
            limit: params.pageSize,
            field: sortKey,
            order: sortKey ? (sort[sortKey] === 'ascend' ? 'asc' : 'desc') : undefined,
          })
          return { data: res.records || [], total: res.total || 0, success: true }
        }}
      />
    </>
  )
}
