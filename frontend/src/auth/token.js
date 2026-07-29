/**
 * 登录令牌的客户端存取（阶段 1 · Token 认证）。
 *
 * ## 为什么网页端**不**要令牌
 *
 * 网页现在用的是 httpOnly Cookie——JS 读不到它，所以就算页面被 XSS 了，
 * 攻击者也偷不走登录凭据。而令牌只能存在 `localStorage` 这类 JS 能读的地方。
 * 给网页端无端发一个令牌，等于凭空把这层保护去掉。
 *
 * 所以登录时只有 `isNativeApp()` 为真才向后端索要令牌（`wantToken=1`），
 * 网页端拿到的响应里根本没有 token 这个字段。
 *
 * ## 那为什么请求拦截器无条件带上
 *
 * 因为"有没有令牌"本身就是判据：网页端存里就是空的，带不上；
 * App 端有，就带。不用在每个请求处再判断一次运行环境。
 *
 * ## 阶段 2 要改的只有一行
 *
 * `isNativeApp()` 现在恒为 false —— Capacitor 还没接进来，`window.Capacitor` 不存在。
 * 阶段 2 引入 Capacitor 之后它自动变成 true，其余代码一个字不用动。
 * 届时存储也建议从 localStorage 换成 `@capacitor/preferences`
 * （WebView 的 localStorage 在系统清理存储时可能被抹掉，Preferences 走的是原生 KV）。
 */

import { isNative } from '../config/origin'

const KEY = 'epoch:token'

/**
 * 当前是不是跑在套壳 App 里。
 *
 * 判据统一在 `config/origin.js`（构建期 `VITE_NATIVE` 优先、运行时 `window.Capacitor` 兜底）——
 * 那里还要用同一个判断决定接口地址和图片地址，两处各判一次迟早会分叉。
 */
export const isNativeApp = () => isNative

export const getToken = () => {
  try {
    return localStorage.getItem(KEY) || null
  } catch {
    return null   // 隐私模式下 localStorage 会抛；当作没有令牌，退回 Cookie 那条路
  }
}

export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(KEY, t)
    else localStorage.removeItem(KEY)
  } catch {
    // 存不下就存不下：网页端本来就不依赖它
  }
}

export const clearToken = () => setToken(null)
