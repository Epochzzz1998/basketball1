import { CloseOutlined } from '@ant-design/icons'

/**
 * 全站统一的时间输入：原生 <input type="time">。
 * 为什么不用 antd TimePicker：它的下拉滚轮在移动端和页面滚动打架（页面跟着滑）；
 * 原生控件在手机上弹的是系统级时间轮（iOS 底部弹层 / Android 表盘），页面纹丝不动。
 * 值统一用 'HH:mm' 字符串（或 null）。清空不做在框内（太小点不到）——用下面的
 * TimeClear 放在时间组件右侧、一键清整段。
 */
export default function TimeField({ value, onChange, style }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      <input
        type="time"
        value={value || ''}
        onChange={(ev) => onChange(ev.target.value || null)}
        style={{
          width: '100%', height: 32, padding: '0 10px', boxSizing: 'border-box',
          borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 14, fontFamily: 'inherit',
          color: value ? 'rgba(0,0,0,.88)' : '#bfbfbf', background: '#fff', outline: 'none',
        }}
      />
    </span>
  )
}

/** 时间段的清空按钮：放在整组时间的右边，28px 圆钮好点按；点了把开始+结束一起清掉 */
export function TimeClear({ visible, onClear }) {
  if (!visible) return null
  return (
    <span
      onClick={onClear}
      title="清空时间"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
        color: '#999', background: '#f5f5f5',
      }}
    >
      <CloseOutlined style={{ fontSize: 13 }} />
    </span>
  )
}
