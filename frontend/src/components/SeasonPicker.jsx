import { useEffect, useState } from 'react'
import { Popover, Segmented } from 'antd'
import { CaretDownOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { LATEST_SEASON, seasonShort, seasonYearLabel } from '../pages/players/rankConfig'

/**
 * 全站统一的赛季选择器（与顶栏搜索胶囊同一设计语言）：
 * `‹ | 2015-2016 赛季 ▾ | ›` 三段式胶囊——左右箭头逐季步进，
 * 点中间弹出**按年代分组**的年份网格（40 季一页太长：顶部 80/90/00/10/20 年代
 * 切换，每组最多 10 个芯片；默认落在当前选中赛季的年代）。
 * 赛季范围/标签一律来自 rankConfig（锚点 1986、最近 40 年），不在此处另行硬编码。
 */

const MAX_SEASON = LATEST_SEASON
// 赛季 → 起始年所在年代（1985+n：第 1 季=1986 → 80 年代）
const eraOf = (n) => Math.floor((1985 + n) / 10) * 10
const ERAS = [...new Set(Array.from({ length: MAX_SEASON }, (_, i) => eraOf(i + 1)))]
const eraLabel = (e) => `${String(e).slice(-2)}年代`

export default function SeasonPicker({ value, onChange, includeCareer = true }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [era, setEra] = useState(eraOf(value === 50 ? MAX_SEASON : value || MAX_SEASON))

  // 每次展开都回到当前选中赛季所在的年代
  useEffect(() => {
    if (open) setEra(eraOf(value === 50 ? MAX_SEASON : value || MAX_SEASON))
  }, [open, value])
  const isCareer = value === 50
  const canPrev = !isCareer && value > 1
  const canNext = !isCareer && value < MAX_SEASON

  const step = (d) => onChange(Math.min(MAX_SEASON, Math.max(1, value + d)))

  const arrow = (enabled, side) => ({
    width: 28, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: enabled ? '#888' : '#ddd', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: 10,
    borderRight: side === 'l' ? '1px solid #f0f0f0' : 'none',
    borderLeft: side === 'r' ? '1px solid #f0f0f0' : 'none',
    userSelect: 'none',
  })

  const chipBase = {
    textAlign: 'center', padding: '5px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    border: '1px solid #f0f0f0', fontVariantNumeric: 'tabular-nums', transition: 'all .15s',
  }

  const grid = (
    <div style={{ width: 268 }}>
      {/* 芯片 hover 描边走一小段局部样式（inline 写不了 :hover） */}
      <style>{'.season-chip:hover{border-color:#fa541c;color:#fa541c}'}</style>
      <Segmented
        block
        size="small"
        value={era}
        onChange={setEra}
        options={ERAS.map((e) => ({ label: eraLabel(e), value: e }))}
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, minHeight: 96 }}>
        {Array.from({ length: MAX_SEASON }, (_, i) => i + 1)
          .filter((n) => eraOf(n) === era)
          .map((n) => {
            const sel = n === value
            return (
              <div
                key={n}
                className="season-chip"
                onClick={() => { onChange(n); setOpen(false) }}
                style={{
                  ...chipBase,
                  ...(sel ? { background: '#fa541c', borderColor: '#fa541c', color: '#fff', fontWeight: 700 } : { color: '#555' }),
                }}
              >
                {seasonShort(n)}
              </div>
            )
          })}
      </div>
      {includeCareer && (
        <div
          className="season-chip"
          onClick={() => { onChange(50); setOpen(false) }}
          style={{
            ...chipBase, marginTop: 8,
            ...(isCareer ? { background: '#fa541c', borderColor: '#fa541c', color: '#fff', fontWeight: 700 } : { color: '#555' }),
          }}
        >
          🏅 生涯
        </div>
      )}
    </div>
  )

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', height: 32, background: '#fff',
        border: `1px solid ${hover || open ? '#fa541c' : '#e8e8e8'}`, borderRadius: 16,
        transition: 'border-color .2s', overflow: 'hidden', verticalAlign: 'middle',
      }}
    >
      <div style={arrow(canPrev, 'l')} onClick={() => canPrev && step(-1)}><LeftOutlined /></div>
      <Popover
        content={grid}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="bottom"
        arrow={false}
        styles={{ body: { borderRadius: 12, padding: 12 } }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: '#333', minWidth: 122, justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value === 50 ? '生涯' : seasonYearLabel(value)}
          <CaretDownOutlined
            style={{ fontSize: 10, color: '#999', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
          />
        </div>
      </Popover>
      <div style={arrow(canNext, 'r')} onClick={() => canNext && step(1)}><RightOutlined /></div>
    </div>
  )
}
