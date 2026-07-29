import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TABS } from './mobileNav'
import { useGoBack } from '../components/backNav'

/**
 * 移动端的左右滑手势。
 *
 * ## 为什么不用 WKWebView 自带的那个
 *
 * `allowsBackForwardNavigationGestures` 走的是 **WebView 的历史栈**，语义是
 * "上一次去过的地址"。但 App 的左右滑不是这个意思：
 *
 * | 在哪儿 | 用户的预期 | 历史栈会做什么 |
 * |---|---|---|
 * | 四个 Tab 首页 | 切到相邻的 Tab | 退到上一次访问的**任意**页面 |
 * | 二级页面 | **返回上一级** | 退到"上一次操作的页面"，可能是另一个 Tab |
 *
 * 差别在最左边那一列已经不同了：站在百家说首页往左滑，历史栈会把你带去某个
 * 不相干的地方，而正确的行为是**滑不动**（左边没有 Tab 了）。
 *
 * 所以原生那个关掉，自己按语义实现。
 *
 * ## 两条规则
 *
 * 1. **正好站在某个 Tab 的首页**（`/news` `/schedule` `/messages` `/mine`）——
 *    横滑切换相邻 Tab，到头就不动。注意判断的是**路径完全相等**，
 *    专题页（`/news/topic/x`）虽然也高亮"百家说"，但它是二级页面，走规则 2。
 * 2. **其它页面**——只认**从屏幕左边缘起手**的右滑，等同于点返回。
 *    限定左边缘是必须的：NBA 那些宽表本来就要横向滑动，
 *    不限定的话在表格上滑一下就退出去了。
 *
 * ## 还要躲开横向滚动的东西
 *
 * 类别筛选条、`.ant-segmented`、宽表都能横向滚。手指落在它们里面时整个手势让开，
 * 否则"滑动筛选条"会变成"切换 Tab"。
 */

/** 判定阈值。60px 够区分误触，1.5 倍是为了让斜着划的手势归给纵向滚动 */
const MIN_DX = 60
const RATIO = 1.5
const MAX_MS = 800
/** 二级页面的返回手势必须从这个宽度内起手（和 iOS 自己的边缘手势一个量级） */
const EDGE = 30

/** 手指落点所在的横向滚动容器；没有则返回 null */
const horizontalScrollerAt = (el) => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 4) {
      const ox = getComputedStyle(n).overflowX
      if (ox === 'auto' || ox === 'scroll') return n
    }
  }
  return null
}

export default function useAppSwipe(enabled) {
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = useGoBack()
  // 手势跨越 touchstart/touchend 两个事件，而两者之间可能发生重渲染，
  // 用 ref 存起点免得读到旧闭包里的值
  const start = useRef(null)
  // 最新的位置与动作放进 ref，这样监听器只挂一次、不必随路由反复解绑重绑。
  //
  // **必须在 effect 里写，不能在渲染体里写**：并发模式下一次渲染可能被丢弃重来，
  // 而 ref 的修改不会跟着回滚，于是 ref 里会留下一个从没提交过的状态。
  // effect 在提交之后才跑，写进去的一定是屏幕上真实的那一份。
  const ctx = useRef({ pathname: '', goBack, navigate })
  useEffect(() => {
    ctx.current = { pathname: location.pathname, goBack, navigate }
  })

  useEffect(() => {
    if (!enabled) return undefined

    const onStart = (e) => {
      if (e.touches.length !== 1) { start.current = null; return }
      const t = e.touches[0]
      // 记下落点所在的横向滚动容器（可能为 null）。**不在这里直接放弃**——
      // 两条规则对它的态度不一样，见 onEnd
      const sc = horizontalScrollerAt(e.target)
      start.current = {
        x: t.clientX, y: t.clientY, at: Date.now(),
        scroller: sc, scrollLeft: sc ? sc.scrollLeft : 0,
      }
    }

    const onEnd = (e) => {
      const s = start.current
      start.current = null
      if (!s || Date.now() - s.at > MAX_MS) return
      const t = e.changedTouches?.[0]
      if (!t) return
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * RATIO) return

      const { pathname, goBack: back, navigate: nav } = ctx.current
      const idx = TABS.findIndex((tab) => tab.path === pathname)

      if (idx >= 0) {
        // 规则 1：Tab 首页之间横滑。落在横向滚动容器里就整个让开——
        // "滑动类别筛选条"不该变成"切换 Tab"
        if (s.scroller) return
        // 手指往左 = 去右边那个 Tab
        const next = dx < 0 ? idx + 1 : idx - 1
        if (next < 0 || next >= TABS.length) return   // 到头了，不动
        // replace 而不是 push：Tab 之间来回切不该在历史里堆一串，
        // 否则从二级页面返回时会先退回一堆 Tab 切换记录
        nav(TABS[next].path, { replace: true })
        return
      }

      // 规则 2：二级页面，从左边缘往右滑 = 返回
      if (dx <= 0 || s.x > EDGE) return
      /**
       * 落在横向滚动容器里时，**只有它已经滑到最左边才让返回接管**。
       *
       * 这一条是被 NBA 宽表逼出来的：那些表格从屏幕最左边开始画，手指想返回必然落在表上。
       * 原来的写法是"在横向容器里就一律放弃"，于是出现了一个死角——
       * 表格已经在最左端（右滑滚不动），返回手势又被让掉，**右滑什么都不会发生**。
       *
       * 判据用起手时记下的 scrollLeft，而不是松手时再读：手势过程中表格可能已经被滚过了。
       */
      if (s.scroller && s.scrollLeft > 0) return
      back()
    }

    // passive：全程不 preventDefault，纵向滚动和下拉刷新一点不受影响
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [enabled])
}
