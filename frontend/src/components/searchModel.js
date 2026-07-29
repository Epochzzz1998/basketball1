import { NBA_TEAM_NAMES, teamRegion } from '../pages/players/rankConfig'

/**
 * 全局搜索的**数据部分**：最近搜索的存取、以及把接口返回打平成一串可渲染的行。
 * 长相在 SearchResults.jsx。
 *
 * 拆成两个文件不只是为了好看：现在有**两个**搜索界面（桌面顶栏的 cmd-k 弹窗、
 * 移动端的整页搜索），两边显示的结果必须一模一样——分组顺序、哪些组对谁可见。
 * 各写一份的话，以后加一个"球队"组只会加在其中一边，而且很久都不会有人发现。
 *
 * 这里刻意**不产出任何 JSX**：打平只决定"有哪些行、每行指向哪儿"，
 * 具体长什么样是渲染的事。分开之后这个文件可以纯逻辑地推演，不用起一个 React 环境。
 */

/**
 * 最近搜索：只存关键词，最多 10 条，放 localStorage（换设备不同步，够用）。
 *
 * **只在"点了某条结果"时记录**，不在每次查询时记。查询是防抖触发的，
 * 打字过程中「杜」「杜兰」「杜兰特」会各触发一次，全记下来历史里全是半截词。
 * 点了结果说明这次搜索真的有用，才值得留。
 */
export const HISTORY_KEY = 'epoch:search-history'
const HISTORY_MAX = 10

export const readHistory = () => {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []
  } catch {
    return []   // 存的东西坏了就当没有，别让搜索框整个崩掉
  }
}

export const pushHistory = (kw) => {
  const k = (kw || '').trim()
  if (!k) return readHistory()
  // 已存在就提到最前，不产生重复项
  const next = [k, ...readHistory().filter((s) => s !== k)].slice(0, HISTORY_MAX)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式下 localStorage 会抛，历史丢了不影响搜索本身
  }
  return next
}

export const dropHistory = () => {
  try { localStorage.removeItem(HISTORY_KEY) } catch { /* 隐私模式下会抛，忽略 */ }
  return []
}

/** 球队是固定的 30 支（前端配置），直接本地匹配：队码（不分大小写）或中文名包含关键词 */
function matchTeams(kw) {
  const k = kw.trim().toLowerCase()
  if (!k) return []
  return Object.entries(NBA_TEAM_NAMES)
    .filter(([code, name]) => code.toLowerCase().includes(k) || name.includes(kw.trim()))
    .slice(0, 6)
    .map(([code, name]) => ({ code, name, ...teamRegion(code) }))
}

/**
 * 把接口返回打平成 `[{kind:'group'}, {kind:'item'}, ...]`，方便键盘上下移动。
 *
 * @param d       /search/global 的返回
 * @param kw      当前关键词（球队是前端本地匹配的，要用它）
 * @param canData NBA 模块对本人是否开放；关着就不出球队组（球员组由后端一并过滤）
 */
export function flatten(d, kw, canData) {
  const out = []
  const push = (group, type, items) => {
    if (!items?.length) return
    out.push({ kind: 'group', key: `g-${group}`, label: group })
    items.forEach((it) => out.push({ kind: 'item', type, ...it }))
  }
  push('球员', 'player', d?.players?.map((p) => ({ key: `player:${p.playerId}`, to: `/players/${p.playerId}`, d: p })))
  push('球队', 'team', canData ? matchTeams(kw).map((t) => ({ key: `team:${t.code}`, to: `/players/team/${t.code}`, d: t })) : [])
  push('新闻', 'news', d?.news?.map((n) => ({ key: `news:${n.newsId}`, to: `/news/${n.newsId}`, d: n })))
  push('专题', 'topic', d?.topics?.map((t) => ({ key: `topic:${t.topicId}`, to: `/news/topic/${t.topicId}`, d: t })))
  push('资讯', 'forum', d?.forum?.map((n) => ({ key: `forum:${n.newsId}`, to: `/news/${n.newsId}`, d: n })))
  push('用户', 'user', d?.users?.map((u) => ({ key: `user:${u.userId}`, to: `/users/${u.userId}`, d: u })))
  return out
}
