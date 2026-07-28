import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, Badge, Button, Empty, Input, Popconfirm, Spin, Upload, message as toast } from 'antd'
import { ArrowLeftOutlined, MessageOutlined, PictureOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import { newsApi } from '../api/news'
import { searchApi } from '../api/search'
import { subscribeRoom } from '../realtime/pmSocket'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 专题群聊：入口按钮 + 全屏聊天间，都在这一个组件里。
 *
 * 为什么合成一个：未读数要在面板关着的时候也能涨，那就得**一直订阅**着房间。
 * 拆成「按钮在外、面板在内」的话，订阅归谁管会很别扭。现在的做法是组件常驻、
 * 只有那层全屏罩子按 open 显隐，订阅从进专题页那一刻就建立。
 *
 * 收发是两条路：发走 REST（/chat/send），收走 WebSocket（订阅 /room/{topicId}）。
 * 自己发的消息也从广播里回来，不做本地回显——省掉「临时条目和真条目对不上」的一整类麻烦。
 *
 * 每次打开都重新拉一次最近历史，不是只靠推送：手机切后台会断连，
 * 断连期间的消息推不到，只能靠这一次拉取补齐。
 */

const BRAND = '#fa541c'

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

/**
 * 把正文里的 @昵称 描出来。名字从消息自带的 mentions（[{id,name}]）来，
 * 不靠前端猜——猜的话「@张三丰」会被当成「@张三」。@ 到我自己的那个描得更重。
 */
function renderText(content, mentionsJson, myId) {
  let mentions = []
  try {
    mentions = mentionsJson ? JSON.parse(mentionsJson) : []
  } catch {
    mentions = []
  }
  if (!mentions.length) return content
  // 长名字优先，避免短名字先切断长名字
  const names = mentions.map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length)
  const idOf = Object.fromEntries(mentions.map((m) => [m.name, m.id]))
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  const out = []
  let last = 0
  let m
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push(content.slice(last, m.index))
    const mine = idOf[m[1]] === myId
    out.push(
      <span key={`${m.index}-${m[1]}`} style={{ color: mine ? '#d4380d' : '#1677ff', fontWeight: mine ? 700 : 600 }}>
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < content.length) out.push(content.slice(last))
  return out
}

export default function TopicChat({ topic }) {
  const { user, dn } = useAuth()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [more, setMore] = useState(false)   // 还有更早的历史吗
  const [unread, setUnread] = useState(0)
  const [atOpts, setAtOpts] = useState(null) // @ 候选；null=面板没开
  const bodyRef = useRef(null)
  const openRef = useRef(open)
  const topicId = topic?.topicId
  openRef.current = open

  const scrollToBottom = useCallback(() => {
    // 等这一帧渲染完再滚，否则量到的还是旧高度
    requestAnimationFrame(() => {
      const el = bodyRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  // 进专题页就把未读数拉一次（面板还没开也要显示角标）
  useEffect(() => {
    if (!topicId) return
    chatApi.unread(topicId).then((n) => setUnread(Number(n) || 0)).catch(() => {})
  }, [topicId])

  // 房间订阅常驻：面板关着也要收，否则未读数不会动
  useEffect(() => {
    if (!topicId) return undefined
    return subscribeRoom(topicId, (frame) => {
      const { type, data } = frame || {}
      if (type === 'recall') {
        setRows((prev) => (prev || []).map((m) => (
          m.msgId === data.msgId ? { ...m, recalled: true, content: '', imageUrl: null } : m
        )))
        return
      }
      if (type !== 'message' || !data) return
      setRows((prev) => {
        if (!prev) return prev // 面板没打开过，历史还没拉，等打开时一起拉
        if (prev.some((m) => m.msgId === data.msgId)) return prev // 重连可能重复推
        return [...prev, data]
      })
      if (openRef.current) {
        scrollToBottom()
      } else if (data.senderId !== user?.userId) {
        setUnread((n) => n + 1)
      }
    })
  }, [topicId, user?.userId, scrollToBottom])

  // 打开：拉最近历史 + 打卡清未读 + 锁住背景滚动
  useEffect(() => {
    if (!open || !topicId) return undefined
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
    chatApi.markRead(topicId).catch(() => {})
    setUnread(0)

    // 全屏罩子自己有滚动区，底下的专题页必须钉住，否则手指一滑滚的是背景
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onEsc)
    return () => {
      alive = false
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onEsc)
      // 关的时候再打一次卡：开着的这段时间里进来的消息是当面看过的，不该算未读
      chatApi.markRead(topicId).catch(() => {})
    }
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
        // 往顶部插会把当前内容顶下去，按插入前的距离补回来，视觉上停在原处
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - keep })
      }
    } catch { /* 拦截器已提示 */ }
  }

  const send = async (imageUrl) => {
    const content = text.trim()
    if ((!content && !imageUrl) || sending) return
    setSending(true)
    try {
      await chatApi.send(topicId, content, imageUrl)
      if (!imageUrl) setText('')
    } catch (e) {
      toast.error(e?.msg || '发送失败')
    } finally {
      setSending(false)
    }
  }

  const recall = async (msgId) => {
    try {
      await chatApi.recall(msgId)
    } catch { /* 拦截器已提示 */ }
  }

  // 必须**同步**返回 false：返回 Promise 的话 rc-upload 会拿 resolve 的值当文件再发一次请求。
  // 上传和发送在后台自己走完
  const upload = (file) => {
    ;(async () => {
      try {
        const url = await newsApi.uploadCommentFile(file, topicId)
        if (url) await send(url)
      } catch {
        toast.error('图片上传失败')
      }
    })()
    return false
  }

  // 输入框里打 @ 就地弹候选：取最后一个 @ 到光标之间的片段当关键词
  const onTextChange = async (v) => {
    setText(v)
    const at = v.lastIndexOf('@')
    if (at < 0 || v.length - at > 12 || /\s/.test(v.slice(at + 1))) {
      setAtOpts(null)
      return
    }
    try {
      const list = await searchApi.mentionUsers(v.slice(at + 1))
      setAtOpts((list || []).slice(0, 6))
    } catch {
      setAtOpts(null)
    }
  }
  const pickAt = (u) => {
    const at = text.lastIndexOf('@')
    // 插进去的必须是真昵称：后端按全站昵称反查 id，用备注名会认不出来
    setText(`${text.slice(0, at)}@${u.userNickname} `)
    setAtOpts(null)
  }

  const canRecall = (m) => !m.recalled && (m.senderId === user?.userId || topic?.canManage)

  const bubbles = useMemo(() => rows, [rows])

  if (!topic?.canChat) return null

  return (
    <>
      {/* 入口：和最新/最热那组 Segmented 并排，但样式刻意不同——它不是第四个视图，
          点下去是进另一个空间，不是换一种排序 */}
      <Badge count={unread} size="small" offset={[-4, 2]}>
        <Button
          icon={<MessageOutlined />}
          onClick={() => setOpen(true)}
          style={{
            fontWeight: 600, borderRadius: 999,
            color: BRAND, borderColor: '#ffbb96', background: '#fff7f0',
          }}
        >
          群聊
        </Button>
      </Badge>

      {open && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100, background: '#f5f5f5',
            display: 'flex', flexDirection: 'column', height: '100dvh',
          }}
        >
          {/* 顶栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0,
          }}>
            <ArrowLeftOutlined onClick={() => setOpen(false)} style={{ fontSize: 17, cursor: 'pointer', color: '#666' }} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>{topic.name}</div>
            <span style={{ color: '#bbb', fontSize: 13 }}>群聊</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: '#bbb', fontSize: 12 }}>Esc 退出</span>
          </div>

          {/* 消息区：宽屏时收成一栏居中，不然聊天气泡拉到两米宽很难看 */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>
              {bubbles === null ? (
                <Spin style={{ display: 'block', margin: '60px auto' }} />
              ) : bubbles.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有人说话，来开个头" style={{ marginTop: 60 }} />
              ) : (
                <>
                  {more && (
                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                      <a onClick={loadEarlier} style={{ fontSize: 12, color: '#999' }}>加载更早的消息</a>
                    </div>
                  )}
                  {bubbles.map((m) => {
                    const mine = m.senderId === user?.userId
                    const name = dn(m.senderId, m.senderName) || '匿名'
                    if (m.recalled) {
                      return (
                        <div key={m.msgId} style={{ textAlign: 'center', color: '#bbb', fontSize: 12, margin: '10px 0' }}>
                          {mine ? '你' : name} 撤回了一条消息
                        </div>
                      )
                    }
                    return (
                      <div key={m.msgId} style={{ display: 'flex', gap: 8, marginBottom: 16, flexDirection: mine ? 'row-reverse' : 'row' }}>
                        {m.senderAvatar
                          ? <Avatar size={34} src={m.senderAvatar} style={{ flexShrink: 0 }} />
                          : <Avatar size={34} style={{ background: avatarColor(name), flexShrink: 0 }}>{String(name)[0].toUpperCase()}</Avatar>}
                        <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>
                            {mine ? stamp(m.sendTime) : `${name} · ${stamp(m.sendTime)}`}
                          </div>
                          {m.imageUrl && (
                            <a href={m.imageUrl} target="_blank" rel="noreferrer">
                              <img
                                src={m.imageUrl}
                                alt=""
                                style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, display: 'block', marginBottom: m.content ? 6 : 0 }}
                              />
                            </a>
                          )}
                          {m.content && (
                            <div style={{
                              padding: '7px 11px', borderRadius: 10, fontSize: 14, lineHeight: 1.6,
                              wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                              background: mine ? BRAND : '#fff',
                              color: mine ? '#fff' : '#333',
                              border: mine ? 'none' : '1px solid #eee',
                            }}>
                              {renderText(m.content, m.mentions, user?.userId)}
                            </div>
                          )}
                          {canRecall(m) && (
                            <Popconfirm title="撤回这条消息？" okText="撤回" cancelText="取消" onConfirm={() => recall(m.msgId)}>
                              <a style={{ fontSize: 11, color: '#ccc', marginTop: 3 }}>撤回</a>
                            </Popconfirm>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* 输入区 */}
          <div style={{ background: '#fff', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: 12, position: 'relative' }}>
              {atOpts?.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 12, right: 12, background: '#fff',
                  border: '1px solid #f0f0f0', borderRadius: 10, boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
                  maxHeight: 200, overflowY: 'auto', zIndex: 2,
                }}>
                  {atOpts.map((u) => (
                    <div
                      key={u.userId}
                      onMouseDown={(e) => { e.preventDefault(); pickAt(u) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
                    >
                      {u.avatar
                        ? <Avatar size={22} src={u.avatar} />
                        : <Avatar size={22} style={{ background: avatarColor(u.userNickname), fontSize: 12 }}>{String(u.userNickname || '?')[0].toUpperCase()}</Avatar>}
                      <span style={{ fontSize: 13 }}>{dn(u.userId, u.userNickname)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Input.TextArea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onPressEnter={(e) => {
                  // 回车发送，Shift+回车换行（和大多数聊天框一致）
                  if (!e.shiftKey) { e.preventDefault(); send() }
                }}
                placeholder="说点什么…（@ 可以提到人，回车发送，Shift+回车换行）"
                maxLength={500}
                autoSize={{ minRows: isMobile ? 2 : 2, maxRows: 5 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Upload accept="image/*" showUploadList={false} beforeUpload={upload}>
                  <Button icon={<PictureOutlined />} title="发图片" />
                </Upload>
                <span style={{ flex: 1 }} />
                <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!text.trim()} onClick={() => send()}>
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
