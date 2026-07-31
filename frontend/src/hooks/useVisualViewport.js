import { useEffect, useState } from 'react'

/**
 * 可视视口（visualViewport）追踪：返回 `{ h, top }`，拿不到该 API 时是 `{ h: null, top: 0 }`。
 *
 * 软键盘弹出时 iOS **不缩布局视口**，只缩可视视口；所以任何靠布局视口定位的做法
 * （100vh、sticky bottom、fixed inset:0）都会把底部的输入区留在键盘背面。
 * 反过来，按 `top = offsetTop`、`height = height` 摆一个 fixed 层，键盘一弹层就变矮，
 * 底部工具条正好停在键盘上沿，一行换算都不用做。
 *
 * `resize` 管键盘开合，`scroll` 管 iOS 顶不动页面、改成偏移可视视口的那种情况。
 *
 * 群聊页和私信页各自内联了同一段逻辑（早于这个 hook），暂时没动——它们跑了很久，
 * 为了去重去改两个已经稳定的沉浸式页面不划算。新页面用这里这一份。
 */
export default function useVisualViewport() {
  const [vp, setVp] = useState({ h: null, top: 0 })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const update = () => setVp({ h: vv.height, top: vv.offsetTop })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return vp
}
