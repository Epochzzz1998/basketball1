import http from './http'

/**
 * 私信接口（全部需登录）。写操作走 REST；消息送达靠 STOMP 推送（见 realtime/pmSocket.js），
 * 所以这里没有"收消息"的轮询接口——history 只用于进入会话时补全上下文。
 */
export const pmApi = {
  // 发一条私信（后端落库后会向双方推 WS 事件）；attachments 为 JSON 串 [{type,url,name,size}]，文字/附件至少有一
  send: (receiverId, content, attachments) => {
    const body = new URLSearchParams({ receiverId })
    if (content) body.append('content', content)
    if (attachments) body.append('attachments', attachments)
    return http.post('/pm/send', body)
  },
  // 私信附件上传（图片/文档）：返回可访问 URL
  uploadFile: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const data = await http.post('/pm/upload', fd)
    return data?.url
  },
  // 会话列表：每个对话最后一条 + 未读数
  conversations: () => http.get('/pm/conversations'),
  // 与某人的消息记录（倒序分页；前端反转成正序展示）
  history: (peerId, page = 1, limit = 30) => http.get('/pm/history', { params: { peerId, page, limit } }),
  // 打开会话：把对方发我的全部标已读
  markRead: (peerId) => http.post('/pm/read', new URLSearchParams({ peerId })),
  // 撤回自己 2 分钟内的消息
  recall: (pmId) => http.post('/pm/recall', new URLSearchParams({ pmId })),
  // 删除会话（只隐藏我这一侧）
  deleteConversation: (peerId) => http.post('/pm/deleteConversation', new URLSearchParams({ peerId })),
  // 私信总未读（顶栏角标）
  unreadCount: () => http.get('/pm/unreadCount'),
  // 在线状态：userIds 为逗号分隔，返回 {userId: 是否在线}
  presence: (userIds) => http.get('/pm/presence', { params: { userIds } }),
}
