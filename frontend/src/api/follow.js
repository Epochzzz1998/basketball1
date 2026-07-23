import http from './http'

/**
 * 关注/粉丝。toggle=关注/取关（一人一条边，后端唯一键兜底）；
 * list 行带 mutual（互关）与 followingByMe（我是否已关注该行用户）。
 */
export const followApi = {
  toggle: (userId) => http.post('/follow/toggle', new URLSearchParams({ userId })),
  status: (userId) => http.get('/follow/status', { params: { userId } }),
  // type: 'following' | 'followers'
  list: (userId, type) => http.get('/follow/list', { params: { userId, type } }),
}
