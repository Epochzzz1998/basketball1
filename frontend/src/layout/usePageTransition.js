import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { TABS } from './mobileNav'

/**
 * 换页时给新内容一个方向正确的滑入动画。
 *
 * ## 为什么不用「两页同时在场」那种真·转场
 *
 * iOS 原生那种推进/退出动画要求**旧页和新页同时渲染**，一个滑出、一个滑入。
 * 在 react-router 里做到这点得引入 `react-transition-group` 之类，把 `<Outlet/>`
 * 按 location 分裂成两棵树——而这个站的页面普遍有数据请求、WebSocket 订阅、
 * 滚动位置，同时活着两份的代价和风险都不小。
 *
 * 这里做的是**只让新页滑入**的轻量版：位移 24px + 透明度，180ms。
 * 拿不到"两页交叠"的层次感，但足以让人看出"页面换了、往哪个方向换的"，
 * 而这正是缺了动画时最难受的地方——内容啪一下变了，不知道自己去了哪儿。
 *
 * ## 为什么用 Web Animations API 而不是 CSS 类 / key
 *
 * **绝对不能给容器挂 `key={pathname}`**：那会让整棵子树卸载重建。
 * 这个项目为此栽过一次——错误边界上挂了 `key={location.pathname}`，
 * 结果点 NBA 分区每次都闪一屏满屏 loading（见 useNavigationPaint 的相关说明）。
 *
 * 加 CSS 类再删也不行：同一个元素上重放同一个动画，必须先强制回流，
 * 而那本身就是一次布局抖动。
 *
 * `element.animate()` 每次调用都是一个新的动画对象，天然可以重复触发，
 * 不碰 DOM 结构、不改 class、不引额外依赖。
 */

/** 位移距离。再大就显得拖沓，这是"看得出方向"和"不拖慢操作"的折中 */
const SHIFT = 24
const DURATION = 180

export default function usePageTransition(ref, enabled) {
  const location = useLocation()
  const navType = useNavigationType()
  const prev = useRef(null)

  useEffect(() => {
    const from = prev.current
    prev.current = location.pathname
    if (!enabled || from === null || from === location.pathname) return
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return

    /**
     * 方向：+1 = 从右边进来（前进），-1 = 从左边进来（后退）。
     *
     * Tab 之间横切时按**下标差**判断，这样滑动方向和画面移动方向是一致的；
     * 其余情况按导航类型：POP 是后退，其它是前进。
     */
    const a = TABS.findIndex((t) => t.path === from)
    const b = TABS.findIndex((t) => t.path === location.pathname)
    const dir = a >= 0 && b >= 0 ? Math.sign(b - a) : (navType === 'POP' ? -1 : 1)

    el.animate(
      [
        { opacity: 0.35, transform: `translateX(${dir * SHIFT}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: DURATION, easing: 'cubic-bezier(.22,.61,.36,1)' },
    )
    // location.key 而不是 pathname：同一路径重复进入（比如点当前 Tab）也该有反馈
  }, [location.key, location.pathname, navType, enabled, ref])
}
