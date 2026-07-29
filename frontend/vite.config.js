import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 开发期把后端接口前缀代理到本地 Spring Boot（localhost:8088），浏览器只与 5173 通信，避开跨域。
//
// 坑：代理是"前缀匹配"，而 /news、/players、/users 这些前端路由和后端接口前缀同名。
// 浏览器"整页导航"（刷新/回车/直接输网址）请求这些路径时，也会命中代理被转发到后端，
// 后端没有对应页面接口 → Spring Whitelabel Error Page。
// 解法：bypass —— 整页导航带 `Accept: text/html`，这类交给 Vite 返回 SPA 的 index.html
// （前端路由接管）；axios 的接口调用是 XHR（Accept 不含 text/html），照常代理。
const backend = 'http://localhost:8088'
const spaFallback = (req) =>
  req.method === 'GET' && (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined
const api = (extra = {}) => ({ target: backend, changeOrigin: true, bypass: spaFallback, ...extra })

/**
 * PWA（阶段 0，通往 iOS 上架的第一步，见 vault 的 06-移动端App）。
 *
 * 装到主屏之后：桌面有图标、打开没有地址栏、静态资源从本地读所以秒开。
 *
 * 四个不能想当然的地方：
 *
 * 1. **接口一律不缓存。** 这里没有配任何 runtimeCaching，所以 service worker 只管
 *    预缓存的静态资源，`/topic/list` 这类请求原样走网络。这是刻意的：站里的数据
 *    全是按人区分的（权限位、未读数、能不能进某个群），缓存一份下来就会串味——
 *    轻则未读数不对，重则拿着旧的权限位渲染出不该看见的入口。
 *
 * 2. **导航兜底要有黑名单。** navigateFallback 让所有"整页导航"都吃本地的
 *    index.html（这样 /news/topic/xxx 刷新才不白屏，离线也能开）。但有两个后端地址
 *    是靠导航打开的，被拦下来会直接坏掉：群聊导出走 window.open，附件走
 *    <a download target="_blank">。它们必须放行到网络。
 *    注意 /news、/topic、/player 这些前缀同时是后端接口和前端路由，**不能整条拉黑**,
 *    否则 SPA 路由的离线能力就没了；它们的接口调用是 XHR，本来就不走导航兜底。
 *
 * 3. **单文件大小上限要抬。** workbox 默认只预缓存 2MB 以内的文件，而主 bundle
 *    是 3.5MB —— 不抬这个值，最关键的那个文件会被**静默跳过**，构建不报错，
 *    结果就是装了个离线打不开的壳。
 *
 * 4. **不在 dev 下启用。** service worker 会缓存住旧代码，本地改完不生效，极难查。
 *
 * 用 injectManifest 而不是 generateSW：service worker 要接推送（push / notificationclick），
 * 自动生成的那个是成品，插不进自己的监听。改成手写 src/sw.js，构建期只把预缓存清单
 * 注入进去。上面第 1、2 条的实现也随之搬进了 sw.js。
 */
const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'Epoch',
    short_name: 'Epoch',
    description: '百家说论坛 · NBA 五十年数据',
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#fa541c',
    icons: [
      { src: '/pwa-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png?v=2', sizes: '512x512', type: 'image/png' },
      // maskable 单独一张：安卓会按自己的形状去裁，用普通图会把边上的内容切掉
      { src: '/pwa-maskable-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  // injectManifest 模式下这里只管"哪些文件进预缓存清单"，
  // 缓存策略和导航兜底都写在 src/sw.js 里
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 见上面第 3 条
  },
  devOptions: { enabled: false },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pwa],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': api(),
      '/user': api(),
      '/player': api(),
      '/team': api(),
      '/news': api(),
      '/userInformation': api(),
      '/search': api(),
      '/topic': api(),
      '/picImg': api(),
      '/pm': api(),
      // WebSocket（STOMP）握手不能走 bypass；ws:true 才会升级协议
      '/ws': { target: backend, changeOrigin: true, ws: true },
    },
  },
})
