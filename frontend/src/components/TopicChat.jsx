import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, Button, Drawer, Empty, Input, Spin, message as toast } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import { subscribeRoom } from '../realtime/pmSocket'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 专题群聊面板（抽屉）。
 *
 * 收发是两条路：发走 REST（/chat/send），收走 WebSocket（订阅 /room/{topicId}）。
 * 自己发的消息也是从广播里回来的，不做本地回显——省掉「乐观插入的临时条目」和
 * 「服务端回来的真条目」对不上的一整类麻烦，代价是自己看到消息会晚一个来回。
 *
 * 每次打开都重新拉一次最近历史，不是只靠推送：手机切后台会断连，
 * 断连期间的消息推不到，只能靠这一次拉取补齐。
 */

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

/** 同一天只显示时分，跨天补上日期 */
const stamp = (ms) => {
  const d = dayjs(ms)
  return d.isSame(dayjs(), 'day') ? d.format('HH:mm') : d.format('MM-DD HH:mm')
}

export default function TopicChat({ topic, open, onClose }) {
  const { user, dn } = useAuth()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [more, setMore] = useState(false) // 还有更早的历史吗
  const bodyRef = useRef(null)
  const topicId = topic?.topicId

  const scrollToBottom = useCallback(() => {
    // 等这一帧渲染完再滚，否则量到的还是旧高度
    requestAnimationFrame(() => {
      const el = bodyRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  // 打开时拉最近历史
  useEffect(() => {
    if (!open || !topicId) return
    let alive = true
    setRows(null)
    chatApi.history(topicId)
      .then((r) => {
        if (!alive) return
        const list = Array.isArray(r) ? r : []
        setRows(list)
        setMore(list.length >= 30)
        scrollToBottom()
      })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [open, topicId, scrollToBottom])

  // 订阅房间。面板关掉就退订，别让后台一直收着用不到的消息
  useEffect(() => {
    if (!open || !topicId) return undefined
    const off = subscribeRoom(topicId, (msg) => {
      setRows((prev) => {
        if (!prev) return [msg]
        if (prev.some((m) => m.msgId === msg.msgId)) return prev // 重连后可能重复推
        return [...prev, msg]
      })
      scrollToBottom()
    })
    return off
  }, [open, topicId, scrollToBottom])

  const loadEarlier = async () => {
    if (!rows?.length) return
    try {
      const r = await chatApi.history(topicId, rows[0].sendTime)
      const list = Array.isArray(r) ? r : []
      setMore(list.length >= 30)
      if (list.length) {
        const el = bodyRef.current
        const keep = el ? el.scrollHeight - el.scrollTop : 0
        setRows((prev) => [...list, ...(prev || [])])
        // 插到顶部会把当前内容顶下去，按插入前的位置补回来，视觉上停在原处
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - keep })
      }
    } catch { /* 拦截器已提示 */ }
  }

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await chatApi.send(topicId, content)
      setText('')
    } catch (e) {
      toast.error(e?.msg || '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <Drawer
      title={<span>{topic?.name} · 群聊</span>}
      placement="right"
      width={isMobile ? '100%' : 420}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: '#fafafa' }}>
        {rows === null ? (
          <Spin style={{ display: 'block', margin: '60px auto' }} />
        ) : rows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有人说话，来开个头" style={{ marginTop: 60 }} />
        ) : (
          <>
            {more && (
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <a onClick={loadEarlier} style={{ fontSize: 12, color: '#999' }}>加载更早的消息</a>
              </div>
            )}
            {rows.map((m) => {
              const mine = m.senderId === user?.userId
              const name = dn(m.senderId, m.senderName) || '匿名'
              return (
                <div
                  key={m.msgId}
                  style={{
                    display: 'flex', gap: 8, marginBottom: 14,
                    flexDirection: mine ? 'row-reverse' : 'row',
                  }}
                >
                  {m.senderAvatar
                    ? <Avatar size={32} src={m.senderAvatar} style={{ flexShrink: 0 }} />
                    : <Avatar size={32} style={{ background: avatarColor(name), flexShrink: 0 }}>{String(name)[0].toUpperCase()}</Avatar>}
                  <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>
                      {mine ? stamp(m.sendTime) : `${name} · ${stamp(m.sendTime)}`}
                    </div>
                    <div
                      style={{
                        padding: '7px 11px', borderRadius: 10, fontSize: 14, lineHeight: 1.6,
                        wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                        background: mine ? '#fa541c' : '#fff',
                        color: mine ? '#fff' : '#333',
                        border: mine ? 'none' : '1px solid #eee',
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', padding: 12, background: '#fff' }}>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={(e) => {
            // 回车发送，Shift+回车换行（和大多数聊天框一致）
            if (!e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="说点什么…（回车发送，Shift+回车换行）"
          maxLength={500}
          autoSize={{ minRows: 2, maxRows: 5 }}
          style={{ marginBottom: 8 }}
        />
        <Button type="primary" block icon={<SendOutlined />} loading={sending} disabled={!text.trim()} onClick={send}>
          发送
        </Button>
      </div>
    </Drawer>
  )
}
