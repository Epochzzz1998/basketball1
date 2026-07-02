import { useEffect, useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button, Select, Space } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { HONOR_GROUPS } from './honorConfig'
import { seasonOptions, seasonYearLabel } from './rankConfig'
import { buildFullStatColumns, FULL_COLUMNS_SCROLL_X } from './statColumns'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

/** 某项荣誉的完整数据（/rankings/honors/:group）：该组全部球员 + 全量数据列 */
export default function HonorDetail() {
  const { group: groupKey } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const group = HONOR_GROUPS.find((g) => g.key === groupKey) || HONOR_GROUPS[0]
  const [seasonNum, setSeasonNum] = useState(Number(searchParams.get('seasonNum')) || 1)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum])

  const members = rows ? group.pick(rows) : []
  const columns = [
    {
      title: '名次', width: 70, fixed: 'left',
      render: (_, r, i) => (
        <span style={{ fontWeight: 700, fontStyle: 'italic', color: i < 3 ? MEDAL[i] : '#bbb', fontSize: i < 3 ? 16 : 14 }}>
          {group.rankOf(r)}
        </span>
      ),
    },
    ...buildFullStatColumns({ serverSort: false }),
  ]

  return (
    <>
      <Button style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>← 返回荣誉榜</Button>
      <ProTable
        headerTitle={`${seasonYearLabel(seasonNum)} · ${group.title} · 完整数据`}
        rowKey="statsId"
        loading={rows === null}
        dataSource={members}
        columns={columns}
        search={false}
        options={false}
        pagination={false}
        scroll={{ x: FULL_COLUMNS_SCROLL_X + 70 }}
        toolBarRender={() => [
          <Space key="season">
            赛季：
            <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions} style={{ width: 170 }} />
          </Space>,
        ]}
      />
    </>
  )
}
