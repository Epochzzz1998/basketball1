import { NBA_TEAM_NAMES, fmtTeamChain } from '../pages/players/rankConfig'

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
 * 交易链展开成「队标+队码 → 队标+队码」（标签、资料卡这类宽松场合用）。
 * 表格窄列请用 TeamCell——那里链条只走纯文字，不会把列撑爆。
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
          {code}
        </span>
      ))}
    </span>
  )
}

/**
 * 数据表「球队」列：单支球队 = 队标 + 队码；转会链保持纯文字（多枚队标会把窄列撑到换行，
 * 移动端那套列宽是逐列量过的）。'/' 是生涯汇总行的占位符，原样显示。
 */
export function TeamCell({ value, size = 15 }) {
  const v = String(value ?? '').trim()
  if (!v || v === '/') return v || '-'
  if (v.includes('->')) return fmtTeamChain(v)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <TeamLogo code={v} size={size} />
      {v}
    </span>
  )
}
