import http from './http'

/**
 * 鉴权相关接口。
 * 注意：后端 login/regist 按"请求参数"绑定（form 表单编码），不是 JSON，
 * 所以用 URLSearchParams 发送（axios 会自动带上 application/x-www-form-urlencoded）。
 */
export const authApi = {
  login: (values) => http.post('/user/login', new URLSearchParams(values)),
  register: (values) => http.post('/user/regist', new URLSearchParams(values)),
  logout: () => http.post('/user/loginOut'),
  current: () => http.get('/user/current'), // 当前用户 + 角色标识；未登录会 401
  // 验证码图片地址：带时间戳防缓存。<img src> 加载它时，后端会把答案存进 session 供 /login 校验
  captchaUrl: () => `/user/captcha?t=${Date.now()}`,
}
