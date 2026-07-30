import http from './http'

/**
 * 开黑战绩（英雄联盟）。
 *
 * **这里没有一个查询会去打 Riot 的接口**——数据由后端定时抓好躺在库里，
 * 页面查的是本地 SQL。这不是优化而是前提：Riot 的个人 key 只有 100 次/2 分钟，
 * 要是翻一页就现场拉一次，几个人同时看榜就能把全站配额打光。
 *
 * 唯一会碰到 Riot 的是 `bind`（把 Riot ID 换成 PUUID），一个号一辈子一次。
 */
const form = (obj) => {
  const body = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => { if (v != null && v !== '') body.append(k, v) })
  return body
}

export const lolApi = {
  /** 我绑过的号（一个人可以有小号，所以是数组） */
  accounts: () => http.get('/lol/accounts'),
  /** riotId 传完整的 `名字#后缀`，后端负责拆 */
  bind: (riotId) => http.post('/lol/bind', form({ riotId })),
  unbind: (accountId) => http.post('/lol/unbind', form({ accountId })),

  /** 战绩流：每场带上这一场里的自己人 */
  feed: (days) => http.get('/lol/feed', { params: { days } }),
  /** 个人榜 + 概览。queueId 传 0 或省略 = 全部队列 */
  board: (params) => http.get('/lol/board', { params }),
  /** 开黑组合榜 */
  duo: (params) => http.get('/lol/duo', { params }),
}

/**
 * 队列编号 → 中文。
 *
 * 只列这个圈子实际会打到的几个，其余原样显示编号——把 Riot 的全部队列表抄进来
 * 有一百多条，绝大多数（各种限时模式、教程、机器人局）这辈子不会出现在榜上，
 * 而抄进来的那一刻它就开始过期了。
 */
export const QUEUE_LABEL = {
  400: '匹配 征召',
  420: '单双排位',
  430: '匹配 盲选',
  440: '灵活排位',
  450: '极地大乱斗',
  490: '快速匹配',
  700: '冠军杯',
  1700: '斗魂竞技场',
  1900: '无限火力',
}

export const queueName = (id) => QUEUE_LABEL[id] || `队列 ${id}`

/** 榜单和筛选条共用的一组队列选项（0 = 全部） */
export const QUEUE_OPTIONS = [
  { value: 0, label: '全部队列' },
  { value: 420, label: '单双排位' },
  { value: 440, label: '灵活排位' },
  { value: 400, label: '匹配 征召' },
  { value: 450, label: '大乱斗' },
]

/** 时间窗选项。默认 30 天：够攒出样本，又不至于把三个月前的手感算进今天 */
export const DAYS_OPTIONS = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 90, label: '近 90 天' },
  { value: 365, label: '近一年' },
]

/** 位置英文 → 中文。teamPosition 可能是空串（大乱斗没有分路） */
export const POSITION_LABEL = {
  TOP: '上路', JUNGLE: '打野', MIDDLE: '中路', BOTTOM: '下路', UTILITY: '辅助',
}

/** 秒 → `12:34` */
export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
