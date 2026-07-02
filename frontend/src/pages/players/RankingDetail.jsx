import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button, Select, Space } from 'antd'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { RANKING_STATS, fmtNum, seasonOptions } from './rankConfig'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

/** 某数据项的完整排行（/rankings/:field），按该项降序，不分页一滚到底 */
export default function RankingDetail() {
  const { field } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const stat = RANKING_STATS.find((s) => s.field === field) || { field, label: '数据', digits: 1 }
  const [seasonNum, setSeasonNum] = useState(Number(searchParams.get('seasonNum')) || 1)

  const columns = [
    {
      title: '名次', width: 70, fixed: 'left',
      render: (_, __, index) => {
        const rank = index + 1
        return (
          <span style={{ fontWeight: 700, fontStyle: 'italic', color: rank <= 3 ? MEDAL[rank - 1] : '#bbb', fontSize: rank <= 3 ? 16 : 14 }}>
            {rank}
          </span>
        )
      },
    },
    {
      title: '球员', dataIndex: 'playerName', width: 110,
      render: (text, row) => <Link to={`/players/${row.playerId}`}>{text}</Link>,
    },
    { title: '球队', dataIndex: 'playerTeam', width: 100 },
    { title: '位置', dataIndex: 'playerPosition', width: 70 },
    { title: '出场', dataIndex: 'playerAppearance', width: 70 },
    {
      title: stat.label, dataIndex: stat.field, width: 90,
      render: (v) => <span style={{ fontWeight: 700, color: '#fa541c' }}>{fmtNum(v, stat.digits)}</span>,
    },
  ]

  return (
    <>
      <Button style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>← 返回排行</Button>
      <ProTable
        headerTitle={`${stat.label}榜 · 完整排行`}
        rowKey="statsId"
        columns={columns}
        params={{ seasonNum }}
        search={false}
        options={false}
        scroll={{ x: 620 }}
        toolBarRender={() => [
          <Space key="season">
            赛季：
            <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions} style={{ width: 170 }} />
          </Space>,
        ]}
        pagination={false} /* 不分页，一滚到底 */
        request={async (params) => {
          const res = await playerApi.listSeasonStats({
            page: 1,
            limit: 2000,
            seasonNum: params.seasonNum,
            field: stat.field,
            order: stat.order || 'desc',
          })
          return { data: res.records || [], total: res.total || 0, success: true }
        }}
      />
    </>
  )
}
