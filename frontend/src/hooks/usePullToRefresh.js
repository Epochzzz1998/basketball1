import { useEffect, useRef, useState } from 'react'
import { inOverlay } from '../utils/overlay'

/**
 * 下拉刷新（移动端）。
 *
 * 没装移动端组件库，所以是手写的触摸手势。要处理对的地方比看上去多：
 *
 * 1. **只在页面真的滚到顶时才算下拉。** 不判断的话，在列表中间往下滑也会触发，
 *    正常滚动全被吃掉。
 * 2. **超过阈值才 preventDefault。** 一上来就阻止默认行为会把正常滚动也废掉；
 *    等确认是"到顶了还在往下拉"才接管。
 * 3. **阻尼。** 手指拉 100px 只让指示器走 50px，不然一拉就到底，手感很轻浮。
 * 4. **touchend 后必须归零**，包括刷新失败的路径——否则指示器会永远卡在半空。
 *
 * @param onRefresh 返回 Promise 的刷新函数
 * @param enabled   false 时整个手势不挂载（桌面端、或不需要刷新的页面）
 */
export default function usePullToRefresh(onRefresh, enabled = true) {
  const [pull, setPull] = useState(0)        // 当前下拉距离（已阻尼），px
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)               // 这一次触摸是不是"从顶部开始的下拉"
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  const THRESHOLD = 64                       // 松手即刷新的距离
  const DAMP = 0.45                          // 阻尼系数
  const MAX = 96

  useEffect(() => {
    if (!enabled) return undefined

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0

    const onStart = (e) => {
      // 浮层里不接管（见 utils/overlay 的说明）：抽屉开着时背景页滚动被锁死，
      // atTop() 恒为真，不挡的话抽屉里所有往下的手指移动都会被这里劫走
      if (refreshing || !atTop() || inOverlay(e.target)) {
        active.current = false
        return
      }
      startY.current = e.touches[0].clientY
      active.current = true
    }

    const onMove = (e) => {
      if (!active.current || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        // 改成往上滑了：交还给正常滚动，并把指示器收回去
        active.current = false
        setPull(0)
        return
      }
      // 手指在往下拉且页面在顶部 —— 从这里开始接管，阻止橡皮筋/整页滚动
      if (e.cancelable) e.preventDefault()
      setPull(Math.min(MAX, dy * DAMP))
    }

    const onEnd = async () => {
      if (!active.current) return
      active.current = false
      if (pull < THRESHOLD) {
        setPull(0)
        return
      }
      setRefreshing(true)
      setPull(THRESHOLD)                     // 停在阈值位置转圈，别一松手就跳没
      try {
        await onRefreshRef.current?.()
      } finally {
        setRefreshing(false)
        setPull(0)
      }
    }

    // passive: false 才允许 preventDefault
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, refreshing, pull])

  return { pull, refreshing, threshold: THRESHOLD }
}
