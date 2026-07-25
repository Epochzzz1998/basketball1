import { NBA_TEAM_NAMES, teamZh } from '../pages/players/rankConfig'

/**
 * NBA 30 队队标。
 * SVG 放在 src/assets/teams/{队码}.svg，由 Vite 打包进 /assets（文件名带 hash，30 天长缓存），
 * code→url 表用 glob 自动生成——以后换标/加队只要替换目录里的文件，代码不用动。
 * 库里的队码已统一到现行 30 队（老特许权在同步阶段就映射过了），
 * 万一遇到认不出的队码，回退成灰底队码块，不留空洞。
 */
const FILES = import.meta.glob('../assets/teams/*.svg', { eager: true, query: '?url', import: 'default' })
const LOGOS = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4).toUpperCase(), url]),
)

const norm = (code) => String(code ?? '').trim().toUpperCase()

/** 单枚队标。size 同时是宽高；非正方形的标（湖人/国王等）在方框里居中留白 */
export default function TeamLogo({ code, size = 22, style, title }) {
  const c = norm(code)
  const url = LOGOS[c]
  const label = title ?? (NBA_TEAM_NAMES[c] || c)
  if (!url) {
    return (
      <span
        title={label}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: size, height: size, borderRadius: '50%', background: '#f0f0f0', color: '#999',
          fontSize: Math.max(9, Math.round(size * 0.34)), fontWeight: 700, ...style,
        }}
      >
        {c.slice(0, 3) || '?'}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={label}
      title={label}
      style={{
        width: size, height: size, objectFit: 'contain', flexShrink: 0,
        display: 'inline-block', verticalAlign: 'middle', ...style,
      }}
    />
  )
}

/**
 * 交易链展开成「队标+中文队名 → 队标+中文队名」（标签这类宽松场合用）。
 * 数据表格里不上队标（用户要求），球队列走下面的 TeamNames 纯文字。
 */
export function TeamChain({ value, size = 15, gap = 4, style }) {
  const hops = String(value ?? '').split('->').map((s) => s.trim()).filter(Boolean)
  if (!hops.length) return '-'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}>
      {hops.map((code, i) => (
        <span key={`${code}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {i > 0 && <span style={{ color: 'inherit', opacity: 0.55, marginRight: 1 }}>→</span>}
          <TeamLogo code={code} size={size} />
          {teamZh(code)}
        </span>
      ))}
    </span>
  )
}

/**
 * 纯文字的中文队名（数据表的球队列、资料卡标签用）。每一站单独包一层 nowrap：
 * 中文没有词边界，浏览器会在任意两个字之间断行——不包的话窄列里会出现
 * 「公牛→凯 / 尔特人」这种断法，包了就只在箭头后换行。
 */
export function TeamNames({ value }) {
  const hops = String(value ?? '').split('->').map((s) => s.trim()).filter(Boolean)
  if (!hops.length) return '-'
  return hops.map((code, i) => (
    <span key={`${code}-${i}`} style={{ whiteSpace: 'nowrap' }}>
      {teamZh(code)}{i < hops.length - 1 ? '→' : ''}
    </span>
  ))
}

/**
 * 榜单卡片里的球队标注：单支球队 = 队标 + 中文队名；转会链退回纯文字
 * （多枚队标会把一行挤爆）。'/' 是生涯汇总行的占位符，原样显示。
 */
export function TeamCell({ value, size = 15 }) {
  const v = String(value ?? '').trim()
  if (!v || v === '/') return v || '-'
  if (v.includes('->')) return <TeamNames value={v} />
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <TeamLogo code={v} size={size} />
      {teamZh(v)}
    </span>
  )
}
