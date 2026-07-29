import { Badge } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { TABS, activeTab } from './mobileNav'

const BRAND = '#fa541c'

/**
 * 移动端底部 Tab 栏：图标在上、小字在下，四个入口常驻沉底。
 *
 * 哪些页面不显示由 mobileNav.showTabBar 决定（那份规则拿全部路由跑过），
 * 这个组件只管画。
 *
 * 三个细节：
 *
 * - **padding-bottom 用 env(safe-area-inset-bottom)**：全面屏底部有一条 Home 指示条，
 *   不留出来的话最下面一行字会被它压住，而在没有指示条的机器上又不能白留一条。
 * - **position: fixed 而不是 sticky**：内容区是普通文档流，sticky 只在滚动容器内有效，
 *   页面短的时候就会浮在内容中间。
 * - 高度写成常量导出给外面用：内容区要 padding-bottom 同样的高度，
 *   否则最后一条内容会被这条栏永久盖住，两边各写一个数迟早对不上。
 */
export const TAB_BAR_HEIGHT = 52

/** 移动端顶栏高度：上下各 8 的内边距 + 34 高的搜索框。刘海另算（见 AppLayout 的占位块）。 */
export const TOP_BAR_HEIGHT = 50

export default function MobileTabBar({ pmUnread = 0, meUnread = 0 }) {
  const navigate = useNavigate()
  const location = useLocation()
  const active = activeTab(location.pathname)

  const badgeOf = (key) => (key === 'pm' ? pmUnread : key === 'mine' ? meUnread : 0)

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 200,
        display: 'flex', alignItems: 'stretch',
        height: TAB_BAR_HEIGHT,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxSizing: 'content-box',
        background: 'rgba(255,255,255,.96)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderTop: '1px solid #f0f0f0',
      }}
    >
      {TABS.map((t) => {
        const on = active === t.key
        const Icon = t.icon
        const n = badgeOf(t.key)
        return (
          <div
            key={t.key}
            onClick={() => navigate(t.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              cursor: 'pointer', userSelect: 'none',
              color: on ? BRAND : '#8c8c8c',
              // -webkit-tap-highlight-color：安卓上点一下会闪一块灰，很廉价
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Badge count={n} size="small" offset={[2, 0]}>
              <Icon style={{ fontSize: 20, color: on ? BRAND : '#8c8c8c' }} />
            </Badge>
            <span style={{ fontSize: 10, lineHeight: 1, fontWeight: on ? 700 : 400 }}>{t.label}</span>
          </div>
        )
      })}
    </div>
  )
}
