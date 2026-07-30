import { Avatar } from 'antd'
import { assetUrl } from '../../config/origin'
import { avatarColor } from './lolFormat'

/**
 * 用户头像：有图用图，没图用首字母加一个由昵称定的底色。
 *
 * `assetUrl` 不能省：套壳 App 里页面的源是 `capacitor://localhost`，
 * 根相对的 `/picImg/...` 会打到 App 包自己身上。这个错误**在网页端完全看不出来**，
 * 只在 App 里表现为头像不显示，而且不报任何错——所以头像只从这一个地方画。
 */
export default function LolUserAvatar({ name, src, size = 28 }) {
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
