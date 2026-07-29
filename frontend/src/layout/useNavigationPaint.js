import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * 换页时的滚动位置——自己接管，不交给浏览器。
 *
 * ## 症状与最后那条决定性的线索
 *
 * iOS 上反复出现：从一页进另一页、再退回来，**内容位置留着但画不出来，一片空白，
 * 手指划一下才全部出现**。先后在百家说首页（退出专题后）和联盟排行（点进球员再退回）
 * 都遇到过，后者页面上一张图都没有——所以和背景图、和合成层都无关。
 *
 * 真正把变量隔离出来的是用户的这句话：
 *
 * > 「点最上面的得分榜的球员，点出来没问题，但是点下面的榜单的球员，就会有空白」
 *
 * 上面的榜不用滚，`scrollY = 0`；下面的榜要滚下去，`scrollY > 0`。
 * **唯一的差别就是后退时要不要恢复一个非零的滚动位置。**
 *
 * ## 为什么浏览器自己恢复会出事
 *
 * 后退这一刻，页面会被 React 整个重画，而数据是**异步**来的：
 *
 * ```
 * 后退 → 组件重新挂载（loading，页面很矮）→ 浏览器在这时恢复到 1800
 *                                              ↑ 文档根本没那么高，被夹掉
 *      → 接口回来，列表撑开，页面变高
 *                                              ↑ 浏览器已经恢复过了，不会再来一次
 * ```
 *
 * 于是滚动位置和文档高度对不上，WebKit 那一批分块光栅化的结果也跟着不一致——
 * 表现就是"位置留着但没画"。用户随便划一下，重新光栅化，内容就出来了。
 *
 * ## 改法：等内容到齐了再定位
 *
 * 1. `history.scrollRestoration = 'manual'`，把恢复权从浏览器手里拿过来；
 * 2. 自己按**历史条目**记滚动位置（`location.key` 每条历史一个，后退回去还是原来那个）；
 * 3. 后退时**不立刻跳**，用 rAF 盯着文档高度，等它真的够高了再 `scrollTo`——
 *    这一下是真正的滚动，顺带也把该重绘的重绘了。
 *
 * 前进/跳转则一律回到顶部：`<BrowserRouter>` 从来不管滚动，
 * 以前在排行榜滑到很下面点进球员页，新页面是**从中间开始**的。
 *
 * 只在移动端接管：桌面端浏览器自己恢复得好好的，没必要动。
 */

/** 历史条目 → 滚动位置。上限只是防止长会话里无限增长，正常几十条足够 */
const positions = new Map()
const MAX_KEPT = 50

const remember = (key, y) => {
  if (!key) return
  positions.delete(key)          // 删了再塞，让 Map 的插入顺序等于最近使用顺序
  positions.set(key, y)
  while (positions.size > MAX_KEPT) {
    positions.delete(positions.keys().next().value)
  }
}

/** 文档现在最多能滚到哪儿 */
const maxScroll = () =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

export default function useNavigationPaint(enabled) {
  const location = useLocation()
  const navType = useNavigationType()
  const key = location.key

  // 把恢复权拿过来。组件卸载/切到桌面端时还回去
  useEffect(() => {
    if (!enabled || !('scrollRestoration' in window.history)) return undefined
    const prev = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = prev }
  }, [enabled])

  // 记录当前这条历史条目滚到哪儿了
  useEffect(() => {
    if (!enabled) return undefined
    const onScroll = () => remember(key, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      remember(key, window.scrollY)   // 离开前再存一次，防止最后一次滚动没赶上
    }
  }, [key, enabled])

  // 换页之后定位
  useEffect(() => {
    if (!enabled) return undefined

    // 前进/跳转：新页面从头看。后退：回到离开时的位置
    const target = navType === 'POP' ? (positions.get(key) ?? 0) : 0
    if (target <= 0) {
      window.scrollTo(0, 0)
      return undefined
    }

    /**
     * 内容是异步来的，直接 scrollTo 会被夹到当前文档高度——那正是这个 bug 的成因。
     * 所以盯着文档高度，够了再跳；2 秒还不够就按当前能滚到的最大值落地
     * （接口挂了、或者这一页本来就变短了，总不能一直等下去）。
     */
    let stopped = false
    let raf = 0
    const deadline = performance.now() + 2000
    const tick = () => {
      if (stopped) return
      if (maxScroll() >= target || performance.now() > deadline) {
        window.scrollTo(0, Math.min(target, maxScroll()))
        stopped = true
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // 人一碰屏幕就收手：他自己滑动就已经到了想看的地方，这时再跳会很突兀，
    // 而且会打断 iOS 的惯性滚动
    const stop = () => { stopped = true; cancelAnimationFrame(raf) }
    window.addEventListener('touchstart', stop, { once: true, passive: true })
    return () => {
      window.removeEventListener('touchstart', stop)
      stop()
    }
  }, [key, navType, enabled])
}
