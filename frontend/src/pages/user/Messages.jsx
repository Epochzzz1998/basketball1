import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Grid, Image, Input, Modal, Popconfirm, Select, Spin, Tooltip, Upload, message } from 'antd'
import { ArrowLeftOutlined, CloseCircleFilled, DeleteOutlined, EditOutlined, FileOutlined, PictureOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { pmApi } from '../../api/pm'
import { userApi } from '../../api/user'
import { searchApi } from '../../api/search'
import { useAuth } from '../../auth/AuthContext'
import EmojiPicker from '../../components/EmojiPicker'
import UserTitles from '../../components/UserTitles'
import { SuperAdminBadge } from '../../components/RoleBadges'
import { humanSize } from '../../components/CommentComposer'

// 附件：图片走 image/*，文件走常见文档白名单；单条最多 9 个
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,.7z'
const MAX_ATTACH = 9

/**
 * 私信页（/messages，需登录，P5；P5-UI 现代化改版）：双栏聊天。
 * - 左栏会话列表（卡片式选中态 + 最后一条预览 + 未读角标 + 悬停删除）；
 * - 右栏气泡流（我方橙渐变靠右 / 对方白卡靠左，按天分割，**每条消息各带时间**，2 分钟内可撤回自己的）；
 * - 消息送达全靠 STOMP 推送（window 'pm-event'），REST 只负责写入与进场补历史；
 * - 深链 /messages?peerId=xxx 直接打开会话（从个人主页"发私信"进来，没聊过也能开新会话）。
 */

const BRAND = '#fa541c'
const PAGE = 30

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

function UserAvatar({ name, src, size, online }) {
  const av = src ? (
    <Avatar size={size} src={src} style={{ flexShrink: 0, display: 'block' }} />
  ) : (
    <Avatar size={size} style={{ background: avatarColor(name), fontWeight: 700, flexShrink: 0, display: 'block' }}>
      {String(name || '?')[0].toUpperCase()}
    </Avatar>
  )
  if (!online) return av // 只有在线才挂绿点，离线不显（避免列表满屏灰点）
  const d = Math.max(9, Math.round(size * 0.26))
  return (
    <span style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {av}
      <span
        title="在线"
        style={{
          position: 'absolute', right: 0, bottom: 0, width: d, height: d, borderRadius: '50%',
          background: '#52c41a', border: '2px solid #fff', boxSizing: 'border-box',
        }}
      />
    </span>
  )
}

// 会话列表的相对时间：今天只显示时分，今年显示月-日，更早带年份
const convTime = (v) => {
  if (!v) return ''
  const d = dayjs(v)
  if (d.isSame(dayjs(), 'day')) return d.format('HH:mm')
  if (d.isSame(dayjs(), 'year')) return d.format('MM-DD')
  return d.format('YYYY-MM-DD')
}

// 按天分割的标签：今天 / 昨天 / M月D日 / YYYY年M月D日
const dayLabel = (d) => {
  if (d.isSame(dayjs(), 'day')) return '今天'
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return '昨天'
  if (d.isSame(dayjs(), 'year')) return d.format('M月D日')
  return d.format('YYYY年M月D日')
}

// 气泡里的附件：图片内联缩略（可点开预览）+ 文件下载卡，按发送方向对齐
function MessageAttachments({ attachmentsJson, mine }) {
  let atts = []
  try { atts = JSON.parse(attachmentsJson || '[]') } catch { atts = [] }
  atts = atts.filter((a) => a && typeof a.url === 'string' && /^(https?:\/\/|\/)/.test(a.url))
  if (!atts.length) return null
  const images = atts.filter((a) => a.type === 'image')
  const files = atts.filter((a) => a.type !== 'image')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {images.length > 0 && (
        <Image.PreviewGroup>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
            {images.map((a, i) => (
              <Image key={i} src={a.url} width={128} height={128} style={{ objectFit: 'cover', borderRadius: 12 }} />
            ))}
          </div>
        </Image.PreviewGroup>
      )}
      {files.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          download={a.name || true}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12, color: 'inherit', maxWidth: 260, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}
        >
          <FileOutlined style={{ color: '#fa541c', fontSize: 18 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || '文件'}</span>
          {a.size != null && <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>{humanSize(a.size)}</span>}
        </a>
      ))}
    </div>
  )
}

export default function Messages() {
  const { user } = useAuth()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md // < 768px：会话列表/聊天窗单栏切换，不并排
  const [searchParams, setSearchParams] = useSearchParams()
  const [convs, setConvs] = useState(null)
  const [peerId, setPeerId] = useState(searchParams.get('peerId') || null)
  const [freshPeer, setFreshPeer] = useState(null) // 没聊过的深链对象 {peerId, peerNickname, peerAvatar}
  const [msgs, setMsgs] = useState(null) // 当前会话消息（正序）
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState([]) // 待发送附件 [{type,url,name,size}]
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [onlineMap, setOnlineMap] = useState({}) // { userId: 是否在线 }
  const [composeOpen, setComposeOpen] = useState(false) // 发起私信弹窗
  const [composeOpts, setComposeOpts] = useState([]) // 搜到的用户候选
  const [composeLoading, setComposeLoading] = useState(false)
  const composeTimer = useRef(null)

  const scrollRef = useRef(null)
  const inputWrapRef = useRef(null)
  const peerIdRef = useRef(peerId)
  useEffect(() => { peerIdRef.current = peerId }, [peerId])

  const scrollBottom = useCallback((instant) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' })
    })
  }, [])

  const loadConvs = useCallback(() => {
    pmApi.conversations()
      .then((rows) => setConvs(rows || []))
      .catch(() => setConvs((c) => c || []))
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  // 当前会话头部信息：优先取会话行，没聊过的深链去拉对方资料
  const activePeer = useMemo(() => {
    const conv = convs?.find((c) => c.peerId === peerId)
    if (conv) return conv
    if (freshPeer && freshPeer.peerId === peerId) return freshPeer
    return peerId ? { peerId, peerNickname: '…' } : null
  }, [convs, peerId, freshPeer])

  // 在线状态：所有会话对象 + 当前对话方，进场 + 每 25s 轮询一次（presenceIds 是稳定字符串，
  // convs 每次刷新但只要"人的集合"没变就不会重建定时器）
  const presenceIds = useMemo(() => {
    const ids = new Set()
    ;(convs || []).forEach((c) => ids.add(c.peerId))
    if (peerId) ids.add(peerId)
    return [...ids].sort().join(',')
  }, [convs, peerId])

  useEffect(() => {
    if (!presenceIds) return
    let alive = true
    const fetchPresence = () => {
      pmApi.presence(presenceIds)
        .then((m) => { if (alive) setOnlineMap((o) => ({ ...o, ...(m || {}) })) })
        .catch(() => {})
    }
    fetchPresence()
    const timer = setInterval(fetchPresence, 25000)
    return () => { alive = false; clearInterval(timer) }
  }, [presenceIds])

  useEffect(() => {
    if (!peerId || convs === null) return
    if (convs.some((c) => c.peerId === peerId)) return
    let alive = true
    userApi.profile(peerId)
      .then((d) => {
        if (alive && d?.user) {
          setFreshPeer({ peerId, peerNickname: d.user.userNickname || '用户', peerAvatar: d.user.avatar, peerTitles: d.user.titles, peerSuperManager: d.user.userRole === 'superManager' })
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [peerId, convs])

  // 移动端软键盘：追踪「可视视口」(visualViewport)。进聊天窗后把它做成贴着可视区的全屏固定层，
  // 键盘弹出时可视区收缩、层随之收缩，输入框顶在键盘上方，整页不滚动、顶部会话头不跑（iOS 尤其需要）。
  const [vp, setVp] = useState({ h: null, top: 0 })
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setVp({ h: vv.height, top: vv.offsetTop })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])

  const markRead = useCallback((pid) => {
    pmApi.markRead(pid)
      .then(() => window.dispatchEvent(new Event('pm-unread-changed')))
      .catch(() => {})
    setConvs((cs) => cs?.map((c) => (c.peerId === pid ? { ...c, unread: 0 } : c)))
  }, [])

  // 切会话：拉第一页历史（倒序→反转），标已读，滚到底
  useEffect(() => {
    if (!peerId) { setMsgs(null); return }
    let alive = true
    setMsgs(null)
    setPage(1)
    setHasMore(false)
    pmApi.history(peerId, 1, PAGE)
      .then((r) => {
        if (!alive) return
        const rows = (r.records || []).slice().reverse()
        setMsgs(rows)
        setHasMore((r.records || []).length === PAGE)
        markRead(peerId)
        scrollBottom(true)
      })
      .catch(() => { if (alive) setMsgs([]) })
    return () => { alive = false }
  }, [peerId, markRead, scrollBottom])

  // WS 事件：新消息进当前会话就追加（并即时标已读），否则只刷新左栏；撤回就地改气泡
  useEffect(() => {
    const onEvent = (e) => {
      const { type, data } = e.detail || {}
      if (type === 'message' && data) {
        const otherId = data.senderId === user.userId ? data.receiverId : data.senderId
        if (otherId === peerIdRef.current) {
          setMsgs((m) => (m && !m.some((x) => x.pmId === data.pmId) ? [...m, data] : m))
          if (data.senderId === peerIdRef.current) markRead(peerIdRef.current)
          scrollBottom()
        }
        loadConvs()
      } else if (type === 'recall' && data) {
        setMsgs((m) => m?.map((x) => (x.pmId === data.pmId ? { ...x, recalled: '1', content: '' } : x)))
        loadConvs()
      }
    }
    window.addEventListener('pm-event', onEvent)
    return () => window.removeEventListener('pm-event', onEvent)
  }, [user.userId, loadConvs, markRead, scrollBottom])

  const openConv = (pid) => {
    setPeerId(pid)
    setSearchParams(pid ? { peerId: pid } : {}, { replace: true })
  }

  // 发起私信：搜全站用户（按昵称，去掉自己），选中即打开会话（没聊过也能开）
  const composeSearch = (kw) => {
    if (composeTimer.current) clearTimeout(composeTimer.current)
    const q = kw.trim()
    if (!q) { setComposeOpts([]); return }
    setComposeLoading(true)
    composeTimer.current = setTimeout(() => {
      searchApi.mentionUsers(q)
        .then((list) => setComposeOpts((list || []).filter((u) => u.userId !== user.userId)))
        .catch(() => setComposeOpts([]))
        .finally(() => setComposeLoading(false))
    }, 300)
  }

  const pickCompose = (uid) => {
    setComposeOpen(false)
    setComposeOpts([])
    if (uid) openConv(uid)
  }

  const send = async () => {
    const t = text.trim()
    if ((!t && !attachments.length) || !peerId || sending) return
    setSending(true)
    try {
      const msg = await pmApi.send(peerId, t, attachments.length ? JSON.stringify(attachments) : undefined)
      setText('')
      setAttachments([])
      setMsgs((m) => (m && !m.some((x) => x.pmId === msg.pmId) ? [...m, msg] : (m || [msg])))
      loadConvs()
      scrollBottom(true)
    } catch {
      // 失败提示已由 http 拦截器弹出
    } finally {
      setSending(false)
    }
  }

  // 附件上传：走 antd Upload 的 customRequest，成功后进 attachments 待发送队列
  const doUpload = async ({ file, onSuccess, onError }) => {
    if (attachments.length >= MAX_ATTACH) { message.warning(`最多 ${MAX_ATTACH} 个附件`); onError?.(new Error('max')); return }
    setUploading(true)
    try {
      const url = await pmApi.uploadFile(file)
      if (url) {
        const isImage = (file.type || '').startsWith('image/')
        setAttachments((a) => [...a, { type: isImage ? 'image' : 'file', url, name: file.name, size: file.size }])
        onSuccess?.()
      } else {
        onError?.(new Error('上传失败'))
      }
    } catch (err) {
      onError?.(err) // 具体错误已由 http 拦截器弹出
    } finally {
      setUploading(false)
    }
  }

  const removeAttach = (i) => setAttachments((a) => a.filter((_, idx) => idx !== i))

  // 在光标处插入 emoji（拿底层 textarea 选区拼接再恢复光标）
  const insertEmoji = (emoji) => {
    const ta = inputWrapRef.current?.querySelector('textarea')
    if (!ta) { setText((t) => t + emoji); return }
    const s = ta.selectionStart ?? text.length
    const e = ta.selectionEnd ?? text.length
    setText(text.slice(0, s) + emoji + text.slice(e))
    requestAnimationFrame(() => { ta.focus(); const p = s + emoji.length; ta.setSelectionRange(p, p) })
  }

  const loadOlder = async () => {
    if (loadingOlder) return
    setLoadingOlder(true)
    try {
      const next = page + 1
      const r = await pmApi.history(peerId, next, PAGE)
      const older = (r.records || []).slice().reverse()
      const el = scrollRef.current
      const prevH = el?.scrollHeight
      setMsgs((m) => {
        const seen = new Set((m || []).map((x) => x.pmId))
        return [...older.filter((o) => !seen.has(o.pmId)), ...(m || [])]
      })
      setPage(next)
      setHasMore((r.records || []).length === PAGE)
      // 维持视觉位置：把新增高度补回滚动条
      requestAnimationFrame(() => {
        if (el && prevH != null) el.scrollTop += el.scrollHeight - prevH
      })
    } finally {
      setLoadingOlder(false)
    }
  }

  const recall = async (pmId) => {
    try {
      await pmApi.recall(pmId)
      setMsgs((m) => m?.map((x) => (x.pmId === pmId ? { ...x, recalled: '1', content: '' } : x)))
      loadConvs()
    } catch {
      // 已由拦截器提示（如超时不可撤回）
    }
  }

  const deleteConv = async (pid) => {
    await pmApi.deleteConversation(pid)
    setConvs((cs) => cs?.filter((c) => c.peerId !== pid))
    window.dispatchEvent(new Event('pm-unread-changed'))
    if (peerId === pid) openConv(null)
  }

  // ===== 渲染 =====

  const convRow = (c) => {
    const active = c.peerId === peerId
    const unread = c.unread > 0
    const preview = c.lastRecalled
      ? '[消息已撤回]'
      : `${c.lastFromMe ? '我: ' : ''}${c.lastContent || '[图片/附件]'}`
    return (
      <div
        key={c.peerId}
        className="pm-conv"
        onClick={() => openConv(c.peerId)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', margin: '2px 8px',
          borderRadius: 12, cursor: 'pointer', transition: 'background .15s',
          background: active ? 'linear-gradient(135deg, rgba(250,84,28,.13), rgba(250,84,28,.05))' : 'transparent',
        }}
      >
        <Badge count={c.unread} size="small" offset={[-3, 4]}>
          <UserAvatar name={c.peerNickname} src={c.peerAvatar} size={44} online={!!onlineMap[c.peerId]} />
        </Badge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: unread ? 700 : 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#222' }}>
              {c.peerNickname || '用户'}
            </span>
            <span style={{ fontSize: 11, color: unread ? BRAND : '#bbb', flexShrink: 0, fontWeight: unread ? 600 : 400 }}>{convTime(c.lastTime)}</span>
          </div>
          <div style={{ fontSize: 12.5, color: c.lastRecalled ? '#c0c0c0' : unread ? '#666' : '#999', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: c.lastRecalled ? 'italic' : 'normal' }}>
            {preview}
          </div>
        </div>
        <Popconfirm
          title="删除会话？"
          description="只在你这边消失，不影响对方"
          onConfirm={(e) => { e?.stopPropagation?.(); deleteConv(c.peerId) }}
          onCancel={(e) => e?.stopPropagation?.()}
          okText="删除"
          cancelText="取消"
        >
          <DeleteOutlined
            className="pm-conv-del"
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#bbb', fontSize: 14, opacity: 0, transition: 'opacity .15s', flexShrink: 0 }}
          />
        </Popconfirm>
      </div>
    )
  }

  const bubbles = useMemo(() => {
    if (!msgs) return null
    const AV = 32
    const GAP = 8
    const out = []
    msgs.forEach((m, idx) => {
      const t = dayjs(m.sendTime)
      const prev = idx > 0 ? dayjs(msgs[idx - 1].sendTime) : null
      // 按天分割
      if (!prev || !t.isSame(prev, 'day')) {
        out.push(
          <div key={`d-${m.pmId}`} style={{ textAlign: 'center', margin: '16px 0 8px' }}>
            <span style={{ fontSize: 11, color: '#98a2b3', background: 'rgba(0,0,0,.05)', padding: '3px 12px', borderRadius: 999 }}>
              {dayLabel(t)}
            </span>
          </div>,
        )
      }
      const mine = m.senderId === user.userId

      // 撤回：居中提示
      if (m.recalled === '1') {
        out.push(
          <div key={m.pmId} style={{ textAlign: 'center', fontSize: 12, color: '#b5b8bd', margin: '10px 0' }}>
            {mine ? '你' : '对方'}撤回了一条消息
          </div>,
        )
        return
      }

      const canRecall = mine && dayjs().diff(t, 'second') < 120
      out.push(
        <div
          key={m.pmId}
          className="pm-msg"
          style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', margin: '10px 0' }}
        >
          <div style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: GAP, maxWidth: '82%' }}>
            <UserAvatar
              name={mine ? user.userNickname : activePeer?.peerNickname}
              src={mine ? user.avatar : activePeer?.peerAvatar}
              size={AV}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: mine ? 'flex-end' : 'flex-start', minWidth: 0 }}>
              {m.content ? (
                <div
                  style={{
                    padding: '10px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: mine ? 'linear-gradient(135deg, #ff8a5c 0%, #fa541c 100%)' : '#fff',
                    color: mine ? '#fff' : '#333',
                    border: mine ? 'none' : '1px solid #eef0f2',
                    borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    boxShadow: mine ? '0 2px 10px rgba(250,84,28,.22)' : '0 1px 4px rgba(0,0,0,.05)',
                  }}
                >
                  {m.content}
                </div>
              ) : null}
              <MessageAttachments attachmentsJson={m.attachments} mine={mine} />
            </div>
            {mine && canRecall && (
              <a className="pm-recall" style={{ fontSize: 11, color: '#bbb', opacity: 0, transition: 'opacity .15s', flexShrink: 0, alignSelf: 'center' }} onClick={() => recall(m.pmId)}>
                撤回
              </a>
            )}
          </div>
          {/* 每条消息各自的时间，压在气泡下方、对齐气泡一侧（偏移一个头像宽） */}
          <div style={{ fontSize: 11, color: '#b5b8bd', marginTop: 3, [mine ? 'marginRight' : 'marginLeft']: AV + GAP }}>
            {t.format('HH:mm')}
          </div>
        </div>,
      )
    })
    return out
  }, [msgs, user.userId, user.userNickname, user.avatar, activePeer])

  return (
    <Card
      // 移动端：负边距收掉外层大部分留白、贴近屏幕边；高度走下面 .pm-body 的媒体查询（dvh）
      style={{ borderRadius: isMobile ? 12 : 16, overflow: 'hidden', margin: isMobile ? '-4px -6px 0' : 0 }}
      classNames={{ body: 'pm-body' }}
      styles={{ body: { padding: 0, height: 'max(480px, calc(100vh - 140px))', display: 'flex' } }}
    >
      <style>{`
        .pm-conv:hover { background: #f5f6f8 !important; }
        .pm-conv:hover .pm-conv-del { opacity: 1; }
        .pm-msg:hover .pm-recall { opacity: 1; }
        .pm-scroll::-webkit-scrollbar { width: 6px; }
        .pm-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 3px; }
        /* 移动端用 dvh(动态视口高度,排除浏览器地址栏/工具栏)让卡片正好填满可视区,输入框不被顶出屏幕、无右侧滚动;不支持 dvh 的退回 vh */
        @media (max-width: 767px) {
          .pm-body { height: calc(100vh - 80px) !important; height: calc(100dvh - 80px) !important; }
        }
      `}</style>

      {/* 左栏：会话列表（移动端全宽；选中会话后隐藏，切到聊天窗） */}
      <div style={{
        width: isMobile ? '100%' : 304,
        borderRight: isMobile ? 'none' : '1px solid #f0f0f0',
        display: isMobile && peerId ? 'none' : 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: isMobile ? '12px 14px 10px' : '16px 18px 12px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>私信</div>
            {convs?.length ? <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{convs.length} 个会话</div> : null}
          </div>
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => setComposeOpen(true)}>发起</Button>
        </div>
        <div className="pm-scroll" style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
          {convs === null ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : convs.length ? (
            convs.map(convRow)
          ) : (
            <div style={{ textAlign: 'center', color: '#bbb', marginTop: 70, padding: '0 20px' }}>
              <div style={{ fontSize: 40 }}>💬</div>
              <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.7 }}>还没有会话<br />点右上角「发起」搜用户开聊</div>
            </div>
          )}
        </div>
      </div>

      {/* 右栏：聊天窗（移动端未选会话时隐藏，只显示列表） */}
      <div
        style={{
          flex: 1, display: isMobile && !peerId ? 'none' : 'flex', flexDirection: 'column', minWidth: 0,
          background: [
            'radial-gradient(circle at 16% 14%, rgba(250,84,28,.08), transparent 40%)',
            'radial-gradient(circle at 86% 86%, rgba(47,84,235,.06), transparent 42%)',
            'radial-gradient(rgba(20,30,50,.045) 1px, transparent 1px)',
            'linear-gradient(180deg, #fbfbfc 0%, #f1f2f5 100%)',
          ].join(','),
          backgroundSize: '100% 100%, 100% 100%, 22px 22px, 100% 100%',
          // 移动端进聊天窗：固定成贴合可视视口的全屏层，随软键盘收缩，整页不滚动、会话头不跑
          ...(isMobile && peerId && vp.h != null
            ? { position: 'fixed', left: 0, top: vp.top, width: '100%', height: vp.h, zIndex: 1000 }
            : {}),
        }}
      >
        {!peerId ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 52 }}>✉️</div>
            <div style={{ fontSize: 14, marginTop: 12 }}>选择左侧会话开始聊天</div>
          </div>
        ) : (
          <>
            {/* 会话头 */}
            <div style={{ padding: '13px 16px', background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 11, boxShadow: '0 1px 4px rgba(0,0,0,.03)', zIndex: 1 }}>
              {isMobile && (
                <ArrowLeftOutlined onClick={() => openConv(null)} style={{ fontSize: 18, color: '#555', cursor: 'pointer', flexShrink: 0 }} />
              )}
              <UserAvatar name={activePeer?.peerNickname} src={activePeer?.peerAvatar} size={38} online={!!onlineMap[peerId]} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <Link to={`/users/${peerId}`} style={{ fontWeight: 700, fontSize: 15, color: '#222' }}>
                    {activePeer?.peerNickname || '用户'}
                  </Link>
                  {activePeer?.peerSuperManager && <SuperAdminBadge />}
                  <UserTitles titles={activePeer?.peerTitles} size="sm" />
                </div>
                <div style={{ fontSize: 11, color: onlineMap[peerId] ? '#52c41a' : '#aaa', marginTop: 1 }}>
                  {onlineMap[peerId] ? '在线' : '离线'}
                </div>
              </div>
              <Link to={`/users/${peerId}`} style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>
                查看主页 <RightOutlined style={{ fontSize: 9 }} />
              </Link>
            </div>

            {/* 消息流 */}
            <div ref={scrollRef} className="pm-scroll" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '10px 22px' }}>
              {msgs === null ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              ) : (
                <>
                  {hasMore && (
                    <div style={{ textAlign: 'center', margin: '6px 0 2px' }}>
                      <Button size="small" type="text" loading={loadingOlder} onClick={loadOlder} style={{ color: '#999', fontSize: 12 }}>
                        加载更早的消息
                      </Button>
                    </div>
                  )}
                  {msgs.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 80 }}>
                      还没有消息，打个招呼吧 👋
                    </div>
                  )}
                  {bubbles}
                </>
              )}
            </div>

            {/* 输入区 */}
            <div style={{ background: '#fff', borderTop: '1px solid #f0f0f0', padding: '10px 16px 14px' }}>
              {/* 待发送附件预览：图片缩略 / 文件卡，各带右上角移除 */}
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {attachments.map((att, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      {att.type === 'image' ? (
                        <Image src={att.url} width={60} height={60} preview={false} style={{ objectFit: 'cover', borderRadius: 8 }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: '#f5f5f5', borderRadius: 8, maxWidth: 180, height: 60, boxSizing: 'border-box' }}>
                          <FileOutlined style={{ color: '#fa541c', fontSize: 16 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>{humanSize(att.size)}</div>
                          </div>
                        </div>
                      )}
                      <CloseCircleFilled
                        onClick={() => removeAttach(i)}
                        style={{ position: 'absolute', top: -6, right: -6, color: '#8c8c8c', background: '#fff', borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}
                      />
                    </div>
                  ))}
                  {uploading && <span style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>上传中…</span>}
                </div>
              )}
              <div ref={inputWrapRef} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6 }}>
                  <EmojiPicker onPick={insertEmoji} />
                  <Upload accept="image/*" multiple showUploadList={false} customRequest={doUpload}>
                    <Tooltip title="图片"><PictureOutlined style={{ fontSize: 18, color: '#8c8c8c', cursor: 'pointer' }} /></Tooltip>
                  </Upload>
                  <Upload accept={FILE_ACCEPT} multiple showUploadList={false} customRequest={doUpload}>
                    <Tooltip title="文件"><FileOutlined style={{ fontSize: 18, color: '#8c8c8c', cursor: 'pointer' }} /></Tooltip>
                  </Upload>
                </div>
                <Input.TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="发消息…"
                  maxLength={500}
                  autoSize={{ minRows: 1, maxRows: 5 }}
                  variant="filled"
                  style={{ borderRadius: 12 }}
                />
                <Button
                  type="primary"
                  shape="circle"
                  icon={<SendOutlined />}
                  loading={sending}
                  disabled={!text.trim() && !attachments.length}
                  onClick={send}
                  style={{ flexShrink: 0, width: 40, height: 40, boxShadow: (text.trim() || attachments.length) ? '0 4px 12px rgba(250,84,28,.3)' : 'none' }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 发起私信：搜全站用户，选中即开会话 */}
      <Modal
        open={composeOpen}
        title="发起私信"
        footer={null}
        onCancel={() => { setComposeOpen(false); setComposeOpts([]) }}
        destroyOnClose
      >
        <Select
          showSearch
          autoFocus
          placeholder="搜索用户昵称…"
          style={{ width: '100%' }}
          size="large"
          value={null}
          filterOption={false}
          onSearch={composeSearch}
          onChange={pickCompose}
          notFoundContent={composeLoading ? <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div> : null}
          options={composeOpts.map((u) => ({
            value: u.userId,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <UserAvatar name={u.userNickname} src={u.avatar} size={22} />
                {u.userNickname}
              </span>
            ),
          }))}
        />
        <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>选中用户即可开始聊天，没聊过也能直接发。</div>
      </Modal>
    </Card>
  )
}
