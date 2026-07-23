import http from './http'

/**
 * 个人日程表。完全私密：日历 = 我创建的 + 指派给我的事件。
 * 负责人只能是自己或关注我的人；指派立即通知，事件日当天早 8 点（墨尔本）汇总提醒。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, v) })
  return body
}

export const scheduleApi = {
  // 某月全部事件：[{eventId, date, time, title, note, done, mine, ownerName, assigneeId?, assigneeName?, assigneeAvatar?}]
  month: (month, userInformationId) => http.get('/schedule/month', { params: { month, userInformationId } }),
  // 负责人候选：我自己 + 关注我的人
  assignees: () => http.get('/schedule/assignees'),
  // 建事件：{date, title, time?, note?, assigneeId?}
  create: (payload) => http.post('/schedule/create', form(payload)),
  // 完成/取消完成（创建者或负责人）
  toggleDone: (eventId) => http.post('/schedule/toggleDone', form({ eventId })),
  // 删事件（创建者）
  remove: (eventId) => http.post('/schedule/delete', form({ eventId })),
}
