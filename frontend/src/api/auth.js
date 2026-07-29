import http from './http'
import { clearToken, isNativeApp, setToken } from '../auth/token'

/**
 * 鉴权相关接口。
 * 注意：后端 login/regist 按"请求参数"绑定（form 表单编码），不是 JSON，
 * 所以用 URLSearchParams 发送（axios 会自动带上 application/x-www-form-urlencoded）。
 */
export const authApi = {
  /**
   * 登录。
   *
   * 套壳 App 里额外带 `wantToken=1`，后端才会签发令牌；网页端不带，
   * 继续用 httpOnly Cookie（JS 读不到，XSS 偷不走，见 auth/token.js 的说明）。
   * 拿到令牌就存下来，之后由 http.js 的请求拦截器自动带在 Authorization 头上。
   */
  login: async (values) => {
    const payload = { ...values }
    if (isNativeApp()) payload.wantToken = '1'
    const data = await http.post('/user/login', new URLSearchParams(payload))
    if (data?.token) setToken(data.token)
    return data
  },
  register: (values) => http.post('/user/regist', new URLSearchParams(values)),
  /**
   * 登出。
   *
   * **先调接口再清本地**：接口要把令牌带过去，服务端才知道要作废哪一个。
   * 只清本地是不够的——那串东西一旦被抄走过，服务端这边还认它。
   * 接口失败也要清本地，否则会卡在"点了登出但还是登录状态"。
   */
  logout: async () => {
    try {
      return await http.post('/user/loginOut')
    } finally {
      clearToken()
    }
  },
  current: () => http.get('/user/current'), // 当前用户 + 角色标识；未登录会 401
  /**
   * 验证码：返回 `{captchaId, image}`，image 是可以直接塞进 `<img src>` 的 data URI。
   *
   * 旧版是 `<img src="/user/captcha">` 直接加载图片、答案存 session。那套在 App 里必然坏：
   * App 没有 Cookie，取图和登录是两次互不相关的请求，服务端永远读不到答案。
   * 改成由服务端发一个一次性的 captchaId，客户端原样带回来——不依赖 Cookie，两端同一套。
   */
  captcha: () => http.get('/user/captchaJson'),
}
