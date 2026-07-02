import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button, Select, Space } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { RANKING_STATS, fmtNum, seasonOptions } from './rankConfig'
import { buildFullStatColumns, FULL_COLUMNS_SCROLL_X } from './statColumns'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

/**
 * 某数据项的完整排行（/rankings/:field）：按该项降序、不分页一滚到底，
 * 展示球员的全量数据列（排行项高亮为橙色）。
 */
export default function RankingDetail() {
  const { field } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const stat = RANKING_STATS.find((s) => s.field === field) || { field, label: '数据', digits: 1 }
  const stage = searchParams.get('stage') === 'po' ? 'po' : 'reg' // 跟随联盟排行的赛段切换
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
    // 全量数据列；排行所依据的那一列高亮（表序即该列排序，故关闭表头排序避免破坏名次）
    ...buildFullStatColumns({ serverSort: false }).map((c) =>
      c.dataIndex === stat.field
        ? { ...c, render: (v) => <span style={{ fontWeight: 700, color: '#fa541c' }}>{fmtNum(v, stat.digits)}</span> }
        : c,
    ),
  ]

  return (
    <>
      <Button style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>← 返回排行</Button>
      <ProTable
        headerTitle={`${stage === 'po' ? '季后赛 · ' : ''}${stat.label}榜 · 完整排行`}
        rowKey="statsId"
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: FULL_COLUMNS_SCROLL_X + 70 }}
        toolBarRender={() => [
          <Space key="season">
            赛季：
            <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions} style={{ width: 170 }} />
          </Space>,
        ]}
        pagination={false} /* 不分页，一滚到底 */
        params={{ seasonNum, stage }}
        request={async (params) => {
          const api = stage === 'po' ? playerApi.listPlayoffSeasonStats : playerApi.listSeasonStats
          const res = await api({
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
