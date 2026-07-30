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
