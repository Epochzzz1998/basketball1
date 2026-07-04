import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Input, Popconfirm, Spin } from 'antd'
import { DeleteOutlined, RightOutlined, SendOutlined } from '@ant-design/icons'
import { Link, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { pmApi } from '../../api/pm'
import { userApi } from '../../api/user'
import { useAuth } from '../../auth/AuthContext'
import EmojiPicker from '../../components/EmojiPicker'

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

export default function Messages() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [convs, setConvs] = useState(null)
  const [peerId, setPeerId] = useState(searchParams.get('peerId') || null)
  const [freshPeer, setFreshPeer] = useState(null) // 没聊过的深链对象 {peerId, peerNickname, peerAvatar}
  const [msgs, setMsgs] = useState(null) // 当前会话消息（正序）
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [onlineMap, setOnlineMap] = useState({}) // { userId: 是否在线 }

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
          setFreshPeer({ peerId, peerNickname: d.user.userNickname || '用户', peerAvatar: d.user.avatar })
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [peerId, convs])

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

  const send = async () => {
    const t = text.trim()
    if (!t || !peerId || sending) return
    setSending(true)
    try {
      const msg = await pmApi.send(peerId, t)
      setText('')
      setMsgs((m) => (m && !m.some((x) => x.pmId === msg.pmId) ? [...m, msg] : (m || [msg])))
      loadConvs()
      scrollBottom(true)
    } catch {
      // 失败提示已由 http 拦截器弹出
    } finally {
      setSending(false)
    }
  }

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
      : `${c.lastFromMe ? '我: ' : ''}${c.lastContent || ''}`
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
      style={{ borderRadius: 16, overflow: 'hidden' }}
      styles={{ body: { padding: 0, height: 'max(480px, calc(100vh - 140px))', display: 'flex' } }}
    >
      <style>{`
        .pm-conv:hover { background: #f5f6f8 !important; }
        .pm-conv:hover .pm-conv-del { opacity: 1; }
        .pm-msg:hover .pm-recall { opacity: 1; }
        .pm-scroll::-webkit-scrollbar { width: 6px; }
        .pm-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 3px; }
      `}</style>

      {/* 左栏：会话列表 */}
      <div style={{ width: 304, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f5f5f5' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>私信</div>
          {convs?.length ? <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{convs.length} 个会话</div> : null}
        </div>
        <div className="pm-scroll" style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
          {convs === null ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : convs.length ? (
            convs.map(convRow)
          ) : (
            <div style={{ textAlign: 'center', color: '#bbb', marginTop: 70, padding: '0 20px' }}>
              <div style={{ fontSize: 40 }}>💬</div>
              <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.7 }}>还没有会话<br />去用户主页点「发私信」开聊</div>
            </div>
          )}
        </div>
      </div>

      {/* 右栏：聊天窗（背景墙：品牌橙/蓝柔光斑 + 细点阵 + 渐变底，铺在容器上不随滚动） */}
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
          background: [
            'radial-gradient(circle at 16% 14%, rgba(250,84,28,.08), transparent 40%)',
            'radial-gradient(circle at 86% 86%, rgba(47,84,235,.06), transparent 42%)',
            'radial-gradient(rgba(20,30,50,.045) 1px, transparent 1px)',
            'linear-gradient(180deg, #fbfbfc 0%, #f1f2f5 100%)',
          ].join(','),
          backgroundSize: '100% 100%, 100% 100%, 22px 22px, 100% 100%',
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
            <div style={{ padding: '13px 20px', background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 11, boxShadow: '0 1px 4px rgba(0,0,0,.03)', zIndex: 1 }}>
              <UserAvatar name={activePeer?.peerNickname} src={activePeer?.peerAvatar} size={38} online={!!onlineMap[peerId]} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/users/${peerId}`} style={{ fontWeight: 700, fontSize: 15, color: '#222' }}>
                  {activePeer?.peerNickname || '用户'}
                </Link>
                <div style={{ fontSize: 11, color: onlineMap[peerId] ? '#52c41a' : '#aaa', marginTop: 1 }}>
                  {onlineMap[peerId] ? '在线' : '离线'}
                </div>
              </div>
              <Link to={`/users/${peerId}`} style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>
                查看主页 <RightOutlined style={{ fontSize: 9 }} />
              </Link>
            </div>

            {/* 消息流 */}
            <div ref={scrollRef} className="pm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 22px' }}>
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
              <div ref={inputWrapRef} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ paddingBottom: 6 }}>
                  <EmojiPicker onPick={insertEmoji} />
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
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行"
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
                  disabled={!text.trim()}
                  onClick={send}
                  style={{ flexShrink: 0, width: 40, height: 40, boxShadow: text.trim() ? '0 4px 12px rgba(250,84,28,.3)' : 'none' }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
