import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TABS, tabIndexOf } from './mobileNav'
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
 * 1. **正好站在某个 Tab 的首页**——横滑切换相邻 Tab，到头就不动。
 *    判据是 `tabIndexOf`，和底部栏的显隐**共用同一个函数**：凡是不显示底部栏的页面
 *    就不算 Tab 首页。专题页（`/news/topic/x`）虽然也高亮"百家说"，但它是二级页面；
 *    私信会话（`/messages?peerId=x`）路径和私信首页**一模一样**，只有查询串不同——
 *    早先这里只比 pathname，于是在聊天里横滑会莫名其妙切到日程。
 * 2. **其它页面**——只认**从屏幕左边缘起手**的右滑，等同于点返回。
 *    凡是左上角有返回钮的页面都该支持，因为手势和那个按钮是同一个动作
 *    （都走 `useGoBack`），只是一个用手指一个用点的。
 *
 * ## 还要躲开横向滚动的东西
 *
 * 类别筛选条、`.ant-segmented`、NBA 的宽表都能横向滚。手指落在它们里面时：
 *
 * - **切 Tab（规则 1）整个让开**——"滑动筛选条"不该变成"切换 Tab"。
 * - **返回（规则 2）只在那个容器本来就停在最左端时接管**。
 *
 * 后面这条是这次放开数据页的关键。早先整类页面被排除，理由是"手势和表格打架，
 * 试过按滚动位置判定但手感很卡"。那次的做法是**松手时**再去读表格滚到哪了，
 * 所以同一个手势在过程中既可能滚表格又可能返回，谁也说不准。
 * 现在读的是**按下那一刻**的位置：表格已经在最左端时，往右滑它一动不动
 * （没得可滚），这一下从头到尾就只可能是返回；表格没在最左端，
 * 这一下就从头到尾只是滚表格。歧义消失了，因为判据在手势开始时就定了。
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
  const ctx = useRef({ pathname: '', search: '', goBack, navigate })
  useEffect(() => {
    // search 也要带上：私信会话靠 ?peerId 区分，只看 pathname 会把聊天页当成 Tab 首页
    ctx.current = { pathname: location.pathname, search: location.search, goBack, navigate }
  })

  useEffect(() => {
    if (!enabled) return undefined

    const onStart = (e) => {
      if (e.touches.length !== 1) { start.current = null; return }
      const t = e.touches[0]
      // 记下落点所在的横向滚动容器（可能为 null），两条规则都要用。
      // **连同它此刻的滚动位置一起记**：判据必须在手势开始时就定死，
      // 松手时再读的话，这一路滑过来它自己已经动了，读到的是结果不是前提
      const scroller = horizontalScrollerAt(e.target)
      start.current = {
        x: t.clientX, y: t.clientY, at: Date.now(),
        scroller,
        scrollerLeft: scroller ? scroller.scrollLeft : 0,
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

      const { pathname, search, goBack: back, navigate: nav } = ctx.current

      const idx = tabIndexOf(pathname, search)

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

      // 规则 2：二级页面，从左边缘往右滑 = 返回。和左上角那个返回钮同一个动作。
      if (dx <= 0 || s.x > EDGE) return
      // 落在横向滚动容器里：只有它**按下时**就停在最左端才让返回接管。
      // 没在最左端说明这一下本来就是要把表格往回滚，不该被劫走
      if (s.scroller && s.scrollerLeft > 0) return
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
