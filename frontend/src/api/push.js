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
  // 给自己发一条，用来确认整条链路通没通
  test: () => http.post('/push/test'),
}
