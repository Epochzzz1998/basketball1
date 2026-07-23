import http from './http'

/**
 * 帖子投票。权限模型与打分（rating）完全一致：楼主发起（主贴一项 + 评论区追加若干），
 * 登录用户单选投票，一人一票、再投=改选；各选项票数公开。openFloor = 楼主"在回复里继续发投票"。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const pollApi = {
  // 该帖全部投票 + 票数 + 我的选择：[{itemId, commentId, subject, options[], count, counts{idx:票数}, myChoice}]
  list: (newsId) => http.get('/poll/list', { params: { newsId } }),
  // 发起投票（楼主）：{newsId, subject, options: JSON.stringify([...])}；带 commentId=挂在楼主的一级楼上
  create: (payload) => http.post('/poll/create', form(payload)),
  // 楼主开投票楼：{newsId, subject, options, content?} → 发一条一级楼并挂投票
  openFloor: (payload) => http.post('/poll/openFloor', form(payload)),
  // 投票/改票：optionIndex 为选项下标；返回最新 {count, counts, myChoice}
  vote: (itemId, optionIndex) => http.post('/poll/vote', form({ itemId, optionIndex })),
  // 删投票（超管或楼主），连带删票
  remove: (itemId) => http.post('/poll/delete', form({ itemId })),
}
