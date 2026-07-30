import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 「返回」的行为规则。和长相分开放（长相在 BackButton.jsx）——
 * 这里没有任何 JSX，AppLayout 只想要 NAV_ROOTS 时也不用顺带拖进一个组件。
 */

/**
 * 一级页面（导航直达的根路径）不需要返回按钮。
 * AppLayout 用它决定要不要渲染，useGoBack 用它在没有站内历史时回落。
 */
export const NAV_ROOTS = [
  '/', '/news', '/league', '/players', '/rankings', '/games', '/history', '/compare',
  '/official', '/messages', '/schedule', '/search',
  '/bbq/wage', '/bbq/ledger', '/bbq/burning', '/bbq/members', '/bbq/skewers',
  '/login', '/register', '/403', '/admin/players', '/admin/users',
]

/**
 * 这些页面**自己画了返回**，全局那个要让位，否则一页上会有两个返回。
 *
 * 目前只有专题页（含它下面的 NBA 分区）：返回钮压在专题横幅的背景图上，
 * 是那块图的一部分。而 NBA 分区页没有底部 Tab 栏，
 * 光靠 `!tabBar` 判断的话全局返回照样会冒出来——用户就是在这几页看到重复的。
 *
 * 注意不含 `/chat`：群聊是另一个组件，没有横幅，那个返回得留着。
 */
const SELF_BACK = [
  /^\/news\/topic\/[^/]+$/,              // 专题帖子流
  // 专题里的任意模块分区（`/news/topic/{id}/{模块}/{分区}`，现在是 nba 和 lol）。
  //
  // **刻意写成模块无关的三段式**，而不是把 `nba`、`lol` 一个个列出来：
  // 这几页共同的性质是「渲染在专题页里，返回钮已经画在横幅上」，
  // 和它是哪个模块无关。开黑战绩上线时就是漏了这一条——名单只加在了
  // mobileNav 那份，这份忘了，于是那几个 tab 上冒出两个返回钮。
  //
  // 群聊 `/news/topic/{id}/chat` 只多一段，匹配不到，正合适：
  // 它是另一个组件、没有横幅，那个返回得留着。
  /^\/news\/topic\/[^/]+\/[^/]+\/[^/]+$/,
  // 帖子详情：返回画进了顶部那张卡里（NewsDetail），单独占一行只是白白空出一截。
  // `(?!new$)` 排除 /news/new（发帖页），它没有自己的返回
  /^\/news\/(?!new$)[^/]+$/,
]

export const hasOwnBack = (pathname) => SELF_BACK.some((re) => re.test(pathname))

/**
 * 返回一步。
 *
 * 优先走站内历史（`-1` 就是「上一级」）。但直链进来时（别人发的链接、通知点进来、
 * 主屏图标启动）历史里没有上一页，`navigate(-1)` 会退出整个网站。
 * 所以先看 `history.state.idx`——React Router 给每条历史记录编了号，
 * 大于 0 才说明这一页前面确实还有我们自己的页面。
 * 否则一段段剥路径，回落到最近的一个已知一级页面。
 */
export function useGoBack() {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
      return
    }
    let p = location.pathname
    while (p.length > 1) {
      p = p.replace(/\/[^/]*$/, '') || '/'
      if (NAV_ROOTS.includes(p)) break
    }
    navigate(p || '/', { replace: true })
  }
}
