import http from './http'

/**
 * 专题文件系统。
 *
 * 权限三层（后端 TopicFileController 是唯一裁判，这里只是搬运）：
 * 超管开关（走 topic/update 的 filesEnabled）→ 题主管理（传/建/改名/删）→ 成员查看下载。
 */
export const topicFileApi = {
  /** 列一个文件夹。parentId 不传 = 根目录。返回 { files, path, canManage } */
  list: (topicId, parentId) => http.get('/topicFile/list', { params: { topicId, parentId } }),

  mkdir: (topicId, parentId, name) =>
    http.post('/topicFile/mkdir', new URLSearchParams({ topicId, parentId: parentId || '', name })),

  upload: async (file, topicId, parentId) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('topicId', topicId)
    if (parentId) fd.append('parentId', parentId)
    return http.post('/topicFile/upload', fd)
  },

  rename: (fileId, name) => http.post('/topicFile/rename', new URLSearchParams({ fileId, name })),

  /** 文件夹连整棵子树一起删（后端递归收集） */
  remove: (fileId) => http.post('/topicFile/delete', new URLSearchParams({ fileId })),
}
