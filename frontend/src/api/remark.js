import http from './http'

/**
 * 用户备注（微信式）：任意两人之间可备注，只有设置者自己看得到。
 * 显示替换在前端做：登录后拉一次 /remark/mine 映射表（AuthContext 持有），
 * 各处用 dn(userId, 真名) 取显示名；个人主页保留真实昵称。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null) body.append(k, v) })
  return body
}

export const remarkApi = {
  // remark 传空字符串 = 清除备注
  set: (targetId, remark) => http.post('/remark/set', form({ targetId, remark })),
  mine: () => http.get('/remark/mine'),
}
