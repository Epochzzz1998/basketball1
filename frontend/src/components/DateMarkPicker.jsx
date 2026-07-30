import { useEffect, useMemo, useRef, useState } from 'react'
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
 * ## 传给它的 dayjs 对象必须 memo 住，否则面板会被每一次渲染重置
 *
 * rc-picker 内部有个「重置面板到选中日期」的 effect，依赖里包含**当前选中值本身**。
 * 而 `dayjs(value)` 每渲染一次就是一个新对象，依赖每次都变 ⇒ 每渲染一次就重置一次面板，
 * 结果是**日历完全翻不动**。
 *
 * 这个 bug 只在 NBA 那边出现、开黑战绩那边正常，差别正是：战绩流的 `value` 初始为 null
 * （没选日期），null 是稳定的；而 NBA 一进来就有选中日期，于是每渲染都造一个新 dayjs。
 * 同一个组件、两种表现，差别只在传进来的值——**这类「A 正常 B 不正常」的对比
 * 是最快的定位工具**。
 *
 * ## 面板必须是**受控**的，不能只监听
 *
 * 第一版只用 `onPanelChange` 把月份记进 state，没有把它交回给 DatePicker。
 * 结果：翻月的瞬间 `setMarks` 触发重渲染，而面板是 DatePicker 自己管的，
 * 重渲染时它按 `value` 重新同步了一次——于是**点一下翻走、再点一下被拉回来**。
 *
 * 现在用 `pickerValue` + `onPickerValueChange` 把面板完全接管过来：
 * 显示哪个月由我们的 state 说了算，重渲染多少次都不会跳回去。
 * 光监听不控制，是「知道它变了」和「决定它是什么」的区别。
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
  // **必须 memo**：见上面的说明，每渲染新建一个 dayjs 会让 rc-picker 每渲染重置一次面板
  const valueDay = useMemo(() => (value ? dayjs(value) : null), [value])
  const [panelMonth, setPanelMonth] = useState(() => (value ? dayjs(value) : dayjs()).format('YYYY-MM'))
  const [marks, setMarks] = useState(null)
  const cache = useRef({})

  // 选中日期换到别的月份时，面板也跟过去——否则下次打开还停在上次翻到的月
  useEffect(() => {
    if (value) setPanelMonth(dayjs(value).format('YYYY-MM'))
  }, [value])

  /**
   * `loadMonth` 放进 ref，**取数的 effect 只依赖月份**。
   *
   * 否则调用方传一个内联箭头函数（很自然的写法）就会让这个 effect 每渲染都跑一次，
   * 而它里面有 `setMarks`——于是每渲染触发一次重渲染。这正是 NBA 那边和
   * 开黑战绩那边的第二处差异：后者传的是 `useCallback`，前者是内联箭头。
   *
   * 与其要求每个调用方都记得 memo，不如让组件自己对此免疫。
   */
  const loadRef = useRef(loadMonth)
  useEffect(() => { loadRef.current = loadMonth })

  useEffect(() => {
    const month = panelMonth
    if (cache.current[month]) {
      setMarks(cache.current[month])
      return undefined
    }
    let alive = true
    // 先清空，否则翻月的瞬间会拿上一个月的标注去套新月份的格子，
    // 短暂标错几天比不标更让人困惑
    setMarks(null)
    Promise.resolve(loadRef.current(month))
      .then((list) => {
        const set = new Set(list || [])
        cache.current[month] = set
        if (alive) setMarks(set)
      })
      .catch(() => { if (alive) setMarks(new Set()) })
    return () => { alive = false }
  }, [panelMonth])

  // 同理：面板值也要 memo，否则受控的 pickerValue 每渲染都是新对象
  const panelDay = useMemo(() => dayjs(`${panelMonth}-01`), [panelMonth])

  return (
    <DatePicker
      {...rest}
      open={open}
      onOpenChange={onOpenChange}
      value={valueDay}
      allowClear={false}
      inputReadOnly
      className={className}
      style={style}
      onChange={(v) => { if (v) onChange(v.format('YYYY-MM-DD')) }}
      // 面板受控：显示哪个月由这里的 state 决定，重渲染不会把它拉回 value 所在的月
      pickerValue={panelDay}
      onPickerValueChange={(v) => v && setPanelMonth(v.format('YYYY-MM'))}
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
