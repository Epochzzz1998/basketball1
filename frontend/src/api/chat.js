import http from './http'

/**
 * 专题群聊接口（都要登录）。
 * 发消息走 REST，收消息靠 STOMP 推送（见 realtime/pmSocket.js 的 subscribeRoom）。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const chatApi = {
  // before：上一屏最早那条消息的时间戳（毫秒），用于往上翻
  history: (topicId, before, limit) => http.get('/chat/history', { params: { topicId, before, limit } }),
  send: (topicId, payload) => http.post('/chat/send', form({ topicId, ...payload })),
  recall: (msgId) => http.post('/chat/recall', form({ msgId })),
  unread: (topicId) => http.get('/chat/unread', { params: { topicId } }),
  markRead: (topicId) => http.post('/chat/read', form({ topicId })),
  // 清理：先预览要删多少，再执行。删除连同图片和附件一起，不可恢复
  purgePreview: (topicId, before) => http.get('/chat/purgePreview', { params: { topicId, before } }),
  purge: (topicId, before) => http.post('/chat/purge', form({ topicId, before })),
  // 各专题群聊占用（仅超管）
  usage: () => http.get('/chat/usage'),
  // 导出是直接下载，不走 axios（要的是浏览器保存文件，不是拿到响应体）
  exportUrl: (topicId) => `/chat/export?topicId=${encodeURIComponent(topicId)}`,
}
