import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, Card, Empty, Input, Popconfirm, Spin, Upload, message as toast } from 'antd'
import { LoadingOutlined, MessageOutlined, PaperClipOutlined, PictureOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { chatApi } from '../../api/chat'
import { newsApi } from '../../api/news'
import { searchApi } from '../../api/search'
import { topicApi } from '../../api/topic'
import { subscribeRoom } from '../../realtime/pmSocket'
import { useAuth } from '../../auth/AuthContext'
import EmojiPicker from '../../components/EmojiPicker'

/**
 * 专题群聊页（/news/topic/:topicId/chat）。
 *
 * **是一张普通页面，不是浮层。** 之前做成 fixed 全屏罩子，移动端软键盘一弹就出各种
 * 对不齐的毛病：底下漏出专题页、还能滑动。改成走路由之后这些问题从根上没有了——
 * 页面就是页面，滚动条只有一个，键盘弹出浏览器自己会把输入框顶上来。
 *
 * 卡片高度是量出来的（视口高 - 卡片距顶），撑满一屏；滚动发生在消息区自己身上，
 * 输入区固定在卡片底部。不用 fixed 定位，所以移动端软键盘弹出时不会出现
 * 「底下漏出别的页面」那类对不齐的问题。
 *
 * 收发两条路：发走 REST（/chat/send），收走 WebSocket（订阅 /room/{topicId}）。
 * 自己发的消息也从广播回来，不做本地回显。
 */

const BRAND = '#fa541c'
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,.7z'

const toolIcon = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 17, color: '#8c8c8c',
}

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
 * 把正文里的 @昵称 描出来。名字取自消息自带的 mentions（[{id,name}]），不靠前端猜——
 * 猜的话「@张三丰」会被当成「@张三」。@ 到我自己的那个描得更重。
 */
function renderText(content, mentionsJson, myId) {
  let mentions = []
  try {
    mentions = mentionsJson ? JSON.parse(mentionsJson) : []
  } catch {
    mentions = []
  }
  if (!mentions.length) return content
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

export default function TopicChatPage() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const { user, dn } = useAuth()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [more, setMore] = useState(false)
  const [atOpts, setAtOpts] = useState(null)
  const taRef = useRef(null)
  const endRef = useRef(null)
  const cardRef = useRef(null)
  const listRef = useRef(null)
  const [height, setHeight] = useState(null) // 聊天卡的高度：撑到屏幕底部

  /** 滚到最后一条（消息区自己是滚动容器） */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  /**
   * 聊天卡要占满一屏，不能只有内容那么高——半屏聊天框下面空一大片很怪。
   * 高度是量出来的：视口高 - 卡片距顶的距离 - 底部留白。不写死是因为上面有
   * 顶栏、内容区内边距、还有那个全局「返回」，加起来多少跟页面状态有关。
   */
  useEffect(() => {
    const fit = () => {
      const el = cardRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      setHeight(Math.max(360, window.innerHeight - top - 20))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [loading])

  useEffect(() => {
    let alive = true
    topicApi.get(topicId)
      .then((t) => { if (alive) setTopic(t || null) })
      .catch(() => { if (alive) setTopic(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [topicId])

  // 拉历史 + 打卡清未读
  useEffect(() => {
    if (!topic?.canChat) return undefined
    let alive = true
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
    return () => {
      alive = false
      // 离开时再打一次卡：这段时间里进来的消息是当面看过的，不该算未读
      chatApi.markRead(topicId).catch(() => {})
    }
  }, [topic?.canChat, topicId, scrollToBottom])

  // 实时接收
  useEffect(() => {
    if (!topic?.canChat) return undefined
    return subscribeRoom(topicId, (frame) => {
      const { type, data } = frame || {}
      if (type === 'recall') {
        setRows((prev) => (prev || []).map((m) => (
          m.msgId === data.msgId ? { ...m, recalled: true, content: '', imageUrl: null, fileUrl: null } : m
        )))
        return
      }
      if (type !== 'message' || !data) return
      setRows((prev) => {
        if (!prev) return [data]
        if (prev.some((m) => m.msgId === data.msgId)) return prev // 重连可能重复推
        return [...prev, data]
      })
      scrollToBottom()
    })
  }, [topic?.canChat, topicId, scrollToBottom])

  const loadEarlier = async () => {
    if (!rows?.length) return
    try {
      const r = await chatApi.history(topicId, rows[0].sendTime)
      const list = Array.isArray(r) ? r : []
      setMore(list.length >= 30)
      if (list.length) {
        const el = listRef.current
        const keep = el ? el.scrollHeight - el.scrollTop : 0
        setRows((prev) => [...list, ...(prev || [])])
        // 往顶部插会把当前内容顶下去，按插入前的距离补回来，视觉上停在原处
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - keep })
      }
    } catch { /* 拦截器已提示 */ }
  }

  const send = async (extra) => {
    const content = text.trim()
    if ((!content && !extra) || sending) return
    setSending(true)
    try {
      await chatApi.send(topicId, { content, ...(extra || {}) })
      if (!extra) setText('')
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

  /**
   * 图片和附件走同一个上传接口，区别只在发出去时挂 imageUrl 还是 fileUrl：
   * 图片要内联显示，附件只出一行可点的文件名。
   * 必须**同步**返回 false——返回 Promise 的话 rc-upload 会拿 resolve 的值当文件再发一次请求。
   */
  const makeUpload = (asImage) => (file) => {
    ;(async () => {
      setUploading(true)
      try {
        const url = await newsApi.uploadCommentFile(file, topicId)
        if (url) await send(asImage ? { imageUrl: url } : { fileUrl: url, fileName: file.name })
      } catch {
        toast.error(asImage ? '图片上传失败' : '附件上传失败')
      } finally {
        setUploading(false)
      }
    })()
    return false
  }

  /** 在光标处插入 emoji，插完把光标放到它后面（不然连点几个会插到开头） */
  const insertEmoji = (e) => {
    const ta = taRef.current?.resizableTextArea?.textArea
    const at = ta ? ta.selectionStart : text.length
    setText(text.slice(0, at) + e + text.slice(ta ? ta.selectionEnd : text.length))
    requestAnimationFrame(() => {
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = at + e.length }
    })
  }

  // 打 @ 就地弹候选：取最后一个 @ 到光标之间的片段当关键词
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
  const goUser = (id) => id && navigate(`/users/${id}`)

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />

  if (!topic?.canChat) {
    return (
      <Card style={{ borderRadius: 14 }}>
        <Empty description={topic ? '这个专题没有开放群聊，或者你没有进入权限' : '专题不存在'}>
          <Button onClick={() => navigate(topic ? `/news/topic/${topicId}` : '/news')}>返回</Button>
        </Empty>
      </Card>
    )
  }

  return (
    <Card
      ref={cardRef}
      style={{ borderRadius: 14, height: height ?? undefined, display: 'flex', flexDirection: 'column' }}
      styles={{ body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MessageOutlined style={{ color: BRAND }} />
          {topic.name}
          <span style={{ color: '#bbb', fontSize: 13, fontWeight: 400 }}>群聊</span>
        </span>
      }
      extra={<a onClick={() => navigate(`/news/topic/${topicId}`)} style={{ fontSize: 13 }}>回专题</a>}
    >
      {/* 消息区：卡片高度定死之后，滚动就发生在这里面。
          消息从上往下排（最早的顶在最上面），空的部分留在下面 */}
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 8px' }}>
        <div>
        {rows === null ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : rows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有人说话，来开个头" style={{ margin: '40px 0' }} />
        ) : (
          <>
            {more && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <a onClick={loadEarlier} style={{ fontSize: 12, color: '#999' }}>加载更早的消息</a>
              </div>
            )}
            {rows.map((m) => {
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
                  {/* 头像和名字都能点进个人主页——群里看到个人想知道他是谁，这是最自然的入口 */}
                  <span onClick={() => goUser(m.senderId)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                    {m.senderAvatar
                      ? <Avatar size={34} src={m.senderAvatar} />
                      : <Avatar size={34} style={{ background: avatarColor(name) }}>{String(name)[0].toUpperCase()}</Avatar>}
                  </span>
                  <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {mine ? <span>{stamp(m.sendTime)}</span> : (
                        <span>
                          <a onClick={() => goUser(m.senderId)} style={{ color: '#999' }}>{name}</a>
                          {` · ${stamp(m.sendTime)}`}
                        </span>
                      )}
                      {canRecall(m) && (
                        <Popconfirm title="撤回这条消息？" okText="撤回" cancelText="取消" onConfirm={() => recall(m.msgId)}>
                          <a style={{ fontSize: 11, color: '#bbb' }}>撤回</a>
                        </Popconfirm>
                      )}
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
                    {m.fileUrl && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: m.content ? 6 : 0,
                          padding: '7px 11px', borderRadius: 10, background: '#fafafa', border: '1px solid #eee',
                          color: '#333', fontSize: 13, maxWidth: 240,
                        }}
                      >
                        <PaperClipOutlined style={{ color: '#999' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.fileName || '附件'}
                        </span>
                      </a>
                    )}
                    {m.content && (
                      <div style={{
                        padding: '7px 11px', borderRadius: 10, fontSize: 14, lineHeight: 1.6,
                        wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                        background: mine ? BRAND : '#f7f7f7',
                        color: mine ? '#fff' : '#333',
                      }}>
                        {renderText(m.content, m.mentions, user?.userId)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
        <div ref={endRef} />
        </div>
      </div>

      {/* 输入区：固定在卡片底部 */}
      <div style={{
        flexShrink: 0, background: '#fff', borderTop: '1px solid #f0f0f0',
        padding: '8px 12px calc(10px + env(safe-area-inset-bottom))',
        borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
      }}>
        <div style={{ position: 'relative' }}>
          {atOpts?.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff',
              border: '1px solid #f0f0f0', borderRadius: 10, boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
              maxHeight: 200, overflowY: 'auto', zIndex: 5, marginBottom: 6,
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

          {/* 工具条在输入框上面，别挤在下面单占一行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <EmojiPicker onPick={insertEmoji} />
            <Upload accept="image/*" showUploadList={false} beforeUpload={makeUpload(true)}>
              <span title="发图片" style={toolIcon}><PictureOutlined /></span>
            </Upload>
            <Upload accept={FILE_ACCEPT} showUploadList={false} beforeUpload={makeUpload(false)}>
              <span title="发附件" style={toolIcon}><PaperClipOutlined /></span>
            </Upload>
            {uploading && <LoadingOutlined style={{ color: BRAND, marginLeft: 4 }} />}
          </div>

          <div style={{ position: 'relative' }}>
            <Input.TextArea
              ref={taRef}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onPressEnter={(e) => {
                // 回车发送，Shift+回车换行（和大多数聊天框一致）
                if (!e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="说点什么…（@ 提到人，回车发送，Shift+回车换行）"
              maxLength={500}
              autoSize={{ minRows: 2, maxRows: 5 }}
              style={{ paddingRight: 82, paddingBottom: 10 }}
            />
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              loading={sending}
              disabled={!text.trim()}
              onClick={() => send()}
              style={{ position: 'absolute', right: 8, bottom: 8, borderRadius: 8 }}
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
