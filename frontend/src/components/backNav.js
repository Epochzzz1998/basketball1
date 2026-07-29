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
