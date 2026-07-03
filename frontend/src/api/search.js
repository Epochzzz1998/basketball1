import http from './http'

export const searchApi = {
  // 全局搜索：一个关键词同时查 球员/新闻/资讯/用户，返回 {players, news, forum, users}
  globalSearch: (keyword) => http.get('/search/global', { params: { keyword } }),
}
