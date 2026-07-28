import http from './http'

/**
 * 专题群聊接口（都要登录）。
 * 发消息走 REST，收消息靠 STOMP 推送（见 realtime/pmSocket.js 的 subscribeRoom）。
 *
 * 日期一律用 yyyy-MM-dd，且**闭区间**：选到 7-28 就包含 7-28 一整天。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const chatApi = {
  // before：上一屏最早那条的时间戳（毫秒），往上翻
  // since：yyyy-MM-dd，从那天的第一条开始往后取（小日历跳转）
  history: (topicId, before, limit) => http.get('/chat/history', { params: { topicId, before, limit } }),
  jumpTo: (topicId, since) => http.get('/chat/history', { params: { topicId, since } }),
  newer: (topicId, after) => http.get('/chat/newer', { params: { topicId, after } }),
  // 哪几天有记录（小日历标深色）
  days: (topicId) => http.get('/chat/days', { params: { topicId } }),
  // @ 候选：只给真的在这个专题里、且能进群聊的人
  mentionCandidates: (topicId, keyword) => http.get('/chat/mentionCandidates', { params: { topicId, keyword } }),
  send: (topicId, payload) => http.post('/chat/send', form({ topicId, ...payload })),
  recall: (msgId) => http.post('/chat/recall', form({ msgId })),
  unread: (topicId) => http.get('/chat/unread', { params: { topicId } }),
  markRead: (topicId) => http.post('/chat/read', form({ topicId })),
  // 清理：先预览要删多少，再执行。删除连同图片和附件一起，不可恢复
  purgePreview: (topicId, from, to) => http.get('/chat/purgePreview', { params: { topicId, from, to } }),
  purge: (topicId, from, to) => http.post('/chat/purge', form({ topicId, from, to })),
  // 各专题群聊占用（仅超管）
  usage: () => http.get('/chat/usage'),
  // 导出是直接下载，不走 axios（要的是浏览器保存文件，不是拿到响应体）；不传日期=全量
  exportUrl: (topicId, from, to) => {
    const q = new URLSearchParams({ topicId })
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    return `/chat/export?${q.toString()}`
  },
}
