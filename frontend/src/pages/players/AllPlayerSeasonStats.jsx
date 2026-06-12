import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Select, Space } from 'antd'
import { Link } from 'react-router-dom'
import { playerApi } from '../../api/player'

// 把后端的数字（BigDecimal 序列化成 20.100000 这样）格式化显示
const num = (v, d = 1) => (v == null ? '-' : Number(v).toFixed(d))

const seasonOptions = [
  ...Array.from({ length: 16 }, (_, i) => ({ value: i + 1, label: `第 ${i + 1} 赛季` })),
  { value: 50, label: '生涯场均' },
]

/**
 * 全体球员某赛季数据榜（公开）。替代原 all-player-season-stats.ftl。
 * 用 ProTable：它的 request 回调把"分页/排序"翻译成后端参数（page/limit/field/order），
 * 排序直连 P3-1 的白名单排序（dataIndex 即驼峰列名）。
 */
export default function AllPlayerSeasonStats() {
  const [seasonNum, setSeasonNum] = useState(1)

  const columns = [
    {
      title: '球员', dataIndex: 'playerName', fixed: 'left', width: 110,
      render: (text, row) => <Link to={`/players/${row.playerId}`}>{text}</Link>,
    },
    { title: '球队', dataIndex: 'playerTeam', width: 100 },
    { title: '位置', dataIndex: 'playerPosition', width: 70 },
    { title: '出场', dataIndex: 'playerAppearance', width: 70, sorter: true },
    { title: '得分', dataIndex: 'playerAvgScore', width: 80, sorter: true, render: (v) => num(v) },
    { title: '篮板', dataIndex: 'playerAvgReb', width: 80, sorter: true, render: (v) => num(v) },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 80, sorter: true, render: (v) => num(v) },
    { title: '命中率', dataIndex: 'playerAccuracy', width: 90, sorter: true, render: (v) => num(v, 3) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 90, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 70, sorter: true, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 70, render: (v) => num(v) },
    { title: 'PER', dataIndex: 'playerPer', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'WS', dataIndex: 'playerWs', width: 70, sorter: true, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 70 },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 90 },
  ]

  return (
    <ProTable
      headerTitle="球员赛季数据榜"
      rowKey="statsId"
      columns={columns}
      params={{ seasonNum }}        /* 改变它会自动重新请求 */
      search={false}
      scroll={{ x: 1180 }}
      options={false}
      toolBarRender={() => [
        <Space key="season">
          赛季：
          <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions} style={{ width: 130 }} />
        </Space>,
      ]}
      pagination={{ pageSize: 10 }}
      request={async (params, sort) => {
        const sortKey = Object.keys(sort || {})[0] // 当前排序列（驼峰名）
        const res = await playerApi.listSeasonStats({
          page: params.current,
          limit: params.pageSize,
          seasonNum: params.seasonNum,
          field: sortKey,
          order: sortKey ? (sort[sortKey] === 'ascend' ? 'asc' : 'desc') : undefined,
        })
        // 拦截器已把 Result 拆成 {total, records}
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
    />
  )
}
