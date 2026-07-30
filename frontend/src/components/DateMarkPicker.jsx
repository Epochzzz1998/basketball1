import { useCallback, useEffect, useRef, useState } from 'react'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'

/**
 * 会把「有内容的日子」标出来的日期选择器。
 *
 * ## 它修的那个 bug
 *
 * 标注是按月拉的，而**「显示中的月份」和「选中日期所在的月份」不是一回事**：
 * 在日历里翻月并不会改变选中日期。早先 NBA 的每日赛场就是按选中日期的月份拉标注，
 * 于是翻到别的月份时整片空白，直到点了某一天（选中日期变了）标注才突然冒出来。
 *
 * 正确的做法是监听 `onPanelChange` —— 那才是「用户现在在看哪个月」。
 *
 * ## 为什么做成通用组件
 *
 * NBA 的比赛日和开黑战绩的对局日是同一个需求，只是数据来源不同。
 * 调用方给一个 `loadMonth(month)`，其余（翻页、缓存、渲染）都在这里。
 * 这个项目今天已经因为「同一件事有两份独立实现」踩过三次坑
 * （底部栏 vs 手势、两份返回键名单、两份分区标签条），不想有第四次。
 *
 * ## 按月缓存
 *
 * 来回翻月是很自然的操作，每翻一次都重新请求既慢又浪费。
 * 缓存放在 ref 里而不是 state：它的变化不需要触发重渲染，
 * 真正驱动画面的是 `marks`（当前月那一份）。
 *
 * @param value      'YYYY-MM-DD'
 * @param onChange   选中某一天时回调，参数同上
 * @param loadMonth  (month:'YYYY-MM') => Promise<string[]>，返回该月有内容的日期
 * @param children   触发器；不给就用 DatePicker 自己的输入框
 */
export default function DateMarkPicker({
  value, onChange, loadMonth, open, onOpenChange, style, className, children, ...rest
}) {
  const d = value ? dayjs(value) : dayjs()
  const [panelMonth, setPanelMonth] = useState(d.format('YYYY-MM'))
  const [marks, setMarks] = useState(null)
  const cache = useRef({})

  // 选中日期换到别的月份时，面板也跟过去——否则下次打开还停在上次翻到的月
  useEffect(() => {
    if (value) setPanelMonth(dayjs(value).format('YYYY-MM'))
  }, [value])

  const load = useCallback((month) => {
    if (cache.current[month]) {
      setMarks(cache.current[month])
      return
    }
    let alive = true
    // 先清空，否则翻月的瞬间会拿上一个月的标注去套新月份的格子，
    // 短暂标错几天比不标更让人困惑
    setMarks(null)
    Promise.resolve(loadMonth(month))
      .then((list) => {
        const set = new Set(list || [])
        cache.current[month] = set
        if (alive) setMarks(set)
      })
      .catch(() => { if (alive) setMarks(new Set()) })
    return () => { alive = false }
  }, [loadMonth])

  useEffect(() => { load(panelMonth) }, [panelMonth, load])

  return (
    <DatePicker
      {...rest}
      open={open}
      onOpenChange={onOpenChange}
      value={value ? dayjs(value) : null}
      allowClear={false}
      inputReadOnly
      className={className}
      style={style}
      onChange={(v) => { if (v) onChange(v.format('YYYY-MM-DD')) }}
      // 这一行是整个组件的意义所在：翻月时才知道用户在看哪个月
      onPanelChange={(v) => v && setPanelMonth(v.format('YYYY-MM'))}
      cellRender={(current, info) => {
        if (info.type !== 'date') return info.originNode
        const has = marks?.has(current.format('YYYY-MM-DD'))
        return (
          <div className="ant-picker-cell-inner" style={has
            ? { background: '#fff1e6', color: '#d4380d', fontWeight: 700, borderRadius: 4 }
            : undefined}
          >
            {current.date()}
          </div>
        )
      }}
    >
      {children}
    </DatePicker>
  )
}
