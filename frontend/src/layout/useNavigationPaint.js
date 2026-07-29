import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * 换页之后的滚动位置与重绘。
 *
 * ## 起因
 *
 * iOS 上出现过好几次：**从一页退回上一页，内容不画出来，一片空白，手指划一下才全部出现。**
 * 先是在百家说首页（退出专题后），后来在联盟排行（点进球员再退回）——后者页面上
 * 一张图都没有，所以和背景图无关，是**后退导航本身**的问题。
 *
 * 症状的关键在于**位置是留着的**：下面的内容没有往上顶，只是那一块没画。
 * 也就是布局算对了、绘制没跟上——WebKit 的分块光栅化没有重新画那几块。
 *
 * ## 这里做两件事
 *
 * ### 1. 前进时回到顶部（真正的修正，不是补丁）
 *
 * `<BrowserRouter>` 不管滚动位置，所以以前是这样的：在排行榜滑到很下面，点进球员页，
 * **新页面直接从中间开始**；球员页比排行榜短的话，浏览器又会把滚动位置夹回该页的最大值。
 * 一来一回，每一页的滚动位置都被别的页面牵着走。
 *
 * 进入一个新页面本来就该从头看，所以 PUSH 一律回到 0。
 * **后退（POP）不动**——退回去要保留原来看到哪儿，那是浏览器自己在做的事。
 * 只盯 `pathname`：查询串变化（选赛季、翻日期，走的都是 replace）不该把人弹回顶部。
 *
 * ### 2. 换页后轻推一下，逼它重画（补丁，且明说是补丁）
 *
 * 用户自己发现"划一下就正常"——那就用代码做同样的事：滚动 1px 再滚回来。
 * 1px 看不出来，但足以让 WebKit 重新光栅化可视区。
 *
 * 只在**内容高度真的变了**之后推（数据到货、列表撑开），因为空白正是"先画了一次，
 * 内容才到"造成的。用 ResizeObserver 盯着，且只盯换页后的 3 秒——
 * 常驻监听会在每次展开/收起时都触发一下，不值得。
 *
 * **人一碰屏幕就停手**：用户自己滑动本来就会重绘，这时候再去 scrollTo 会打断
 * iOS 的惯性滚动，手感很糟。
 *
 * > 这一段是补丁。真正的原因还没在真机上定位到（本地没有 iOS 环境），
 * > 一旦查清是哪个元素没重绘，应该回来把它删掉。
 */
export default function useNavigationPaint(enabled) {
  const location = useLocation()
  const navType = useNavigationType()

  // ① 前进/跳转时回到顶部；后退保留浏览器恢复的位置
  useEffect(() => {
    if (navType === 'POP') return
    window.scrollTo(0, 0)
  }, [location.pathname, navType])

  // ② 换页后的重绘轻推
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') return undefined

    let alive = true
    const nudge = () => {
      if (!alive) return
      const y = window.scrollY
      window.scrollTo(0, y + 1)
      requestAnimationFrame(() => { if (alive) window.scrollTo(0, y) })
    }

    let lastH = document.documentElement.scrollHeight
    const ro = new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight
      if (h === lastH) return   // 高度没变就不是"内容到货"，别瞎推
      lastH = h
      nudge()
    })
    ro.observe(document.body)

    const stop = () => { alive = false; ro.disconnect() }
    // 人开始碰屏幕就交还控制权：他自己滑动就会重绘，我们再插手只会打断惯性滚动
    window.addEventListener('touchstart', stop, { once: true, passive: true })
    const timer = setTimeout(stop, 3000)   // 换页后 3 秒之外的高度变化与这次导航无关

    return () => {
      clearTimeout(timer)
      window.removeEventListener('touchstart', stop)
      stop()
    }
    // location.key 每次导航都变（含同一路径的重复进入），正是"这一次导航"的标识
  }, [location.key, enabled])
}
