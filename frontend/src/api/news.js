import http from './http'

/**
 * 资讯相关接口。浏览/详情公开；发布/删除需 manager；评论/点赞需登录（后端 @RequiresRole 兜底）。
 * 列表返回 {total, records}；详情返回 {news, level, anchorId}（拦截器已把 Result 拆到内层 data）。
 */
export const newsApi = {
  // 资讯列表（分页）
  listNews: (params) => http.get('/news/newsListData', { params }),
  // 资讯详情。userInformationId 可选：从“我的消息”点进来时带上，后端顺便把该条消息标记已读
  getNews: (newsId, userInformationId) => http.get('/news/newsShow', { params: { newsId, userInformationId } }),

  // ===== 写/管理（manager） =====
  // 新增/编辑资讯：后端 `News news` 绑表单参数，故用 URLSearchParams（过滤掉 null/undefined）。
  // publishDate 不传——后端 save() 见为空会自动设当前时间。
  saveNews: (news) => {
    const body = new URLSearchParams()
    Object.entries(news).forEach(([k, v]) => { if (v != null) body.append(k, v) })
    return http.post('/news/save', body)
  },
  // 删除资讯（后端 @DeleteMapping，支持逗号分隔多个 id）
  deleteNews: (newsIds) => http.delete('/news/delete', { params: { newsIds } }),
  // 富文本插图上传：multipart 传文件 + 所属 newsId，返回可访问 URL 供编辑器插入 <img>
  uploadNewsImage: async (file, newsId) => {
    const fd = new FormData()
    fd.append('file', file)
    if (newsId) fd.append('newsId', newsId)
    const data = await http.post('/news/upload', fd)
    return data?.url
  },
  // 评论附件上传（图片或文档）：返回可访问 URL；前端据扩展名分 image/file 渲染
  uploadCommentFile: async (file, newsId) => {
    const fd = new FormData()
    fd.append('file', file)
    if (newsId) fd.append('newsId', newsId)
    const data = await http.post('/news/commentUpload', fd)
    return data?.url
  },

  // ===== 评论 / 点赞（评论列表公开；发评论与点赞需登录） =====
  // 评论列表：顶层评论传 level:'1'；某条评论的回复传 commentRelId=该评论 id。返回 {total, records}。
  listComments: (params) => http.get('/news/CommentListData', { params }),
  // 发评论：顶层 {newsId, content, level:'1'}；回复另传 commentRelId + 递增的 level。
  // 注意：该接口仍返回旧版 {result, msg}（未并入统一 Result），调用方据 res.result 判断。
  postComment: (payload) => {
    const body = new URLSearchParams()
    Object.entries(payload).forEach(([k, v]) => { if (v != null) body.append(k, v) })
    return http.post('/news/comment', body)
  },
  // 帖子/评论 点赞点踩：均返回旧版 {result, msg}；计数经 RabbitMQ 异步更新（不会立刻变）。
  goodPost: (newsId) => http.post('/news/good', new URLSearchParams({ newsId })),
  badPost: (newsId) => http.post('/news/bad', new URLSearchParams({ newsId })),
  goodComment: (commentId) => http.post('/news/goodComment', new URLSearchParams({ commentId })),
  badComment: (commentId) => http.post('/news/badComment', new URLSearchParams({ commentId })),
  // 置顶/精华/封锁：flag='top'|'essence'|'locked'，value='1' 开 / '0' 关（官方→manager+；论坛→专题管理者）
  setFlag: (newsId, flag, value) =>
    http.post('/news/setFlag', new URLSearchParams({ newsId, flag, value })),
  // 删帖（题主/管理者）：连带删 ES + 图片目录
  deletePost: (newsId) => http.post('/news/deletePost', new URLSearchParams({ newsId })),
  // 作者数据小结：{postCount, essenceCount, topCount, likeCount}
  authorStats: (userId) => http.get('/news/authorStats', { params: { userId } }),
}
