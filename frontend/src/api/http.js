import axios from 'axios'
import { message } from 'antd'

/**
 * 全局唯一的 axios 实例——所有接口请求都走它。
 * - baseURL 留空：走相对路径，由 Vite 开发代理转发到后端（见 vite.config.js）。
 * - withCredentials: true：关键！让浏览器带上 Session Cookie(JSESSIONID)，
 *   否则后端不知道"你是谁"，受保护接口一律 401。
 */
const http = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 15000,
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
      return body.data // 成功：直接把内层 data 交给调用方
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
