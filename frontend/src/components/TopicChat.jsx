import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar, Badge, Button, Empty, Input, Popconfirm, Spin, Upload, message as toast } from 'antd'
import { CloseOutlined, LoadingOutlined, MessageOutlined, PaperClipOutlined, PictureOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import { newsApi } from '../api/news'
import { searchApi } from '../api/search'
import { subscribeRoom } from '../realtime/pmSocket'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'
import EmojiPicker from './EmojiPicker'

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
/** 附件类型（图片单独走 <Upload accept="image/*">，这里是文档类） */
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,.7z'
/** 弹层要压在聊天框（1100）之上，否则 Popconfirm 弹出来在框底下，看着像"点不动" */
const POPUP_Z = 1200

/** 工具条上那几个图标按钮：跟 EmojiPicker 自带的笑脸按钮对齐 */
const toolIcon = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 17,
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
  const [uploading, setUploading] = useState(false)
  const [box, setBox] = useState(null)       // PC 端聊天框的位置（避开顶栏和侧栏）
  const [vp, setVp] = useState(null)         // 移动端可视视口高度（软键盘弹出会变）
  const taRef = useRef(null)
  const bodyRef = useRef(null)
  const openRef = useRef(open)
  const topicId = topic?.topicId
  openRef.current = open

  /**
   * PC 端聊天框只盖内容区，顶栏和侧栏露着。位置量 DOM 而不是写死尺寸——侧栏能折叠，
   * 写死就会露一条缝或者盖住半个菜单。在打开**之前**先量好，免得第一帧闪一下全屏。
   */
  const measure = useCallback(() => {
    const sider = document.querySelector('.ant-pro-sider')
    const header = document.querySelector('.ant-pro-layout .ant-layout-header')
    const siderRect = sider?.getBoundingClientRect()
    setBox({
      left: siderRect && siderRect.width > 0 ? siderRect.right : 0,
      top: header ? header.getBoundingClientRect().bottom : 0,
    })
  }, [])

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

    // 聊天框自己有滚动区，底下的专题页必须钉住，否则手指一滑滚的是背景
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onEsc)

    window.addEventListener('resize', measure)

    // 移动端软键盘：可视视口会缩，聊天框跟着缩，输入框才不会被键盘盖住、
    // 底下也不会漏出专题页（照搬私信页那套 visualViewport 处理）
    const vv = window.visualViewport
    const onVv = () => setVp({ h: vv.height, top: vv.offsetTop })
    if (vv) {
      onVv()
      vv.addEventListener('resize', onVv)
      vv.addEventListener('scroll', onVv)
    }

    return () => {
      alive = false
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onEsc)
      window.removeEventListener('resize', measure)
      if (vv) { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv) }
      // 关的时候再打一次卡：开着的这段时间里进来的消息是当面看过的，不该算未读
      chatApi.markRead(topicId).catch(() => {})
    }
  }, [open, topicId, scrollToBottom, measure])

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
   * 图片和附件都走评论那个上传接口，区别只在发出去时挂 imageUrl 还是 fileUrl：
   * 图片要在气泡里内联显示，附件只出一行可点的文件名。
   *
   * 必须**同步**返回 false：返回 Promise 的话 rc-upload 会拿 resolve 的值当文件再发一次请求。
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

  /** 在光标处插入 emoji，插完把光标放到它后面（不然连点几个表情会插到开头） */
  const insertEmoji = (e) => {
    const ta = taRef.current?.resizableTextArea?.textArea
    const at = ta ? ta.selectionStart : text.length
    setText(text.slice(0, at) + e + text.slice(ta ? ta.selectionEnd : text.length))
    requestAnimationFrame(() => {
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = at + e.length }
    })
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

  if (!topic?.canChat) return null

  return (
    <>
      {/* 入口：和最新/最热那组 Segmented 并排，但样式刻意不同——它不是第四个视图，
          点下去是进另一个空间，不是换一种排序 */}
      <Badge count={unread} size="small" offset={[-4, 2]}>
        <Button
          icon={<MessageOutlined />}
          onClick={() => { measure(); setOpen(true) }}
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
            position: 'fixed', zIndex: 1100, display: 'flex', flexDirection: 'column',
            background: '#f5f5f5', overflow: 'hidden',
            // 移动端：贴着可视视口（键盘弹出会缩），所以不用 inset:0，量出来多少就占多少
            ...(isMobile
              ? { left: 0, right: 0, top: vp?.top ?? 0, height: vp?.h ? `${vp.h}px` : '100dvh' }
              : {
                  // PC：只盖内容区，顶栏和侧栏露着，做成一块有边框和阴影的浮层
                  left: box?.left ?? 0, top: box?.top ?? 0, right: 0, bottom: 0,
                  borderTopLeftRadius: 14, boxShadow: '-6px -2px 24px rgba(0,0,0,.10)',
                  borderLeft: '1px solid #eee', borderTop: '1px solid #eee',
                }),
          }}
        >
          {/* 顶栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0,
          }}>
            <MessageOutlined style={{ color: BRAND }} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>{topic.name}</div>
            <span style={{ color: '#bbb', fontSize: 13 }}>群聊</span>
            <span style={{ flex: 1 }} />
            {!isMobile && <span style={{ color: '#ccc', fontSize: 12, marginRight: 4 }}>Esc 关闭</span>}
            <CloseOutlined onClick={() => setOpen(false)} style={{ fontSize: 15, cursor: 'pointer', color: '#999' }} />
          </div>

          {/* 消息区：宽屏时收成一栏居中，不然气泡会拉到两米宽 */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px' }}>
              {rows === null ? (
                <Spin style={{ display: 'block', margin: '60px auto' }} />
              ) : rows.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有人说话，来开个头" style={{ marginTop: 60 }} />
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
                        {m.senderAvatar
                          ? <Avatar size={34} src={m.senderAvatar} style={{ flexShrink: 0 }} />
                          : <Avatar size={34} style={{ background: avatarColor(name), flexShrink: 0 }}>{String(name)[0].toUpperCase()}</Avatar>}
                        <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span>{mine ? stamp(m.sendTime) : `${name} · ${stamp(m.sendTime)}`}</span>
                            {canRecall(m) && (
                              <Popconfirm
                                title="撤回这条消息？"
                                okText="撤回"
                                cancelText="取消"
                                zIndex={POPUP_Z}
                                onConfirm={() => recall(m.msgId)}
                              >
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
                                padding: '7px 11px', borderRadius: 10, background: '#fff', border: '1px solid #eee',
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
                              background: mine ? BRAND : '#fff',
                              color: mine ? '#fff' : '#333',
                              border: mine ? 'none' : '1px solid #eee',
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
            </div>
          </div>

          {/* 输入区：工具条在上、输入框在下，发送按钮嵌在输入框右下角 */}
          <div style={{ background: '#fff', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 12px 12px', position: 'relative' }}>
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

              {/* 工具条：表情 / 图片 / 附件。放输入框上面，别挤在下面占一行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, color: '#8c8c8c' }}>
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
                  style={{ paddingRight: 78, paddingBottom: 10 }}
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
        </div>,
        document.body,
      )}
    </>
  )
}
