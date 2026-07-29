import { message } from 'antd'

/**
 * 让装到主屏的 PWA 及时用上新版本，并且**让人知道刚才发生了什么**。
 *
 * ## 原来为什么不够及时
 *
 * vite-plugin-pwa 生成的注册脚本只做一件事：页面 `load` 时注册一次 service worker。
 * 注册这个动作会顺带查一次更新，所以**浏览器里**每次刷新都能拿到新版。
 *
 * 但装到主屏的 PWA 不一样：切后台是**冻结**，切回来是**恢复**，不触发 `load`。
 * 于是可能好几天都不查一次更新。
 *
 * 而且就算查到了、新 service worker 也装好并接管了（sw.js 里有 skipWaiting + clientsClaim），
 * **当前这一屏跑的仍然是已经加载进内存的旧 JS**——service worker 换了不等于页面换了。
 *
 * ## 三件事
 *
 * 1. **回到前台就查一次更新**（visibilitychange）。这正好覆盖"我刚更新了 jar 包，
 *    用户打开 App"这个场景：打开 = 回到前台。
 * 2. **新版本接管时重新加载页面**，让屏幕上的东西也换成新的。
 * 3. **重启前先说一声。** 页面自己闪一下重开，不解释的话看起来就像闪退。
 *    弹一条「系统已更新，正在重启…」再刷，一秒钟的事，但性质完全不同。
 *
 * ## 两个必须处理的边界
 *
 * - **首次安装不能重载。** 页面原本没有 service worker 控制时，`clientsClaim()` 也会触发
 *   一次 `controllerchange`。不区分的话，**每个人第一次打开网站都会白刷一次**。
 *   办法是记住启动时有没有 controller。
 *
 * - **正在打字时不能重载。** 半篇帖子写到一半被刷掉是不可接受的。检测到焦点在输入框里
 *   就先记下来，等下次切回前台再刷——那时候人已经离开过这一屏了。
 *   这种情况也要提示，否则"更新了但没重启"对用户是完全不可见的。
 */

const isTyping = () => {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

/** 提示停留多久再真的刷。太短看不清，太长像卡住了 */
const NOTICE_MS = 900

export default function setupPwaUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // 启动这一刻有没有 controller：没有 = 这是首次安装，之后那次 controllerchange 不算更新
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  let pending = false

  const reload = () => {
    if (reloading) return
    reloading = true
    // message 是 antd 的静态方法，React 19 的兼容补丁在 main.jsx 里最先导入过了。
    // 万一提示这一步出了岔子（补丁没生效、message 被裁剪掉），也绝不能挡住重启本身
    try {
      message.loading({ content: '系统已更新，正在重启…', duration: NOTICE_MS / 1000 })
    } catch { /* 提示失败无所谓，下面照样刷 */ }
    setTimeout(() => window.location.reload(), NOTICE_MS)
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return          // 首次安装，别刷
    if (isTyping()) {
      pending = true
      // 这条要说清楚"为什么没立刻重启"，否则下一次莫名其妙的重启更让人困惑
      try {
        message.info({ content: '系统已更新，等你写完会自动重启', duration: 4 })
      } catch { /* 同上 */ }
      return
    }
    reload()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    // 回前台：先把欠着的那次刷新补上（此时人刚离开又回来，不会打断输入）
    if (pending) { reload(); return }
    // 否则主动查一次更新。查不到就什么也不会发生
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {})
  })
}
