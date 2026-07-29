/**
 * 让装到主屏的 PWA 及时用上新版本。
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
 * ## 两件事
 *
 * 1. **回到前台就查一次更新**（visibilitychange）。
 * 2. **新版本接管时重新加载页面**，让屏幕上的东西也换成新的。
 *
 * ## 两个必须处理的边界
 *
 * - **首次安装不能重载。** 页面原本没有 service worker 控制时，`clientsClaim()` 也会触发
 *   一次 `controllerchange`。不区分的话，**每个人第一次打开网站都会白刷一次**。
 *   办法是记住启动时有没有 controller。
 *
 * - **正在打字时不能重载。** 半篇帖子写到一半被刷掉是不可接受的。检测到焦点在输入框里
 *   就先记下来，等下次切回前台再刷——那时候人已经离开过这一屏了。
 */

const isTyping = () => {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export default function setupPwaUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // 启动这一刻有没有 controller：没有 = 这是首次安装，之后那次 controllerchange 不算更新
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  let pending = false

  const reload = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return          // 首次安装，别刷
    if (isTyping()) { pending = true; return }
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
