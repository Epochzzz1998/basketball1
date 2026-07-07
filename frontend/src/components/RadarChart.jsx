import useIsMobile from '../hooks/useIsMobile'

/**
 * 手绘 SVG 雷达图（无图表库依赖），支持多系列覆盖对比。
 * series: [{ color, fill, data: [{label, value(0-100)}] }]——轴标签取第一个系列；
 * 多系列时顶点数值按系列颜色并排显示（如 76 / 41）。
 */
export default function RadarChart({ series, size = 300 }) {
  const isMobile = useIsMobile()
  if (!series?.length || !series[0].data?.length) return null
  // 移动端缩小视口坐标系（viewBox 数值），配合下方 width:100% 让轴标签在窄容器里相对更大、更好认
  const chartSize = isMobile ? Math.min(size, 230) : size
  const axes = series[0].data.map((d) => d.label)
  const N = axes.length
  const cx = chartSize / 2
  const cy = chartSize / 2 + 6
  const R = chartSize / 2 - 52
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]
  const poly = (frac) => Array.from({ length: N }, (_, i) => pt(i, R * frac).join(',')).join(' ')
  const valuePoly = (data) =>
    data.map((d, i) => pt(i, R * Math.max(0.05, d.value / 100)).join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${chartSize} ${chartSize}`} style={{ width: '100%', maxWidth: 380, display: 'block', margin: '0 auto' }}>
      <polygon points={poly(1)} fill="#fafafa" stroke="#eaeaea" />
      {[0.75, 0.5, 0.25].map((f) => (
        <polygon key={f} points={poly(f)} fill="none" stroke="#ececec" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#ececec" />
      })}
      {series.map((s, si) => (
        <g key={si}>
          <polygon points={valuePoly(s.data)} fill={s.fill} stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
          {s.data.map((d, i) => {
            const [x, y] = pt(i, R * Math.max(0.05, d.value / 100))
            return <circle key={i} cx={x} cy={y} r="3.2" fill={s.color} />
          })}
        </g>
      ))}
      {axes.map((label, i) => {
        const [x, y] = pt(i, R + 30)
        return (
          <text key={i} x={x} y={y} textAnchor="middle" fontSize="12" fill="#666">
            <tspan x={x} dy="-3" fontWeight="600">{label}</tspan>
            <tspan x={x} dy="14">
              {series.map((s, si) => (
                <tspan key={si} fill={s.color} fontWeight="700">
                  {si > 0 ? ' / ' : ''}{s.data[i].value}
                </tspan>
              ))}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
