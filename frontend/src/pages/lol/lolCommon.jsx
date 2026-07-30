import { Avatar } from 'antd'
import { assetUrl } from '../../config/origin'

/**
 * 开黑战绩模块里共用的几个小东西。
 *
 * 单独一个文件是因为战绩流和榜单都要画「一个人」，而复制两份头像逻辑之后，
 * 迟早有一处忘了过 `assetUrl`——那个错误在网页端完全看不出来，
 * 只在套壳 App 里表现为头像不显示，而且不报任何错。
 */

/** 昵称 → 一个稳定的颜色。没有头像的人用首字母 + 这个底色，同一个人每次都一样 */
export const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

/**
 * 用户头像。
 *
 * `assetUrl` 不能省：套壳 App 里页面的源是 `capacitor://localhost`，
 * 根相对的 `/picImg/...` 会打到 App 包自己身上。网页端它是恒等函数，没有代价。
 */
export function UserAvatar({ name, src, size = 28 }) {
  const url = assetUrl(src)
  if (url) {
    return <Avatar size={size} src={url} style={{ flexShrink: 0 }} />
  }
  return (
    <Avatar size={size} style={{ background: avatarColor(name), fontWeight: 700, flexShrink: 0 }}>
      {String(name || '?')[0].toUpperCase()}
    </Avatar>
  )
}

/** 胜率的配色：只是让扫一眼就能分出好坏，不做精确的色阶 */
export const rateColor = (r) => {
  if (r >= 0.6) return '#52c41a'
  if (r >= 0.5) return '#fa8c16'
  return '#999'
}

/** `12/3/8` 这种 KDA 串 */
export const kdaText = (p) => `${p.kills}/${p.deaths}/${p.assists}`

/** 胜率百分比，样本量小的时候不摆小数——那是假精度 */
export const pct = (win, total) => (total ? `${Math.round((win / total) * 100)}%` : '—')
