import http from './http'

const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const pushApi = {
  // VAPID 公钥。服务端没配密钥时返回空串，前端据此把开关整个藏掉
  publicKey: () => http.get('/push/publicKey'),
  status: (endpoint) => http.get('/push/status', { params: { endpoint } }),
  subscribe: (payload) => http.post('/push/subscribe', form(payload)),
  unsubscribe: (endpoint) => http.post('/push/unsubscribe', form({ endpoint })),
  // 套壳 App 的设备令牌（FCM）。和上面那组分开是因为两条传输路存的东西不一样：
  // Web Push 是 endpoint + 两把加密密钥，FCM 只是一个注册令牌
  registerDevice: (token, platform) => http.post('/push/registerDevice', form({ token, platform })),
  unregisterDevice: (token) => http.post('/push/unregisterDevice', form({ token })),
  // 给自己发一条，用来确认整条链路通没通（两条路都会试，返回真正成功的台数）
  test: () => http.post('/push/test'),
}
