import { MAX_SCORE, MIN_SCORE, scoreColor, scoreWord } from '../../api/gameRating'

/**
 * 打分的三个显示部件：平均分面板、分数分布柱、1-5 打分格。
 *
 * 抽出来是因为**每日赛场和开黑战绩用的是同一套评分**（同一个接口、同三张表，
 * 见 api/gameRating.js 里 kind 的说明）。留在 GameRating.jsx 里让 LoL 那边再抄一份，
 * 两边迟早会长得不一样——这个项目今天已经因为「同一件事有两份实现」修过两次了。
 */

/**
 * 平均分 + 分布。比赛和球员共用，只有尺寸不同。
 *
 * 没人评过时平均分显示破折号而不是 0——0 分是一种评价，「还没人评」不是。
 */
export function ScorePanel({ avg, n, rows, big }) {
  const has = Number(n || 0) > 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: big ? 20 : 14, flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center', minWidth: big ? 84 : 56 }}>
        <div style={{
          fontSize: big ? 44 : 22, fontWeight: 800, lineHeight: 1.15,
          color: has ? scoreColor(avg) : '#ddd',
        }}>
          {has ? avg : '—'}
        </div>
        <div style={{ color: '#999', fontSize: big ? 12 : 10, marginTop: big ? 4 : 2 }}>
          {has ? `${n} 人 · ${scoreWord(avg)}` : '还没人打分'}
        </div>
      </div>
      <ScoreBars rows={rows} total={n} big={big} />
    </div>
  )
}

/**
 * 分数分布。五档一档一根柱，每根按自己那档的颜色。
 *
 * 没人评过时整块不画——五根灰柱子和「还没人评」说的是同一件事，画出来只是占地方。
 *
 * ## 容器高度必须**算全**，不能只留柱子的高度
 *
 * 一列不止是柱子：上面（大号）还有人数、下面还有一行档位数字。
 * 早先容器只按柱高留了余量，最高那根一满格，整列就比容器高十来像素——
 * 而 `align-items: flex-end` 是**底部对齐**，超出的部分往上溢，
 * 于是柱子顶进了上面那行球员名字里。
 * 所以这里把三段高度显式加起来，宁可写得啰嗦也别让它靠巧合不重叠。
 */
const LABEL_H = 14        // 底下那行档位数字（10px 字 + 2px 间距）
const COUNT_H = 13        // 大号柱顶上的人数

function ScoreBars({ rows, total, big }) {
  if (!Number(total || 0)) return null
  const byScore = Object.fromEntries((rows || []).map((r) => [Number(r.score), Number(r.n)]))
  const max = Math.max(1, ...Object.values(byScore))
  const h = big ? 56 : 24
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: big ? 6 : 4,
      height: h + LABEL_H + (big ? COUNT_H : 0) + 2,
      flex: 1, minWidth: big ? 150 : 96, maxWidth: big ? 320 : 136,
    }}>
      {Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => {
        const s = MIN_SCORE + i
        const n = byScore[s] || 0
        return (
          <div key={s} style={{ flex: 1, textAlign: 'center' }} title={`${s} 分 · ${n} 人`}>
            {big && (
              <div style={{ color: n ? '#999' : '#eee', fontSize: 10, lineHeight: `${COUNT_H}px` }}>
                {n || ''}
              </div>
            )}
            <div style={{
              height: Math.round((n / max) * h) + (n ? 2 : 0),
              background: n ? scoreColor(s) : '#f5f5f5',
              borderRadius: 3, minHeight: 2,
            }} />
            <div style={{ color: '#ccc', fontSize: 10, lineHeight: '12px', marginTop: 2 }}>{s}</div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 1..5 的打分格。
 *
 * 一格一档、一点就中——不用滑块是因为滑块在手机上很难精确停在某一档，
 * 不用五星是因为半星的可点区域只有一格的一半宽。
 */
export function ScoreDots({ value, size, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => {
        const s = MIN_SCORE + i
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            style={{
              width: size, height: size, lineHeight: `${size - 2}px`, padding: 0,
              borderRadius: 9, cursor: 'pointer', fontSize: size > 34 ? 17 : 14,
              fontWeight: on ? 800 : 500,
              // 选中的那一格用它自己那档的颜色，而不是统一的主题色——
              // 这样「我给了 2 分」和「我给了 5 分」隔着屏幕就能分辨
              border: `1px solid ${on ? scoreColor(s) : '#eee'}`,
              background: on ? scoreColor(s) : '#fafafa',
              color: on ? '#fff' : '#999',
              transition: 'none',
            }}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}
