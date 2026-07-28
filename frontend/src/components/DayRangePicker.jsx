import { useState } from 'react'
import { DatePicker } from 'antd'
import useIsMobile from '../hooks/useIsMobile'

const { RangePicker } = DatePicker

/**
 * 日期区间选择器。导出备份、清理记录共用，语义都是**闭区间**（含结束日当天）。
 *
 * PC 用 antd 的 RangePicker；**移动端拆成两个单选日历**——RangePicker 的弹层是
 * 左右两个月并排、约 560px 宽，手机屏根本放不下，左边那个月被挤出屏幕点不到。
 * 单个日历只有一个月面板（约 280px），怎么都塞得下。
 *
 * 对外接口和 RangePicker 一致：`value` 是 `[dayjs, dayjs] | null`，两头都选齐才回调
 * `onChange`，只选了一头就当没选（回调 null）。所以调用方不用区分端。
 *
 * 移动端两个日历都加 `inputReadOnly`：不加的话点输入框会先弹出软键盘，把日历面板
 * 顶得不知道去哪了——日期是点出来的，本来就不需要打字。
 */
export default function DayRangePicker({ value, onChange, disabled, disabledDate }) {
  const isMobile = useIsMobile()
  const [from, setFrom] = useState(value?.[0] || null)
  const [to, setTo] = useState(value?.[1] || null)

  /**
   * 这两头**不跟着 value 回写**，是故意的。
   *
   * 只选了一头时我们回调的是 null（半个区间对调用方没用，`range[1].format()` 会直接炸），
   * 父组件 setState 之后 value 同样变成 null。要是再拿 value 反向同步回来，
   * 刚点的那一头会被立刻抹掉——表现就是"第一个日期怎么点都选不上"。
   *
   * 不同步也不会残留旧值：两个弹窗都带 `destroyOnClose`，关掉即卸载，下次打开是全新的一份。
   */

  if (!isMobile) {
    return (
      <RangePicker
        style={{ width: '100%' }}
        value={value}
        onChange={onChange}
        disabled={disabled}
        disabledDate={disabledDate}
      />
    )
  }

  // 顺手挡住反着选：结束日不能早于开始日，反之亦然
  const guard = (which) => (d) => {
    if (disabledDate?.(d)) return true
    if (which === 'to' && from) return d.isBefore(from, 'day')
    if (which === 'from' && to) return d.isAfter(to, 'day')
    return false
  }

  const pick = (which) => (d) => {
    const a = which === 'from' ? d : from
    const b = which === 'to' ? d : to
    if (which === 'from') setFrom(d)
    else setTo(d)
    onChange?.(a && b ? [a, b] : null)
  }

  const row = { display: 'flex', alignItems: 'center', gap: 8 }
  const label = { fontSize: 13, color: '#8c8c8c', width: 34, flexShrink: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={row}>
        <span style={label}>从</span>
        <DatePicker
          style={{ flex: 1 }}
          value={from}
          onChange={pick('from')}
          disabled={disabled}
          disabledDate={guard('from')}
          inputReadOnly
          placeholder="开始日期"
        />
      </div>
      <div style={row}>
        <span style={label}>到</span>
        <DatePicker
          style={{ flex: 1 }}
          value={to}
          onChange={pick('to')}
          disabled={disabled}
          disabledDate={guard('to')}
          inputReadOnly
          placeholder="结束日期"
        />
      </div>
    </div>
  )
}
