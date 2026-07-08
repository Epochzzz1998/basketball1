import { Tag } from 'antd'
import { parseTitles } from '../utils/titles'

/**
 * 头衔徽章：把头衔串（新格式 JSON [{t,c}]，兼容旧逗号分隔）渲染成一排带色小标签，
 * 展示在用户名旁（和金色的认证球员徽章并存）。空/无头衔时什么都不渲染。
 * size="sm" 用更小字号（评论区等紧凑处）。
 */
export default function UserTitles({ titles, size }) {
  const list = parseTitles(titles)
  if (!list.length) return null
  const sm = size === 'sm'
  return (
    <>
      {list.map((it) => (
        <Tag
          key={it.t}
          color={it.c}
          style={{ marginInlineEnd: 4, ...(sm ? { fontSize: 11, lineHeight: '16px', padding: '0 6px' } : {}) }}
        >
          {it.t}
        </Tag>
      ))}
    </>
  )
}
