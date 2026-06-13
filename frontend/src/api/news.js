import http from './http'

/**
 * 资讯相关接口。浏览/详情公开；发布/删除需 manager；评论/点赞需登录（后端 @RequiresRole 兜底）。
 * 列表返回 {total, records}；详情返回 {news, level, anchorId}（拦截器已把 Result 拆到内层 data）。
 */
export const newsApi = {
  // 资讯列表（分页）
  listNews: (params) => http.get('/news/newsListData', { params }),
  // 资讯详情（只传 newsId；userInformationId/anchorId 是“从站内信进入并标记已读”用的，公开浏览不传）
  getNews: (newsId) => http.get('/news/newsShow', { params: { newsId } }),
}
