import axios from 'axios'
import { message } from 'antd'
import { getToken } from '../auth/token'
import { API_BASE, absolutizeData, relativizeData } from '../config/origin'

/**
 * 全局唯一的 axios 实例——所有接口请求都走它。
 * - baseURL：网页端是空串（相对路径，由 Vite 开发代理转发到后端，见 vite.config.js）；
 *   套壳 App 里是站点全地址，因为那时页面的源是 capacitor://localhost，
 *   相对路径会打到 App 包自己身上（见 config/origin.js）。
 * - withCredentials: true：关键！让浏览器带上 Session Cookie(JSESSIONID)，
 *   否则后端不知道"你是谁"，受保护接口一律 401。
 *   App 端不靠它（走 Bearer 头），留着不影响。
 */
const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
})

/**
 * 请求拦截器：有令牌就带上 `Authorization: Bearer`（阶段 1 · Token 认证）。
 *
 * **网页端这里恒为空**——只有套壳 App 登录时才会向后端索要令牌（见 auth/token.js）。
 * 所以不用判断运行环境："有没有存过令牌"本身就是判据。
 *
 * 后端 TokenAuthFilter 的顺序是 Cookie 优先、令牌兜底，所以万一两者同时存在
 * （比如在浏览器里手工塞过一个），行为仍然是可预期的。
 *
 * 顺带把请求里的上传地址还原成根相对（`relativizeData`）。这一步和响应拦截器的
 * `absolutizeData` 是**一对**：出去的补全成绝对地址（不然套壳里图片不显示），
 * 回去的还原成相对（不然后端把它当外链拒掉）。少了任何一半，
 * "先上传拿地址、再把地址交回后端"的流程就会坏——而且坏得毫无提示，
 * 后端只会说"内容不能为空"。网页端两个函数都是空操作。
 */
http.interceptors.request.use((config) => {
  const t = getToken()
  if (t) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${t}`
  }
  if (config.data !== undefined) config.data = relativizeData(config.data)
  if (config.params !== undefined) config.params = relativizeData(config.params)
  return config
})

/**
 * 响应拦截器：把后端统一返回体 Result{code,msg,data} 拆开，让业务代码只拿到 data。
 * 后端约定（见 P4-2）：code===0 成功，非 0 为业务失败（HTTP 仍是 200，如"验证码错误"）。
 */
http.interceptors.response.use(
  (resp) => {
    const body = resp.data
    // 非 Result 结构（如验证码图片二进制流）原样返回
    if (!body || typeof body !== 'object' || !('code' in body)) {
      return body
    }
    if (body.code === 0) {
      // 套壳时把响应里所有 /picImg/... 补成全地址（网页端这一步是空操作）。
      // 放在这里而不是逐个页面改：上传文件的地址散落在头像、专题背景、球员照片、
      // 帖子封面…十几个字段里，逐个改必然漏，而且以后新加字段还会再漏一次
      return absolutizeData(body.data) // 成功：直接把内层 data 交给调用方
    }
    // 业务失败：统一弹错，并 reject 让调用方能 catch
    message.error(body.msg || '请求失败')
    return Promise.reject(new Error(body.msg || '请求失败'))
  },
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      // 未登录 / 会话过期：跳登录页（避免在登录页自身死循环）。
      // 例外：/user/current 是启动时的"我登录了吗"探测——匿名访客必然 401，
      // 跳转会把所有游客踢出公开页面（公开浏览是设计能力，别拦）
      const probe = String(error.config?.url || '').includes('/user/current')
      if (!probe && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    } else if (status === 403) {
      message.error('权限不足')
    } else {
      message.error(error.response?.data?.msg || '网络错误，请稍后再试')
    }
    return Promise.reject(error)
  },
)

export default http
