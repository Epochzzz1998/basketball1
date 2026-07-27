import { useEffect, useState } from 'react'
import { Card, Empty, Spin, Table } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { CAREER_TOTAL_STATS, fmtTotal } from './rankConfig'
import { compactColumns, sumColWidth } from './statColumns'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 单项生涯总数的历史总榜（/rankings/alltime/:field）。
 *
 * 池子是 1947 年至今的全联盟，所以榜上会有大量本库没有资料卡的人（张伯伦、拉塞尔……）。
 * 他们走「历史球员最小档案」页，不是死链接——名字一律可点，只是落地页深浅不同。
 *
 * 不分页一滚到底：得分榜有四千多人，分页反而不好找人。
 */
export default function AllTimeBoard() {
  const { field } = useParams()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)
  const stat = CAREER_TOTAL_STATS.find((s) => s.key === field) || { key: field, label: '数据' }

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.allTimeBoard(field)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [field])

  const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']
  const columns = [
    {
      title: '名次', dataIndex: 'rk', width: 60, fixed: 'left',
      render: (v) => (
        <span style={{ fontWeight: v <= 3 ? 800 : 400, fontStyle: 'italic', color: v <= 3 ? MEDAL[v - 1] : '#bbb' }}>{v}</span>
      ),
    },
    {
      title: '球员', dataIndex: 'playerName', width: 150, fixed: 'left',
      // 本库有资料卡的进资料卡（生涯档），没有的进最小档案，都不留死链接
      render: (name, r) => (
        <Link to={r.playerId ? `/players/${r.playerId}?seasonNum=99` : `/players/history/${r.brId}`}>{name}</Link>
      ),
    },
    { title: '年代', dataIndex: 'firstYear', width: 96, render: (_, r) => `${r.firstYear}-${r.lastYear}` },
    { title: '赛季', dataIndex: 'seasons', width: 56 },
    {
      title: stat.label, dataIndex: 'val', width: 96,
      render: (v) => <b style={{ color: '#fa541c', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(v)}</b>,
    },
  ]
  const cols = isMobile ? compactColumns(columns) : columns

  return (
    <Card
      title={`${stat.label} · 历史总榜`}
      extra={<span style={{ color: '#bbb', fontSize: 12 }}>{rows ? `${rows.length} 人` : ''}</span>}
      styles={{ body: { padding: 0 } }}
    >
      {rows === null ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : rows.length ? (
        <Table
          className="clean-table stat-compact"
          bordered
          rowKey="brId"
          dataSource={rows}
          columns={cols}
          pagination={false}
          size="middle"
          scroll={{ x: sumColWidth(cols), y: 640 }}
        />
      ) : (
        <Empty description="暂无数据" style={{ padding: 40 }} />
      )}
    </Card>
  )
}
