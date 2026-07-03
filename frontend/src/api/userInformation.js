import http from './http'

/**
 * 个人消息通知（登录用户）。receiverId 由后端从会话写死，只能看自己的。
 * 返回 {total, records}；记录字段见 UserInformation：
 * msgType(goodNews/badNews/commentNews/goodComment/badComment/commentComment)、
 * operatorName(谁触发)、contentMsg(提示语)、content(原帖/原评论摘要)、
 * whetherRead(toRead/read)、msgDate、msgId/msgIdSecond(定位原帖)。
 */
export const userInformationApi = {
  listMyMessages: (params) => http.get('/userInformation/userInformationListData', { params }),
  // 未读条数（顶栏红点）/ 一键已读
  unreadCount: () => http.get('/userInformation/unreadCount'),
  readAll: () => http.post('/userInformation/readAll'),
}
