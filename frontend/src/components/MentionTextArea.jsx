import { useEffect, useMemo, useRef, useState } from 'react'
import { Input, Tag } from 'antd'
import { followApi } from '../api/follow'
import { useAuth } from '../auth/AuthContext'

/**
 * 带 @ 联想的输入框（赛后评分的短评和回复用）。
 *
 * ## 联想只给「有来往的人」
 *
 * 候选＝**关注我的人 ∪ 我关注的人**，去重。不给全站名单：一个几百人的下拉里
 * 找那一个人，比自己把昵称打全还慢，而且大部分人一辈子也不会 @ 到他们。
 *
 * ## 不在联想里的人照样能 @
 *
 * 这个面板**只是打字的省力工具**，不是权限。选中一项做的事情就是往文本里插
 * `@昵称 `，和自己一个字一个字打出来完全等价——**谁被 @ 到是后端按全站昵称
 * 解析出来的**（MentionUtil.resolveTextMentions，最长昵称优先）。
 * 所以陌生人只要昵称打对就能 @ 到，只是没有提示。
 *
 * 这也意味着这个组件不用往上报「选中了谁」：不存在需要回传的状态。
 */
export default function MentionTextArea({ value, onChange, ...rest }) {
  const { user, dn } = useAuth()
  const [pool, setPool] = useState(null) // 候选人 [{id, name}]，null=还没拉
  const [sug, setSug] = useState(null)   // 正在输入的 @ 片段 {query, start}
  const wrapRef = useRef()

  // 只在第一次真的打出 @ 时才拉。进页面就拉的话，绝大多数人只是来看看比分，
  // 白白多两个请求
  useEffect(() => {
    if (!sug || pool !== null || !user) return
    let alive = true
    Promise.all([
      followApi.list(user.userId, 'followers').catch(() => []),
      followApi.list(user.userId, 'following').catch(() => []),
    ]).then(([followers, following]) => {
      if (!alive) return
      const seen = new Map()
      for (const f of [...(followers || []), ...(following || [])]) {
        if (f?.userId && f.userNickname && !seen.has(f.userId)) {
          seen.set(f.userId, { id: f.userId, name: f.userNickname })
        }
      }
      setPool([...seen.values()])
    })
    return () => { alive = false }
  }, [sug, pool, user])

  // 光标前是未完成的 "@xx" 片段就开面板
  const refreshSug = (val, caret) => {
    if (!user) return
    const m = /@([^\s@]{0,20})$/.exec(val.slice(0, caret ?? val.length))
    setSug(m ? { query: m[1], start: (caret ?? val.length) - m[1].length - 1 } : null)
  }

  const list = useMemo(() => {
    if (!sug || !pool) return []
    const q = sug.query.toLowerCase()
    return pool
      .filter((f) => !q || f.name.toLowerCase().includes(q) || (dn(f.id, f.name) || '').toLowerCase().includes(q))
      .slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sug, pool])

  const pick = (f) => {
    const before = value.slice(0, sug.start)
    const after = value.slice(sug.start + 1 + sug.query.length)
    const inserted = `@${f.name} `
    onChange(before + inserted + after)
    setSug(null)
    const ta = wrapRef.current?.querySelector('textarea')
    requestAnimationFrame(() => {
      ta?.focus()
      const pos = before.length + inserted.length
      ta?.setSelectionRange(pos, pos)
    })
  }

  return (
    <div ref={wrapRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <Input.TextArea
        className="pill-input"
        variant="filled"
        value={value}
        onChange={(e) => { onChange(e.target.value); refreshSug(e.target.value, e.target.selectionStart) }}
        // 延一手再关：不延的话点候选项时先触发 blur，面板已经没了，那一下点了个空
        onBlur={() => setTimeout(() => setSug(null), 150)}
        {...rest}
      />
      {list.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 20, minWidth: 180,
            border: '1px solid #f0f0f0', borderRadius: 8, marginTop: 4, background: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,.08)', overflow: 'hidden',
          }}
        >
          {list.map((f) => {
            const remark = dn(f.id, f.name)
            return (
              <div
                key={f.id}
                // onMouseDown 抢在 blur 之前完成插入
                onMouseDown={(e) => { e.preventDefault(); pick(f) }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ fontWeight: 600 }}>@{f.name}</span>
                {remark !== f.name && <Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>{remark}</Tag>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
