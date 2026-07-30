import http from './http'

/**
 * 赛后评分：给一场比赛打分写短评，给场上的球员逐个打分。
 *
 * 单独一个文件而不是并进 `player.js`：那边全是**不会变的历史数据**，
 * 这边是每分钟都在变的用户产出。放一起的话很容易顺手给评分也加上缓存，
 * 而那正是这类接口最不能有的东西。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  // 分数要允许传 null（「只留短评，把分清掉」），所以只跳过 undefined 和空串，
  // 不能用 `if (v)`——那会把 0 也吃掉，而 0 正是「取消这个球员的打分」
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') body.append(k, v)
  })
  return body
}

export const gameRatingApi = {
  /** 一场的全部评分：平均分、分布、短评、每个球员的平均分；登录了还带「我给的分」 */
  detail: (gameId) => http.get('/gameRating/detail', { params: { gameId } }),

  // ── 分：一人一条，可以改。传 0 = 撤销
  rateGame: (gameId, score) =>
    http.post('/gameRating/rateGame', form({ gameId, score: String(score) })),
  ratePlayer: (gameId, playerId, score) =>
    http.post('/gameRating/ratePlayer', form({ gameId, playerId, score: String(score) })),

  // ── 短评：想发几条发几条，**发出去不能改**，只能删。
  //    playerId 不传 = 评这场比赛本身
  comment: (gameId, playerId, content) =>
    http.post('/gameRating/comment', form({ gameId, playerId, content })),
  deleteComment: (commentId) => http.post('/gameRating/deleteComment', form({ commentId })),

  /** 回复一条短评。targetId 是那条短评的 commentId，比赛和球员的都走这条 */
  reply: (gameId, targetId, content, replyToUser) =>
    http.post('/gameRating/reply', form({ gameId, targetId, content, replyToUser })),
  deleteReply: (replyId) => http.post('/gameRating/deleteReply', form({ replyId })),
}

/**
 * 打分区间 1..5。
 *
 * 原来是 1..10，改小了：**十档画不出分布**。几十个人的样本摊到十根柱子上永远是
 * 一片稀疏毛刺，而这一页最想让人看到的恰恰是「大家看法一不一致」——
 * 五根柱子才看得出是齐刷刷还是两极。手机上十个小方块也确实太挤。
 */
export const MIN_SCORE = 1
export const MAX_SCORE = 5

/**
 * 分数 → 颜色。满分是「今晚就看这个」，及格线以下才该是红的。
 *
 * 不用连续渐变而是分档：分档能一眼归类（这是好评还是差评），
 * 渐变只能看出「比刚才那个红一点」，而人们真正比的是档次。
 * 支持小数，因为平均分是小数（4.6 分该和 5 分一个色）。
 */
export const scoreColor = (s) => {
  const v = Number(s)
  if (!v) return '#bbb'
  if (v >= 4.5) return '#fa541c'
  if (v >= 3.5) return '#52c41a'
  if (v >= 2.5) return '#faad14'
  return '#ff4d4f'
}

/** 分档说法，贴在平均分旁边——数字说不出「这算好还是不好」 */
export const scoreWord = (s) => {
  const v = Number(s)
  if (!v) return ''
  if (v >= 4.5) return '神'
  if (v >= 3.5) return '好'
  if (v >= 2.5) return '一般'
  if (v >= 1.5) return '差'
  return '拉'
}
