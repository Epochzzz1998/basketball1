import { useEffect, useState } from 'react'
import { Empty, Spin } from 'antd'
import { playerApi } from '../../api/player'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 生涯总数 + 历史排名。
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

// 顺序参考主流数据站：先体量，再基础数据，最后投篮细项
const TOTAL_STATS = [
  { key: 'g', label: '出场数' },
  { key: 'mp', label: '时间' },
  { key: 'pts', label: '得分' },
  { key: 'trb', label: '篮板' },
  { key: 'orb', label: '前场篮板' },
  { key: 'drb', label: '后场篮板' },
  { key: 'ast', label: '助攻' },
  { key: 'tov', label: '失误' },
  { key: 'stl', label: '抢断' },
  { key: 'blk', label: '盖帽' },
  { key: 'pf', label: '犯规' },
  { key: 'fga', label: '出手' },
  { key: 'fg', label: '进球' },
  { key: 'fgMiss', label: '打铁' },
  { key: 'fg3a', label: '三分出手' },
  { key: 'fg3', label: '三分命中' },
  { key: 'fg3Miss', label: '三分打铁' },
  { key: 'fta', label: '罚球次数' },
  { key: 'ft', label: '罚球命中' },
  { key: 'ftMiss', label: '罚球打铁' },
  { key: 'tplDbl', label: '三双' },
]

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']
const fmtInt = (v) => (v == null ? '-' : Number(v).toLocaleString('en-US'))

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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>生涯总数</span>
        <span style={{ color: '#bbb', fontSize: 12 }}>
          {row.firstYear}-{row.lastYear} · {row.seasons} 个赛季 · 名次为 NBA 历史排名
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${isMobile ? 3 : 4}, 1fr)`,
          gap: isMobile ? 6 : 10,
        }}
      >
        {TOTAL_STATS.map((s) => {
          const v = row[s.key]
          const rank = row[`${s.key}Rank`]
          // 值为 0 不给名次：那多半是"当年还没统计这项"，不是真的排在几千名
          const showRank = rank != null && Number(v) > 0
          return (
            <div
              key={s.key}
              style={{
                border: '1px solid #f0f0f0', borderRadius: 10, background: '#fff',
                padding: isMobile ? '8px 6px' : '10px 12px', textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: isMobile ? 17 : 21, fontWeight: 800, color: '#333',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1.25,
              }}>
                {fmtInt(v)}
              </div>
              <div style={{ color: '#888', fontSize: isMobile ? 11 : 12, marginTop: 1 }}>{s.label}</div>
              {showRank && (
                <div style={{ marginTop: 5 }}>
                  <span style={{
                    fontSize: isMobile ? 10 : 12, fontWeight: 600,
                    color: rank <= 3 ? MEDAL[rank - 1] : '#999',
                    background: rank <= 3 ? 'rgba(250,84,28,.08)' : '#f5f5f5',
                    padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap',
                  }}>
                    历史第 {rank}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
