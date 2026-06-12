import { ProTable } from '@ant-design/pro-components'
import { useParams, Link } from 'react-router-dom'
import { Button, Space } from 'antd'
import { playerApi } from '../../api/player'

const num = (v, d = 1) => (v == null ? '-' : Number(v).toFixed(d))
const seasonLabel = (s) => (s === 50 ? '生涯' : s)

/**
 * 单个球员的生涯逐季数据（公开）。替代原 player-stats-list.ftl。
 * playerId 来自路由参数 /players/:playerId。
 */
export default function PlayerCareer() {
  const { playerId } = useParams()

  const columns = [
    { title: '赛季', dataIndex: 'seasonNum', width: 70, fixed: 'left', sorter: true, render: seasonLabel },
    { title: '球队', dataIndex: 'playerTeam', width: 100 },
    { title: '位置', dataIndex: 'playerPosition', width: 70 },
    { title: '出场', dataIndex: 'playerAppearance', width: 70 },
    { title: '得分', dataIndex: 'playerAvgScore', width: 70, sorter: true, render: (v) => num(v) },
    { title: '篮板', dataIndex: 'playerAvgReb', width: 70, sorter: true, render: (v) => num(v) },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 70, sorter: true, render: (v) => num(v) },
    { title: '命中率', dataIndex: 'playerAccuracy', width: 80, render: (v) => num(v, 3) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 80, render: (v) => num(v, 3) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 80, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 70, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 70, render: (v) => num(v) },
    { title: 'PER', dataIndex: 'playerPer', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'WS', dataIndex: 'playerWs', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 70 },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 70 },
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
        scroll={{ x: 1300 }}
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
