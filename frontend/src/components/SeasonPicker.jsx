import { useEffect, useState } from 'react'
import { Popover } from 'antd'
import { CaretDownOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { CAREER_SEASON, EARLIEST_SEASON, LATEST_SEASON, SEASON_BASE, seasonShort, seasonYearLabel } from '../pages/players/rankConfig'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 全站统一的赛季选择器（与顶栏搜索胶囊同一设计语言）：
 * `‹ | 2015-2016 赛季 ▾ | ›` 三段式胶囊——左右箭头逐季步进，
 * 点中间弹出**按年代分组**的年份网格（50 季一页太长：顶部 70/80/90/00/10/20 年代
 * 切换，每组最多 10 个芯片；默认落在当前选中赛季的年代）。
 * 赛季范围/标签一律来自 rankConfig（锚点 1976、最近 50 年），不在此处另行硬编码。
 */

const MAX_SEASON = LATEST_SEASON
const MIN_SEASON = EARLIEST_SEASON   // -29 = 1946-47，见 rankConfig 的说明
// 赛季 → 起始年所在年代（SEASON_BASE+n：第 1 季=1976 → 70 年代；第 -29 季=1946 → 40 年代）
const eraOf = (n) => Math.floor((SEASON_BASE + n) / 10) * 10
const ERAS = [...new Set(Array.from({ length: MAX_SEASON - MIN_SEASON + 1 },
  (_, i) => eraOf(MIN_SEASON + i)))]
const eraLabel = (e) => `${String(e).slice(-2)}s` // '80s'——「80年代」在分段条里放不下会截断

export default function SeasonPicker({ value, onChange, includeCareer = true, compact = false }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [era, setEra] = useState(eraOf(value === CAREER_SEASON ? MAX_SEASON : value || MAX_SEASON))

  // 每次展开都回到当前选中赛季所在的年代
  useEffect(() => {
    if (open) setEra(eraOf(value === CAREER_SEASON ? MAX_SEASON : value || MAX_SEASON))
  }, [open, value])
  const isCareer = value === CAREER_SEASON
  const canPrev = !isCareer && value > MIN_SEASON
  const canNext = !isCareer && value < MAX_SEASON

  const step = (d) => onChange(Math.min(MAX_SEASON, Math.max(MIN_SEASON, value + d)))

  // compact：给窄屏并排两只用（对比页移动端）——箭头/字号/内边距整体收紧
  const arrow = (enabled, side) => ({
    width: compact ? 22 : 28, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
      {/*
        年代切换原来用 Segmented block：六个年代时刚好，补完 1946 年起的老赛季后变成九个
        （40s-20s），一行平分下来每格 30px，标签被省略号截断。加宽弹层治标不治本——真按
        九格算要 330px 以上，手机上又得被 vw 压回去。改成可换行的小胶囊：放不下就换行，
        以后年代再多也不会挤，样式还跟下面的赛季芯片统一。
      */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {ERAS.map((e) => {
          const on = e === era
          return (
            <div
              key={e}
              className="season-chip"
              onClick={() => setEra(e)}
              style={{
                ...chipBase, padding: '3px 10px', fontSize: 12,
                ...(on ? { background: '#fa541c', borderColor: '#fa541c', color: '#fff', fontWeight: 700 } : { color: '#666' }),
              }}
            >
              {eraLabel(e)}
            </div>
          )
        })}
      </div>
      {/* 不设 minHeight：行数随年代变化，芯片保持紧凑不被拉伸 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, alignContent: 'start' }}>
        {Array.from({ length: MAX_SEASON - MIN_SEASON + 1 }, (_, i) => MIN_SEASON + i)
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
          onClick={() => { onChange(CAREER_SEASON); setOpen(false) }}
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
        transition: 'border-color .2s', overflow: 'hidden', verticalAlign: 'middle', flexShrink: 0,
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
            display: 'flex', alignItems: 'center', gap: compact ? 4 : 6, padding: compact ? '0 8px' : '0 12px',
            cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: compact ? 12 : 13, fontWeight: 600, color: '#333',
            minWidth: compact || isMobile ? 0 : 122,
            justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {/* compact 用短标签（25-26）——全称两只并排在 390px 宽度里放不下。
              手机上（完整排行的工具条里还挤着位置筛选）去掉「赛季」二字，年份留全 */}
          {value === CAREER_SEASON ? '生涯'
            : compact ? seasonShort(value)
            : isMobile ? seasonYearLabel(value).replace(' 赛季', '')
            : seasonYearLabel(value)}
          <CaretDownOutlined
            style={{ fontSize: 10, color: '#999', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
          />
        </div>
      </Popover>
      <div style={arrow(canNext, 'r')} onClick={() => canNext && step(1)}><RightOutlined /></div>
    </div>
  )
}
