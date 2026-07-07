import { useState } from 'react'
import { Popover, Tooltip } from 'antd'
import { SmileOutlined } from '@ant-design/icons'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 轻量 emoji 选择器：一个笑脸按钮 + 弹层网格，点选回调 onPick(emoji)。
 * 不引第三方大库——emoji 就是 Unicode 字符，手挑一批常用的按类平铺即可。
 */

const GROUPS = [
  { name: '表情', list: '😀 😄 😁 😂 🤣 😅 😊 🙂 😍 😘 😜 🤪 😎 🤩 🥳 😏 😐 😢 😭 😤 😡 🤔 🤨 😱 😳 🥺 😴 🤗 🤭 🙄 😬 😇 🤯 🥶 😷'.split(' ') },
  { name: '手势', list: '👍 👎 👏 🙌 🙏 👌 ✌️ 🤞 🤝 💪 👊 ✊ 🫰 🤙 👋 🫶 ☝️ 👀'.split(' ') },
  { name: '爱心', list: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💯 🔥 ✨ ⭐ 🎉 🎊 🏆 🥇'.split(' ') },
  { name: '篮球', list: '🏀 ⛹️ 🤾 🏃 🏅 🥇 🥈 🥉 📈 📊 ⏱️ 🎯 🙌 🔥'.split(' ') },
  { name: '其他', list: '☕ 🍺 🍜 🎮 💰 💤 👑 🤖 💩 🐐 ✅ ❌ ❓ ❗ 💬 👇'.split(' ') },
]

export default function EmojiPicker({ onPick }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const content = (
    <div style={{ width: isMobile ? 260 : 288, maxHeight: 300, overflowY: 'auto' }}>
      {GROUPS.map((g) => (
        <div key={g.name} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#999', margin: '4px 2px' }}>{g.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {g.list.map((e, i) => (
              <span
                key={g.name + i}
                onClick={() => { onPick(e); setOpen(false) }}
                style={{
                  fontSize: 21, lineHeight: '32px', width: 34, height: 34, textAlign: 'center',
                  cursor: 'pointer', borderRadius: 8, userSelect: 'none',
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = '#f0f0f0' }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="topLeft" arrow={false}>
      <Tooltip title="表情">
        <SmileOutlined style={{ fontSize: 18, color: '#8c8c8c', cursor: 'pointer' }} />
      </Tooltip>
    </Popover>
  )
}
