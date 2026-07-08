import { Tag } from 'antd'

/**
 * 头衔徽章：把逗号分隔的头衔串渲染成一排紫色小标签，展示在用户名旁（和金色的认证球员徽章并存）。
 * 空串/无头衔时什么都不渲染。size="sm" 用更小的字号（评论区等紧凑处）。
 */
export default function UserTitles({ titles, size }) {
  const list = String(titles || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!list.length) return null
  const sm = size === 'sm'
  return (
    <>
      {list.map((t) => (
        <Tag
          key={t}
          color="purple"
          style={{ marginInlineEnd: 4, ...(sm ? { fontSize: 11, lineHeight: '16px', padding: '0 6px' } : {}) }}
        >
          {t}
        </Tag>
      ))}
    </>
  )
}
