import http from './http'

/**
 * 专题（权限版块）接口。
 * list/get 公开（登录可选，私密专题会带 locked）；create/delete 需超管；
 * update/成员管理需 admin 或 owner（后端 canManage 兜底）。
 * 写接口用 URLSearchParams 表单提交（与项目其它写接口一致）。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const topicApi = {
  list: () => http.get('/topic/list'),
  // userInformationId 可选：从"我的消息"点进来时带上，后端顺便把该条消息标记已读
  get: (topicId, userInformationId) => http.get('/topic/get', { params: { topicId, userInformationId } }),
  create: (payload) => http.post('/topic/create', form(payload)),
  update: (payload) => http.post('/topic/update', form(payload)),
  // 设置题主（可多个，超管专用）：ownerIds 为逗号分隔的用户 id
  setOwners: (topicId, ownerIds) => http.post('/topic/setOwners', form({ topicId, ownerIds })),
  // 设置小题主（题主/超管，最多 3 人）：subOwnerIds 为逗号分隔的用户 id，空串=清空
  setSubOwners: (topicId, subOwnerIds) => http.post('/topic/setSubOwners', form({ topicId, subOwnerIds: subOwnerIds || '' })),
  remove: (topicId) => http.delete('/topic/delete', { params: { topicId } }),
  members: (topicId) => http.get('/topic/members', { params: { topicId } }),
  setMember: (payload) => http.post('/topic/setMember', form(payload)),
  removeMember: (topicId, userId) => http.post('/topic/removeMember', form({ topicId, userId })),
  // 订阅/取消订阅（toggle，仅已加入的专题）；mySubscriptions 供侧栏折叠菜单
  subscribe: (topicId) => http.post('/topic/subscribe', form({ topicId })),
  mySubscriptions: () => http.get('/topic/mySubscriptions'),
  // 进专题页打卡：红点归零（发帖/评论的新活动从此刻重新累计）
  markSeen: (topicId) => http.post('/topic/markSeen', form({ topicId })),
  // 申请加入
  apply: (topicId, message) => http.post('/topic/apply', form({ topicId, message })),
  requests: (topicId) => http.get('/topic/requests', { params: { topicId } }),
  handleRequest: (payload) => http.post('/topic/handleRequest', form(payload)),
}
