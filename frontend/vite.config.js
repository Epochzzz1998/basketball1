import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
