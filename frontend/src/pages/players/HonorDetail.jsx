import { useEffect, useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { HONOR_GROUPS } from './honorConfig'
import { seasonYearLabel, LATEST_SEASON, honorEligible } from './rankConfig'
import SeasonPicker from '../../components/SeasonPicker'
import useIsMobile from '../../hooks/useIsMobile'
import { buildFullStatColumns, compactColumns, sumColWidth } from './statColumns'

/** 某项荣誉的完整数据（/rankings/honors/:group）：该组全部球员 + 全量数据列 */
export default function HonorDetail() {
  const { group: groupKey } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const group = HONOR_GROUPS.find((g) => g.key === groupKey) || HONOR_GROUPS[0]
  const [seasonNum, setSeasonNumRaw] = useState(Number(searchParams.get('seasonNum')) || LATEST_SEASON)
  // 换赛季同步写回 URL（replace）：往下钻再返回时本页赛季不丢
  const setSeasonNum = (v) => {
    setSeasonNumRaw(v)
    setSearchParams((prev) => { const q = new URLSearchParams(prev); q.set('seasonNum', v); return q }, { replace: true })
  }
  const [rows, setRows] = useState(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setRows((r.records || []).filter(honorEligible)) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum])

  const members = rows ? (group.pickFull || group.pick)(rows) : []
  const statCols = buildFullStatColumns({ serverSort: false })
  const columns = [
    // 阵容组没有名次角标（rankOf 不设），完整数据页也不出名次列
    ...(group.rankOf
      ? [{
          title: '名次', width: isMobile ? 48 : 70, fixed: 'left',
          render: (_, r, i) => (
            <span style={{ color: '#888' }}>{group.rankOf(r)}</span>
          ),
        }]
      : []),
    ...(isMobile ? compactColumns(statCols) : statCols),
  ]

  return (
    <>
      <ProTable
        className="stat-compact"
        bordered
        headerTitle={`${seasonYearLabel(seasonNum)} · ${group.title} · 完整数据`}
        rowKey="statsId"
        loading={rows === null}
        dataSource={members}
        columns={columns}
        search={false}
        options={false}
        pagination={false}
        scroll={{ x: sumColWidth(columns) }}
        toolBarRender={() => [
          <SeasonPicker key="season" value={seasonNum} onChange={setSeasonNum} />,
        ]}
      />
    </>
  )
}
