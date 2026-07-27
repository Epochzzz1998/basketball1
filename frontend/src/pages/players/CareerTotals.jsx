import { useEffect, useState } from 'react'
import { Col, Empty, Row, Spin } from 'antd'
import { playerApi } from '../../api/player'
import { CAREER_TOTAL_STATS, fmtTotal } from './rankConfig'
import { RankChip } from './SeasonProfile'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 生涯总数 + 历史排名。格子样式与资料卡的数据格完全一致（同样一行三个），
 * 只是数值是累计值、名次是历史排名。
 *
 * 数据来自 nba_career_totals：那张表覆盖 1947 年至今的**全联盟**，不是本库的 50 季。
 * 这是必须的——只按 1976 年起的数据排名，张伯伦、拉塞尔、韦斯特根本不在池子里，
 * 贾巴尔也只算得上半个生涯，排出来的"历史第 N"是错的。
 *
 * 名次隐藏的两种情况：
 *  · 值为 0：抢断/盖帽/失误/前场篮板 1973-74 才开始统计、三分 1979-80 才有，
 *    老球员这几项恒为 0，给个"历史第 4000"没有意义（官方榜同样不列）；
 *  · 接口整体返回 null：这名球员没匹配上全历史表，整块不显示。
 */

export default function CareerTotals({ playerId }) {
  const isMobile = useIsMobile()
  const [row, setRow] = useState(undefined) // undefined=加载中, null=无数据

  useEffect(() => {
    let alive = true
    setRow(undefined)
    playerApi.careerTotals(playerId)
      .then((r) => { if (alive) setRow(r || null) })
      .catch(() => { if (alive) setRow(null) })
    return () => { alive = false }
  }, [playerId])

  if (row === undefined) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  if (!row) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无生涯总数（该球员未匹配到历史数据）" />

  return (
    <>
      <div style={{ color: '#bbb', fontSize: 12, marginBottom: 10 }}>
        {row.firstYear}-{row.lastYear} · {row.seasons} 个赛季 · 名次为 NBA 历史排名（1947 年至今）
      </div>
      <Row gutter={isMobile ? [6, 6] : [10, 10]}>
        {CAREER_TOTAL_STATS.map((s) => {
          const v = row[s.key]
          const rank = row[`${s.key}Rank`]
          // 值为 0 不给名次：那多半是"当年还没统计这项"，不是真的排在几千名
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
    </>
  )
}
