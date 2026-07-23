import http from './http'

/**
 * 黑名单。拉黑范围：对方不能给我发私信、不能关注我（帖子/评论互相仍可见）；
 * 拉黑时后端自动解除双向关注。toggle=拉黑/解除。
 */
export const blockApi = {
  toggle: (userId) => http.post('/block/toggle', new URLSearchParams({ userId })),
  list: () => http.get('/block/list'),
}
