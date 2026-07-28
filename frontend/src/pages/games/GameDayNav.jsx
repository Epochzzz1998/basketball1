import { useEffect, useState } from 'react'
import { Button, DatePicker, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { playerApi } from '../../api/player'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 比赛日翻页器：`‹  6月13日 周六  ›`
 *
 * 箭头跳的是**相邻的比赛日**，不是相邻的自然日。机械地 ±1 天，在休赛期能连点四个月都是空的。
 *
 * 前后两天由后端一次给全（`/player/adjacentGameDates`），有两个原因：
 *  1. 到头的那一端要把箭头**置灰**，不能等用户点了才发现没有；
 *  2. 只靠"当月有比赛的日子"在前端找下一个的话**跨不过月份边界**，
 *     每月第一个和最后一个比赛日的箭头会莫名其妙点不动 —— 这正是上一版的毛病。
 *
 * 中间那块日期本身可点，展开小日历直接挑；有比赛的日子标成橙底，免得一天天点过去试。
 */
export default function GameDayNav({ date, onChange, days }) {
  const isMobile = useIsMobile()
  const [adj, setAdj] = useState({ prev: null, next: null })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!date) return
    let alive = true
    // 先清空，否则切换日期的瞬间箭头还挂着上一天的可用状态，会点到错的地方
    setAdj({ prev: null, next: null })
    playerApi.adjacentGameDates(date)
      .then((r) => { if (alive) setAdj({ prev: r?.prev || null, next: r?.next || null }) })
      .catch(() => {})
    return () => { alive = false }
  }, [date])

  if (!date) return null
  const d = dayjs(date)

  const arrow = (dir) => {
    const to = dir < 0 ? adj.prev : adj.next
    const label = dir < 0 ? '上一个比赛日' : '下一个比赛日'
    const btn = (
      <Button
        type="text"
        disabled={!to}
        onClick={() => to && onChange(to)}
        icon={dir < 0 ? <LeftOutlined /> : <RightOutlined />}
        style={{ color: to ? '#595959' : undefined }}
      />
    )
    // 到头了就没什么可提示的，antd 的 Tooltip 也包不住 disabled 的按钮
    return to ? <Tooltip key={dir} title={`${label}：${dayjs(to).format('M 月 D 日')}`}>{btn}</Tooltip>
              : <span key={dir}>{btn}</span>
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      border: '1px solid #f0f0f0', borderRadius: 10, padding: '2px 4px', background: '#fff',
    }}>
      {arrow(-1)}
      <a
        onClick={() => setOpen(true)}
        style={{
          color: '#222', fontWeight: 700, fontSize: isMobile ? 14 : 15,
          padding: '0 8px', whiteSpace: 'nowrap', position: 'relative',
        }}
      >
        {d.format(isMobile ? 'M 月 D 日' : 'YYYY 年 M 月 D 日')}
        <span style={{ color: '#bbb', fontWeight: 400, marginLeft: 6 }}>{'日一二三四五六'[d.day()]}</span>
        {/* 真正的日历藏在文字底下：DatePicker 换不掉自己的输入框，缩成零尺寸只当弹层锚点 */}
        <DatePicker
          open={open}
          onOpenChange={setOpen}
          value={d}
          allowClear={false}
          inputReadOnly
          onChange={(v) => { setOpen(false); if (v) onChange(v.format('YYYY-MM-DD')) }}
          style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, padding: 0, border: 'none', visibility: 'hidden' }}
          cellRender={(current, info) => {
            if (info.type !== 'date') return info.originNode
            const has = days?.has(current.format('YYYY-MM-DD'))
            return (
              <div className="ant-picker-cell-inner" style={has
                ? { background: '#fff1e6', color: '#d4380d', fontWeight: 700, borderRadius: 4 }
                : undefined}
              >
                {current.date()}
              </div>
            )
          }}
        />
      </a>
      {arrow(1)}
    </div>
  )
}
