/* eslint-env serviceworker */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { toNotification } from './utils/notification'

/**
 * Service Worker（手写版，vite-plugin-pwa 的 injectManifest 模式）。
 *
 * 为什么不用自动生成的那个：generateSW 生成的 sw.js 是**成品**，没有地方插自己的
 * push / notificationclick 监听。用 importScripts 硬塞也能跑，但那个被塞进来的脚本
 * 会走 HTTP 缓存（updateViaCache 只对主脚本免疫），线上 Cloudflare 给 4 小时，
 * 改一次推送逻辑最长要等 4 小时才生效。自己写就没有这一层。
 *
 * 代价是预缓存和导航兜底要自己接上——就是下面这四行，workbox 都封装好了。
 */

// self.__WB_MANIFEST 由构建期注入：所有产物文件 + 各自的内容哈希。
// 有哈希才知道哪些文件变了要重下、哪些原样保留
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// 整页导航一律吃本地的 index.html（刷新 /news/topic/xxx 不白屏，断网也能开壳）。
// 黑名单里那两个是靠导航打开的**后端地址**：群聊导出走 window.open、附件走 <a download>。
// 不放行的话它们会拿到 index.html —— 点导出弹出个新标签，里面是网站首页，而且不报错。
// 注意别把 /news、/topic 这类前缀整条拉黑：它们同时是前端路由，拉黑等于废掉离线能力，
// 而它们的接口调用是 XHR，本来就不经过导航兜底。
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/picImg\//, /^\/chat\/export/],
}))

// 新版本装好就接管，不等所有旧标签页关掉。
// 这里**不主动刷新页面**：当前这一屏继续用已经加载好的旧代码，下次打开才是新的。
// 换成自动刷新的话，正在打字时部署一次就会把内容刷没。
self.skipWaiting()
clientsClaim()

// ===== 推送 =====

/**
 * 收到一条推送。
 *
 * 载荷里只有**原始字段**（msgType / operatorName / msgId ...），文案和跳转链接
 * 在这里现算，用的是 utils/notification.js —— 和「我的消息」列表同一份规则。
 * 后端不拼文案，就不会出现通知里的说法和列表里对不上。
 *
 * `event.waitUntil` 不能省：service worker 是随时会被系统杀掉的，
 * 不告诉它「等这个 Promise 完成」，通知可能还没弹出来进程就没了。
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // 非 JSON 的推送（不该出现）：宁可弹一条空的，也别静默丢掉
  }
  const n = toNotification(data)
  event.waitUntil(
    self.registration.showNotification(n.title || '新消息', {
      body: n.body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      // tag 相同的通知会互相覆盖。按消息类型 + 主体分组：同一个专题群聊连着被 @ 五次，
      // 通知栏里只留最新一条，而不是堆五条
      tag: `${data.msgType || 'msg'}:${data.msgId || ''}`,
      renotify: true,
      data: { url: n.url },
    }),
  )
})

/**
 * 点通知。
 *
 * 优先**聚焦已经开着的那个窗口**并让它导航过去，而不是每次都开新窗口——
 * 否则点五条通知就留下五个标签页。只有一个都没开着时才 openWindow。
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/myMessages'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      // 同源的窗口就复用。navigate 可能因为跨源被拒，那就退回开新窗口
      if (new URL(c.url).origin === self.location.origin) {
        try {
          await c.focus()
          await c.navigate(url)
          return
        } catch {
          break
        }
      }
    }
    await self.clients.openWindow(url)
  })())
})
