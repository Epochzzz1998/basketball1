import http from './http'

/**
 * 用户空间接口。写接口沿用后端"请求参数"绑定（form 编码），用 URLSearchParams。
 */
export const userApi = {
  // 用户公开主页：资料 + 统计 + 帖子 + 评论足迹
  profile: (userId) => http.get('/user/profile', { params: { userId } }),
  // 本人：改昵称 / 改密码 / 传头像
  updateProfile: (userNickname) => http.post('/user/updateProfile', new URLSearchParams({ userNickname })),
  uploadAvatar: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/user/uploadAvatar', fd)
  },
  changePassword: (oldPassword, newPassword) =>
    http.post('/user/changePassword', new URLSearchParams({ oldPassword, newPassword })),
  // 本人：申请绑定球员（待超管审核）/ 撤销申请或解除绑定
  bindPlayer: (playerId) => http.post('/user/bindPlayer', new URLSearchParams({ playerId })),
  unbindPlayer: () => http.post('/user/unbindPlayer'),
  // 超管：待审核列表 / 审核
  bindings: () => http.get('/user/bindings'),
  reviewBinding: (userId, approve) =>
    http.post('/user/reviewBinding', new URLSearchParams({ userId, approve })),
}
