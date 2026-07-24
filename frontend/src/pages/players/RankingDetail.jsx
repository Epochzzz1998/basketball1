import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { RANKING_STATS, fmtNum, fmtPct, LATEST_SEASON, qualifiedBoard } from './rankConfig'
import SeasonPicker from '../../components/SeasonPicker'
import { buildFullStatColumns, FULL_COLUMNS_SCROLL_X, HONOR_COLUMN_KEYS, PLAYOFF_COLUMNS_SCROLL_X } from './statColumns'

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
  const [seasonNum, setSeasonNum] = useState(Number(searchParams.get('seasonNum')) || LATEST_SEASON)

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
    // 全量数据列；排行所依据的那一列高亮（表序即该列排序，故关闭表头排序避免破坏名次）；
    // 季后赛模式去掉荣誉四列（MVP/DPOY/阵容为常规赛评选）。
    // 高亮是"套"在原渲染外面而不是替换——成对列（如 命中/出手）才能保住原格式
    ...buildFullStatColumns({ serverSort: false })
      .filter((c) => stage !== 'po' || !HONOR_COLUMN_KEYS.includes(c.dataIndex))
      .map((c) =>
        c.dataIndex === stat.field
          ? {
              ...c,
              render: (v, row, idx) => (
                <span style={{ fontWeight: 700, color: '#fa541c' }}>
                  {c.render ? c.render(v, row, idx) : stat.pct ? fmtPct(v) : fmtNum(v, stat.digits)}
                </span>
              ),
            }
          : c,
      ),
  ]

  return (
    <>
      <ProTable
        headerTitle={`${stage === 'po' ? '季后赛 · ' : ''}${stat.label}榜 · 完整排行`}
        rowKey="statsId"
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: (stage === 'po' ? PLAYOFF_COLUMNS_SCROLL_X : FULL_COLUMNS_SCROLL_X) + 70 }}
        toolBarRender={() => [
          <SeasonPicker key="season" value={seasonNum} onChange={setSeasonNum} />,
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
          // 常规赛套 58 场资格线（含补场规则）；季后赛不设
          const list = stage === 'po' ? (res.records || []) : qualifiedBoard(res.records || [], stat.field)
          return { data: list, total: list.length, success: true }
        }}
      />
    </>
  )
}
