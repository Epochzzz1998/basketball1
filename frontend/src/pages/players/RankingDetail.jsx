import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { ADVANCED_STATS, RANKING_STATS, fmtAdv, fmtNum, fmtPct, LATEST_SEASON, qualifiedBoard, filterByPosition } from './rankConfig'
import SeasonPicker from '../../components/SeasonPicker'
import useIsMobile from '../../hooks/useIsMobile'
import { buildFullStatColumns, buildAdvancedStatColumns, HONOR_COLUMN_KEYS, compactColumns, sumColWidth } from './statColumns'
import { GlossaryButton } from './statGlossary'
import PositionFilter from './PositionFilter'

/**
 * 某数据项的完整排行（/rankings/:field）：按该项降序、不分页一滚到底，
 * 展示球员的全量数据列（排行项高亮为橙色）。
 */
export default function RankingDetail() {
  const { field } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  // 高阶项也能深链进来（排行卡的「完整排行」按钮），两组一起找
  const isAdvanced = ADVANCED_STATS.some((s) => s.field === field)
  const stat = [...RANKING_STATS, ...ADVANCED_STATS].find((s) => s.field === field)
    || { field, label: '数据', digits: 1 }
  const stage = searchParams.get('stage') === 'po' ? 'po' : 'reg' // 跟随联盟排行的赛段切换
  const [seasonNum, setSeasonNumRaw] = useState(Number(searchParams.get('seasonNum')) || LATEST_SEASON)
  // 位置跟着 URL 走：从单项排行卡「完整排行 →」下钻时把筛选带过来
  const [pos, setPosRaw] = useState(searchParams.get('pos') || 'all')
  const setPos = (v) => {
    setPosRaw(v)
    setSearchParams((prev) => {
      const q = new URLSearchParams(prev)
      if (v && v !== 'all') q.set('pos', v)
      else q.delete('pos')
      return q
    }, { replace: true })
  }
  // 换赛季同步写回 URL（replace）：往下钻再返回时本页赛季不丢
  const setSeasonNum = (v) => {
    setSeasonNumRaw(v)
    setSearchParams((prev) => { const q = new URLSearchParams(prev); q.set('seasonNum', v); return q }, { replace: true })
  }
  const isMobile = useIsMobile()

  const baseColumns = [
    {
      title: '名次', width: isMobile ? 40 : 48, fixed: 'left',
      render: (_, __, index) => {
        const rank = index + 1
        return (
          <span style={{ color: '#888' }}>{rank}</span>
        )
      },
    },
    // 全量数据列；排行所依据的那一列高亮（表序即该列排序，故关闭表头排序避免破坏名次）；
    // 季后赛模式去掉荣誉四列（MVP/DPOY/阵容为常规赛评选）。
    // 高亮是"套"在原渲染外面而不是替换——成对列（如 命中/出手）才能保住原格式
    // 高阶项要配高阶列，否则点「PER榜」进来整张表里根本没有 PER 这一列
    ...(isMobile ? compactColumns : (c) => c)(
      (isAdvanced
        ? buildAdvancedStatColumns({ po: stage === 'po' })
        : buildFullStatColumns({ serverSort: false }))
        .filter((c) => stage !== 'po' || !HONOR_COLUMN_KEYS.includes(c.dataIndex)),
    ).map((c) =>
      c.dataIndex === stat.field
        ? {
            ...c,
            render: (v, row, idx) => (
              <span style={{ fontWeight: 700, color: '#fa541c' }}>
                {c.render ? c.render(v, row, idx) : stat.pct || stat.rate ? fmtAdv(v, stat) : fmtNum(v, stat.digits)}
              </span>
            ),
          }
        : c,
    ),
  ]

  return (
    <>
      <ProTable
        className="stat-compact"
        bordered
        headerTitle={`${stage === 'po' ? '季后赛 · ' : ''}${stat.label}榜 · 完整排行`}
        rowKey="statsId"
        columns={baseColumns}
        search={false}
        options={false}
        scroll={{ x: sumColWidth(baseColumns) }}
        toolBarRender={() => [
          <PositionFilter key="pos" value={pos} onChange={setPos} />,
          ...(isAdvanced ? [<GlossaryButton key="g" />] : []),
          <SeasonPicker key="season" value={seasonNum} onChange={setSeasonNum} />,
        ]}
        pagination={false} /* 不分页，一滚到底 */
        params={{ seasonNum, stage, pos }}
        request={async (params) => {
          const api = stage === 'po' ? playerApi.listPlayoffSeasonStats : playerApi.listSeasonStats
          const res = await api({
            page: 1,
            limit: 2000,
            seasonNum: params.seasonNum,
            field: stat.field,
            order: stat.order || 'desc',
          })
          // 常规赛套 58 场资格线（含补场规则）；季后赛不设。位置筛在资格线之后
          const board = stage === 'po' ? (res.records || []) : qualifiedBoard(res.records || [], stat.field, seasonNum)
          const list = filterByPosition(board, params.pos)
          return { data: list, total: list.length, success: true }
        }}
      />
    </>
  )
}
