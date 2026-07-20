import http from './http'

/**
 * 帖子打分（1-5 星）。楼主开打分项（主贴一项 + 评论区追加若干），登录用户点星打分，
 * 一人一票、再打=改分；聚合（均分/人数/分布）公开。openFloor = 楼主"在回复里继续开打分"：
 * 一步发一条一级楼 + 挂上打分项。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const ratingApi = {
  // 该帖全部打分项 + 聚合 + 我的分：[{itemId, commentId, subject, avg, count, dist, myScore}]
  list: (newsId) => http.get('/rating/list', { params: { newsId } }),
  // 开打分项（楼主）：{newsId, subject}=主贴项（发帖时用）；带 commentId=挂在楼主的一级楼上
  create: (payload) => http.post('/rating/create', form(payload)),
  // 楼主开打分楼：{newsId, subject, content?} → 发一条一级楼并挂打分项
  openFloor: (payload) => http.post('/rating/openFloor', form(payload)),
  // 打分/改分：1-5；返回该项最新聚合 {avg, count, dist, myScore}
  vote: (itemId, score) => http.post('/rating/vote', form({ itemId, score })),
  // 删打分项（超管或楼主），连带删票
  remove: (itemId) => http.post('/rating/delete', form({ itemId })),
}
