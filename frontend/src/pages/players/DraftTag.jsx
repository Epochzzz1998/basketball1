import { Link } from 'react-router-dom'
import { draftText, draftTier } from './draftConfig'

/**
 * 身份头上那一枚。可点，落到历史数据的选秀那一届。
 *
 * `year` 走查询串而不是路径参数：历史数据页的三个板块本来就用 `?tab=` 切，
 * 再加一层路径会让「返回」多退一步。
 */
export default function DraftTag({ draft, size = 'normal' }) {
  if (!draft) return null
  const pick = Number(draft.pickNum) || 0
  const tier = draftTier(pick)
  const small = size === 'small'
  return (
    <Link
      to={`/history?tab=draft&year=${draft.draftYear}`}
      title={pick ? `第 ${pick} 顺位 · 第 ${draft.roundNum} 轮 · ${draft.team || ''}` : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: small ? '0 6px' : '1px 9px',
        fontSize: small ? 11 : 12, fontWeight: 700, lineHeight: small ? '18px' : '20px',
        borderRadius: 10, color: tier.color, background: tier.bg,
        border: `1px solid ${tier.border}`, whiteSpace: 'nowrap',
      }}
    >
      {draftText(draft)}
    </Link>
  )
}
