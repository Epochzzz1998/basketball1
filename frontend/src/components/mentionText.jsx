import { Link } from 'react-router-dom'

/**
 * 把一段纯文本里被 @ 到的昵称渲染成可点链接（跳该用户主页），其余保持纯文本。
 *
 * `mentionsJson` 是后端存的 `[{id, name}]`，读的时候后端会补一个 `cur`＝该 id 当前的昵称。
 * **定位用 `name`、显示用 `cur`**：正文里存的是发布那一刻的昵称，对方改名之后
 * 文本没变，所以只能按旧名去文本里找位置；但显示要跟上新名字，不然点进去
 * 会看到一个和链接文字对不上的人。
 *
 * 按昵称长度倒序匹配，否则 `@li` 会抢在 `@lisa` 前面命中，把后者切成两半。
 *
 * 帖子评论区和每日赛场的短评区共用这一份——两边的 @ 必须是同一个东西，
 * 各写一份的话，改了一边另一边的表现就悄悄不一样了。
 */
export function renderMentions(content, mentionsJson) {
  if (!content) return content
  let mentions = []
  try { mentions = JSON.parse(mentionsJson || '[]') } catch { mentions = [] }
  const sorted = mentions.filter((m) => m && m.name).sort((a, b) => b.name.length - a.name.length)
  if (!sorted.length) return content
  const nodes = []
  let i = 0
  let k = 0
  while (i < content.length) {
    let hit = null
    if (content[i] === '@') {
      for (const m of sorted) {
        if (content.startsWith('@' + m.name, i)) { hit = m; break }
      }
    }
    if (hit) {
      nodes.push(
        <Link
          key={k++}
          to={`/users/${hit.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#1677ff', fontWeight: 600 }}
        >
          @{hit.cur || hit.name}
        </Link>,
      )
      i += 1 + hit.name.length
    } else {
      let j = content.indexOf('@', i + 1)
      if (j === -1) j = content.length
      nodes.push(content.slice(i, j))
      i = j
    }
  }
  return nodes
}

export default renderMentions
