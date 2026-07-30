/**
 * 开黑战绩模块里的纯格式化函数。**这个文件不含 JSX**。
 *
 * 和 LolUserAvatar.jsx 分开，是因为 `react-refresh/only-export-components`：
 * 一个文件同时导出组件和普通函数时，热更新没法判断该重建什么，整份文件都会退化。
 * 这个项目为同一条规则拆过两次（backNav / BackButton、searchModel / SearchResults），
 * 照同样的做法。
 */

/** 昵称 → 一个稳定的颜色。没有头像的人用首字母 + 这个底色，同一个人每次都一样 */
export const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

/** 胜率的配色：只是让扫一眼能分出好坏，不做精确色阶 */
export const rateColor = (r) => {
  if (r >= 0.6) return '#52c41a'
  if (r >= 0.5) return '#fa8c16'
  return '#999'
}

/** `12/3/8` 这种 KDA 串 */
export const kdaText = (p) => `${p.kills}/${p.deaths}/${p.assists}`

/** 胜率百分比。样本量小的时候不摆小数——那是假精度 */
export const pct = (win, total) => (total ? `${Math.round((win / total) * 100)}%` : '—')

/** 大数字缩成 `12.5k`。表格里几列并排时，五位数会把列宽撑得很难看 */
export const k = (n) => {
  const v = Number(n || 0)
  return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
}

/** 小数比例 → 百分比。null 显示「—」而不是 0%，那是两回事 */
export const rate = (v, digits = 0) =>
  (v === null || v === undefined ? '—' : `${(Number(v) * 100).toFixed(digits)}%`)

/** 一位小数；null → 「—」 */
export const num1 = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(1))

/** 秒 → `12:34` */
export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * 召唤师技能 id → 名字。
 *
 * 只列常见的：Riot 的完整清单里大半是限时模式和早就下线的技能，
 * 抄进来的那一刻就开始过期。认不出的原样显示编号，不至于显示成空白。
 */
export const SPELL_NAME = {
  1: '净化', 3: '虚弱', 4: '闪现', 6: '幽灵疾步', 7: '治疗', 11: '惩戒',
  12: '传送', 13: '清晰', 14: '点燃', 21: '屏障', 30: '至高之拳', 31: '传送门',
  32: '标记', 39: '标记', 54: '占位', 55: '占位',
}
export const spellName = (id) => SPELL_NAME[id] || (id ? `技能${id}` : '')

/**
 * 段位缩写：`BRONZE` + `I` → `黄铜 I`。
 *
 * 这是**当前**段位，不是打那一场时的段位——对局数据里根本没有段位字段，
 * league-v4 也只给当前值。界面上要标清楚，否则会被当成「他那时候就这水平」。
 */
export const TIER_NAME = {
  IRON: '坚韧黑铁', BRONZE: '英勇黄铜', SILVER: '不屈白银', GOLD: '荣耀黄金',
  PLATINUM: '华贵铂金', EMERALD: '流光翡翠', DIAMOND: '璀璨钻石',
  MASTER: '超凡大师', GRANDMASTER: '傲世宗师', CHALLENGER: '最强王者',
}
export const tierText = (tier, div) => {
  if (!tier) return null
  const name = TIER_NAME[tier] || tier
  // 大师以上没有小段，硬拼上去是错的
  return ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? name : `${name} ${div || ''}`.trim()
}

/**
 * 段位配色。
 *
 * 取的是游戏里那套辨识度最高的颜色——黑铁灰、黄铜棕、白银青灰、黄金金、
 * 铂金青、翡翠绿、钻石蓝紫、大师紫、宗师红、王者橙金。
 * 顺序本身就带信息：冷色偏低、暖色偏高，扫一眼榜就能看出层次，
 * 不必逐个去读文字。
 *
 * 未定级给浅灰，明确区别于「有段位但很低」——那是两回事。
 */
export const TIER_COLOR = {
  IRON: '#6e6259',
  BRONZE: '#a5673f',
  SILVER: '#8195a0',
  GOLD: '#d4a017',
  PLATINUM: '#2e9c9c',
  EMERALD: '#17a45c',
  DIAMOND: '#5468d4',
  MASTER: '#9b4dca',
  GRANDMASTER: '#d8443c',
  CHALLENGER: '#f0a726',
}
export const tierColor = (tier) => TIER_COLOR[tier] || '#c8c8c8'
