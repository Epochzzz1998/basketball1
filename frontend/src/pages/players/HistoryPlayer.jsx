import { useEffect, useState } from 'react'
import { Card, Col, Empty, Row, Spin, Tag } from 'antd'
import { useParams } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { CAREER_TOTAL_STATS, fmtTotal } from './rankConfig'
import { RankChip } from './SeasonProfile'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 历史球员最小档案（/players/history/:brId）。
 *
 * 历史总榜的池子是 1947 年至今全联盟，里面大量球员本库没有资料卡——他们的赛季数据在
 * 我们的 50 年窗口之外（张伯伦 1959-1973、拉塞尔 1956-1969）。这一页就是给这些名字一个
 * 落脚点：只有生涯总数和历史排名，没有逐季、没有雷达、没有荣誉，因为那些数据我们确实没有。
 *
 * 格子样式与球员资料卡完全一致，一行三个。
 */
export default function HistoryPlayer() {
  const { brId } = useParams()
  const isMobile = useIsMobile()
  const [row, setRow] = useState(undefined)

  useEffect(() => {
    let alive = true
    setRow(undefined)
    playerApi.historyPlayer(brId)
      .then((r) => { if (alive) setRow(r || null) })
      .catch(() => { if (alive) setRow(null) })
    return () => { alive = false }
  }, [brId])

  if (row === undefined) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!row) return <Empty description="没有这名球员的历史数据" style={{ padding: 60 }} />

  return (
    <Card
      title={
        <span>
          {row.playerName}
          <Tag style={{ marginLeft: 10 }}>{row.firstYear}-{row.lastYear}</Tag>
          <Tag>{row.seasons} 个赛季</Tag>
        </span>
      }
      styles={{ body: { padding: '18px 20px' } }}
    >
      <div style={{ color: '#bbb', fontSize: 12, marginBottom: 12 }}>
        本站的逐季数据从 1976-77 赛季起，这名球员的赛季不在范围内，因此只有生涯总数与历史排名。
      </div>
      <Row gutter={isMobile ? [6, 6] : [10, 10]}>
        {CAREER_TOTAL_STATS.map((s) => {
          const v = row[s.key]
          const rank = row[`${s.key}Rank`]
          // 值为 0 不给名次：抢断/盖帽/失误/前场篮板 1973-74 才统计、三分 1979-80 才有，
          // 老球员这几项恒为 0，那不是"排在几千名"，是当年根本没统计
          const showRank = rank != null && Number(v) > 0
          return (
            <Col key={s.key} xs={8} sm={8}>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: isMobile ? '7px 6px' : '10px 12px', background: '#fff' }}>
                <div style={{ color: '#888', fontSize: isMobile ? 11 : 12, whiteSpace: 'nowrap' }}>{s.label}</div>
                <div style={{
                  fontSize: isMobile ? 16 : 20, fontWeight: 800, color: '#fa541c',
                  margin: '2px 0 4px', fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtTotal(v)}
                </div>
                {showRank && <RankChip rank={rank} prefix="历史第" to={`/rankings/alltime/${s.key}`} />}
              </div>
            </Col>
          )
        })}
      </Row>
    </Card>
  )
}
