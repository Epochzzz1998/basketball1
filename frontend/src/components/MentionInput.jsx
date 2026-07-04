import { useRef, useState } from 'react'
import { Avatar, Mentions } from 'antd'
import { searchApi } from '../api/search'

/**
 * @-mention 输入框（评论 / 回复用）：包一层 antd <Mentions>。
 * 打 `@` 弹候选下拉（全站按昵称搜，服务端过滤），选中插入 `@昵称`。
 * - 只有"从下拉真正选过"的人才算 mention（记进 pickedRef）；手打 @xxx 不算——Slack/GitHub 同款语义；
 * - onChange(text, mentions) 把正文和 [{id,name}] 一并抛给父组件；
 *   mentions = 选过的人里、其 `@昵称` 仍留在正文中的（删掉就不再算）。
 * 无头像回退首字母彩底，和评论区头像规则一致。
 */

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

export default function MentionInput({ value, onChange, placeholder, autoSize, variant = 'filled', onKeyDown, style }) {
  const [options, setOptions] = useState([])
  const pickedRef = useRef(new Map()) // 选过的人：nickname -> {id, name}
  const timerRef = useRef()

  const search = (text) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const list = await searchApi.mentionUsers(text || '')
        setOptions(
          (list || []).map((u) => ({
            value: u.userNickname,
            userId: u.userId,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {u.avatar ? (
                  <Avatar size={20} src={u.avatar} />
                ) : (
                  <Avatar size={20} style={{ background: avatarColor(u.userNickname), fontSize: 11 }}>
                    {String(u.userNickname || '?')[0].toUpperCase()}
                  </Avatar>
                )}
                {u.userNickname}
              </span>
            ),
          })),
        )
      } catch {
        setOptions([])
      }
    }, 250)
  }

  const handleChange = (text) => {
    const mentions = []
    pickedRef.current.forEach((u, name) => {
      if (text.includes('@' + name)) mentions.push(u)
    })
    onChange(text, mentions)
  }

  return (
    <Mentions
      value={value}
      onChange={handleChange}
      onSearch={search}
      onSelect={(opt) => pickedRef.current.set(opt.value, { id: opt.userId, name: opt.value })}
      options={options}
      filterOption={false}
      placeholder={placeholder}
      autoSize={autoSize}
      variant={variant}
      onKeyDown={onKeyDown}
      style={style}
      notFoundContent="无匹配用户"
    />
  )
}
