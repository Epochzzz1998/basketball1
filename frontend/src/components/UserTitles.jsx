import { parseTitles, TITLE_HEX } from '../utils/titles'

/**
 * 头衔徽章：把头衔串（新格式 JSON [{t,c}]，兼容旧逗号分隔）渲染成一排带色小标签，
 * 展示在用户名旁。空/无头衔时什么都不渲染。
 * 每个头衔按自己的颜色渲染成统一的「浅底 + 同色字 + 淡边」小chip（任意色都一致好看）。
 * size="sm" 用更小字号（评论区、私信头等紧凑处）。
 */
export default function UserTitles({ titles, size }) {
  const list = parseTitles(titles)
  if (!list.length) return null
  const sm = size === 'sm'
  return (
    <>
      {list.map((it) => {
        const hex = TITLE_HEX[it.c] || '#1677ff'
        return (
          <span
            key={it.t}
            style={{
              display: 'inline-flex', alignItems: 'center', marginInlineEnd: 4,
              color: hex, background: `${hex}14`, border: `1px solid ${hex}33`,
              borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap',
              padding: sm ? '0 6px' : '0 7px', fontSize: sm ? 11 : 12, lineHeight: sm ? '16px' : '20px',
            }}
          >
            {it.t}
          </span>
        )
      })}
    </>
  )
}
