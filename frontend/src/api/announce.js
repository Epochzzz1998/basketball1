import http from './http'

/**
 * 全站滚动公告。current 公开（游客也该看到公告），其余需超管。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const announceApi = {
  current: () => http.get('/announce/current'),
  get: () => http.get('/announce/get'),
  save: (payload) => http.post('/announce/save', form(payload)),
}
