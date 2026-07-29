import http from './http'

export const searchApi = {
  // 全局搜索：一个关键词同时查 球员/新闻/资讯/用户，返回 {players, news, forum, users}
  globalSearch: (keyword) => http.get('/search/global', { params: { keyword } }),
  // 热帖榜：全站论坛帖按「点赞×2 + 评论×3」取前 N。私密/已下架专题的帖、隐藏帖、草稿都不在内
  hotPosts: (limit = 10) => http.get('/search/hotPosts', { params: { limit } }),
  // @-mention 候选：按昵称/用户名模糊，回 [{userId, userNickname, avatar}]，供 @ 下拉用（比 global 轻）
  mentionUsers: (keyword) => http.get('/search/mentionUsers', { params: { keyword } }),
  // @-mention 候选·球员：NBA 专区发帖 @ 球员用，回 [{playerId, playerName, nameEn, photo, firstYear, lastYear}]
  mentionPlayers: (keyword) => http.get('/search/mentionPlayers', { params: { keyword } }),
}
