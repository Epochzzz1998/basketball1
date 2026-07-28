/**
 * 类别筛选器（会换行的胶囊）。百家说首页筛专题、专题内筛帖子，两处共用。
 *
 * 没用 Segmented：它是一整条不换行的横条，类别一多就在手机上溢出屏幕
 * （赛季选择器踩过同样的坑）。胶囊自然换行，多少个都放得下。
 */
const BRAND = '#fa541c'

export default function CategoryFilter({ options, value, onChange, extra }) {
  if (!options?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <span
            key={o.value ?? 'all'}
            onClick={() => onChange(o.value)}
            style={{
              cursor: 'pointer', userSelect: 'none', fontSize: 13, lineHeight: 1.5,
              padding: '4px 14px', borderRadius: 999,
              color: on ? '#fff' : '#595959',
              background: on ? BRAND : '#fff',
              border: `1px solid ${on ? BRAND : '#e8e8e8'}`,
              fontWeight: on ? 600 : 400,
              transition: 'all .15s',
            }}
          >
            {o.label}
            {o.count != null && (
              <span style={{ marginLeft: 5, opacity: on ? 0.75 : 0.5, fontSize: 12 }}>{o.count}</span>
            )}
          </span>
        )
      })}
      {extra}
    </div>
  )
}
