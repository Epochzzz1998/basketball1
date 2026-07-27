/**
 * 帖子正文里的 @ 提及（wangeditor 的 mention 节点）。
 *
 * 存成 `<span data-w-e-type="mention" data-info="URL编码的JSON">@名字</span>`，
 * 被 @ 的是谁全在 data-info 里：`{id}` 是用户，`{id, kind:'player'}` 是球员。
 * 插件只序列化这两个属性，kind 没法直接写成 HTML 属性，所以渲染前走一趟 DOM 把它提出来。
 */

export const MENTION_SELECTOR = '[data-w-e-type="mention"]'

/** 读一个 mention span 的 data-info；坏数据回 null（不能让一个烂 span 崩掉整篇正文）。 */
export function readMentionInfo(span) {
  try {
    return JSON.parse(decodeURIComponent(span.getAttribute('data-info') || ''))
  } catch {
    return null
  }
}

/**
 * 给球员的 mention span 打上 `data-mention-kind="player"`，好让 CSS 选得中（选择器读不了 JSON）。
 * 传进来的必须是 **已经 DOMPurify 净化过** 的 HTML——这里只是加属性，不做任何安全处理。
 */
export function markPlayerMentions(html) {
  if (!html || !html.includes('data-w-e-type')) {
    return html
  }
  const box = document.createElement('div')
  box.innerHTML = html
  box.querySelectorAll(MENTION_SELECTOR).forEach((el) => {
    if (readMentionInfo(el)?.kind === 'player') {
      el.setAttribute('data-mention-kind', 'player')
    }
  })
  return box.innerHTML
}

/** 点击 mention 该去哪：球员进资料卡，用户进个人主页。不认识就回 null（不跳）。 */
export function mentionHref(info) {
  if (!info?.id) return null
  return info.kind === 'player' ? `/players/${info.id}` : `/users/${info.id}`
}

/** 正文里 @ 球员的样式：金标 + 🏆，沿用老「认证球员」那套 gold 配色（antd Tag color="gold"）。 */
export const MENTION_CSS = [
  `.rich-content ${MENTION_SELECTOR}{color:#1677ff;font-weight:600;cursor:pointer}`,
  `.rich-content [data-mention-kind="player"]{color:#d48806;background:#fffbe6;border:1px solid #ffe58f;`
    + `border-radius:6px;padding:0 6px;font-weight:700;white-space:nowrap}`,
  `.rich-content [data-mention-kind="player"]::before{content:"🏆";margin-right:3px;font-weight:400}`,
].join('')
