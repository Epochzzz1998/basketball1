import { CloseCircleFilled } from '@ant-design/icons'

/**
 * 全站统一的时间输入：原生 <input type="time">。
 * 为什么不用 antd TimePicker：它的下拉滚轮在移动端和页面滚动打架（页面跟着滑）；
 * 原生控件在手机上弹的是系统级时间轮（iOS 底部弹层 / Android 表盘），页面纹丝不动。
 * 值统一用 'HH:mm' 字符串（或 null）；有值时右侧出清空 ✕。
 */
export default function TimeField({ value, onChange, style }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      <input
        type="time"
        value={value || ''}
        onChange={(ev) => onChange(ev.target.value || null)}
        style={{
          width: '100%', height: 32, padding: '0 24px 0 10px', boxSizing: 'border-box',
          borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 14, fontFamily: 'inherit',
          color: value ? 'rgba(0,0,0,.88)' : '#bfbfbf', background: '#fff', outline: 'none',
        }}
      />
      {value && (
        <CloseCircleFilled
          onClick={() => onChange(null)}
          title="清空"
          style={{ position: 'absolute', right: 7, color: 'rgba(0,0,0,.25)', cursor: 'pointer', fontSize: 12 }}
        />
      )}
    </span>
  )
}
