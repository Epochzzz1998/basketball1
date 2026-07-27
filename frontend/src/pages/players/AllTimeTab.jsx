import { useEffect, useState } from 'react'
import { Card, Col, Empty, Row } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { CAREER_TOTAL_STATS, fmtTotal } from './rankConfig'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333'] // 金 / 银 / 铜

/**
 * 历史总榜：每个统计项一张卡（前 10），点「完整总榜 →」进独立页看全部。
 * 原本挂在联盟排行下面，但那一页的一切都跟"某个赛季"绑定（赛季选择、常规赛/季后赛切换），
 * 而生涯累计跟赛季无关，放在一起很跳。现在归到「历史数据」菜单下。
 */

function AllTimeCard({ stat }) {
  const [rows, setRows] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    setRows(null)
    // 只要前 10 行：不限量的话 21 张卡各拉 5015 行，未压缩合计 16MB 全都穿隧道
    playerApi.allTimeBoard(stat.key, 10)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [stat.key])

  return (
    <Card
      title={`${stat.label}榜`}
      extra={<a onClick={() => navigate(`/rankings/alltime/${stat.key}`)}>完整总榜 →</a>}
      loading={rows === null}
      styles={{ body: { padding: '8px 20px' } }}
    >
      {rows?.length ? rows.map((r, i) => (
        <div
          key={r.brId}
          style={{
            display: 'flex', alignItems: 'center', padding: '8px 0',
            borderBottom: i === rows.length - 1 ? 'none' : '1px solid #f5f5f5',
          }}
        >
          <span style={{ width: 28, fontWeight: 700, fontStyle: 'italic', fontSize: i < 3 ? 16 : 14, color: i < 3 ? MEDAL[i] : '#bbb' }}>
            {r.rk}
          </span>
          {/* 本库有资料卡的进资料卡（生涯档），没有的进最小档案 */}
          <Link
            to={r.playerId ? `/players/${r.playerId}?seasonNum=99` : `/players/history/${r.brId}`}
            style={{ flex: 1, fontWeight: i < 3 ? 600 : 400 }}
          >
            {r.playerName}
          </Link>
          <span style={{ color: '#999', fontSize: 12, marginRight: 14 }}>{r.lastYear}</span>
          <span style={{ fontWeight: 700, color: '#fa541c', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(r.val)}</span>
        </div>
      )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
    </Card>
  )
}

export default function AllTimeTab() {
  return (
    <>
      <div style={{ marginBottom: 14, color: '#888', fontSize: 13 }}>
        生涯累计总数，池子是 <b>1947 年至今的全联盟</b>——含大量本站没有逐季数据的老球员，
        他们的名字点进去是只有生涯总数的简档。抢断 / 盖帽 / 失误 / 前场篮板自 1973-74 起统计，
        三分自 1979-80 起，更早的球员这几项没有记录。
      </div>
      <Row gutter={[16, 16]}>
        {CAREER_TOTAL_STATS.map((s) => (
          <Col key={s.key} xs={24} sm={12} lg={8}>
            <AllTimeCard stat={s} />
          </Col>
        ))}
      </Row>
    </>
  )
}

