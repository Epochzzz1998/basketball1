import { useState } from 'react'
import { Popover } from 'antd'
import { CaretDownOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { LATEST_SEASON, seasonShort, seasonYearLabel } from '../pages/players/rankConfig'

/**
 * 全站统一的赛季选择器（与顶栏搜索胶囊同一设计语言）：
 * `‹ | 2015-2016 赛季 ▾ | ›` 三段式胶囊——左右箭头逐季步进，
 * 点中间弹出年份网格（4 列芯片，选中=品牌橙填充；可选"生涯场均"整行芯片）。
 * 赛季范围/标签一律来自 rankConfig（锚点 2006、最近 20 年），不在此处另行硬编码。
 */

const MAX_SEASON = LATEST_SEASON

export default function SeasonPicker({ value, onChange, includeCareer = true }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
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
    <div style={{ width: 252 }}>
      {/* 芯片 hover 描边走一小段局部样式（inline 写不了 :hover） */}
      <style>{'.season-chip:hover{border-color:#fa541c;color:#fa541c}'}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {Array.from({ length: MAX_SEASON }, (_, i) => i + 1).map((n) => {
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
