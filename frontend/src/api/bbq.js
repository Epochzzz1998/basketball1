import http from './http'

/**
 * 耿阿姨烤串（单店薪资管理）。店长（bbqRole==='manager'）共管全店账本；
 * 店员只读自己的薪资（台账，二期）。所有管理接口后端都有店长校验。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, v) })
  return body
}

export const bbqApi = {
  // 成员：列表（店长在前，带最近时薪）/ 可添加的关注者 / 添加 / 移除店员 / 提拔店长
  staffList: () => http.get('/bbq/staff/list'),
  candidates: () => http.get('/bbq/staff/candidates'),
  addStaff: (userId) => http.post('/bbq/staff/add', form({ userId })),
  removeStaff: (userId) => http.post('/bbq/staff/remove', form({ userId })),
  promote: (userId) => http.post('/bbq/staff/promote', form({ userId })),
  // 超管：任命/解除店长（解除后降为店员）
  adminSetManager: (userId, on) => http.post('/bbq/adminSetManager', form({ userId, on: on ? '1' : '0' })),
  // 串价
  skewerList: () => http.get('/bbq/skewer/list'),
  skewerSave: (payload) => http.post('/bbq/skewer/save', form(payload)),
  skewerDelete: (typeId) => http.post('/bbq/skewer/delete', form({ typeId })),
  // 薪资记录：月（日历）/ 日（弹窗明细）/ 保存 / 删除；skewers 传 JSON 数组 [{typeId, num}]
  wageMonth: (month) => http.get('/bbq/wage/month', { params: { month } }),
  wageDay: (date) => http.get('/bbq/wage/day', { params: { date } }),
  wageSave: (payload) => http.post('/bbq/wage/save', form(payload)),
  wageDelete: (recordId) => http.post('/bbq/wage/delete', form({ recordId })),
  // 结清：预览（确认弹窗罗列对象与金额）→ 执行（记录盖上 SETTLE_ID）。
  // 注意：盖了 SETTLE_ID **不再等于锁死**——2026-09-02 起已结清的记录也能改能删，
  // 后端会把那张结清凭据的金额/条数跟着重算。
  // userIds 为 JSON 数组字符串，空 = 所有有未结清账的人；toDate = 结清截止日（店长自选，可未来）
  settlePreview: (userIds, toDate) => http.get('/bbq/settle/preview', { params: { userIds, toDate } }),
  settleConfirm: (userIds, toDate) => http.post('/bbq/settle/confirm', form({ userIds, toDate })),
  // 台账：店长=全店聚合，店员=自己的（含记录明细）。
  // params: {from, to} 任意起止日期（上限一年）；{month:'yyyy-MM'} 是整月的简写，仍然收。
  //         {userId} 店长专用——把整页收窄到一个人（成员管理的「薪资总览」），
  //         这时返回结构和店员自视图一致（多一份逐条记录明细）；店员传了会被忽略。
  // 路径带 /data 后缀：GET /bbq/ledger 会和 SPA 页面路由撞车（后端接口优先于 SPA 兜底）
  ledger: (params) => http.get('/bbq/ledger/data', { params }),
  // Burning！四榜（店内成员皆可看）：params 同台账；点赞 toggle；评论分页（每页 5 条）
  burningBoard: (params) => http.get('/bbq/burning/board', { params }),
  // 点赞按"榜"独立：board = hours|skewers|latestOff|days
  burningLike: (targetId, board) => http.post('/bbq/burning/like', form({ targetId, board })),
  burningComments: (targetId, page) => http.get('/bbq/burning/comments', { params: { targetId, page } }),
  burningComment: (targetId, content) => http.post('/bbq/burning/comment', form({ targetId, content })),
  burningDeleteComment: (id) => http.post('/bbq/burning/deleteComment', form({ id })),
}
