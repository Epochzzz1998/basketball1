import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, Card, DatePicker, Empty, Input, Popconfirm, Spin, Upload, message as toast } from 'antd'
import { CalendarOutlined, ClearOutlined, DownloadOutlined, LoadingOutlined, MessageOutlined, PaperClipOutlined, PictureOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { chatApi } from '../../api/chat'
import { newsApi } from '../../api/news'
import { topicApi } from '../../api/topic'
import { subscribeRoom } from '../../realtime/pmSocket'
import { useAuth } from '../../auth/AuthContext'
import EmojiPicker from '../../components/EmojiPicker'
import useIsMobile from '../../hooks/useIsMobile'
import { compressImage } from '../../utils/image'
import ChatPurgeModal from '../../components/ChatPurgeModal'
import ChatExportModal from '../../components/ChatExportModal'

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
  const isMobile = useIsMobile()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [more, setMore] = useState(false)
  const [atOpts, setAtOpts] = useState(null)
  const [atIndex, setAtIndex] = useState(0)   // @ 候选里高亮的那一项（键盘上下键移动）
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)   // 小日历的显隐（触发器是旁边那个链接）
  const [days, setDays] = useState(null)      // 有聊天记录的日期集合（小日历标深色）
  const [jumped, setJumped] = useState(false) // 是否处于"跳到某天"的状态（决定要不要出"加载更新的"）
  const taRef = useRef(null)
  const endRef = useRef(null)
  const cardRef = useRef(null)
  const listRef = useRef(null)
  const [height, setHeight] = useState(null) // 聊天卡的高度：撑到屏幕底部
  const [kbInset, setKbInset] = useState(0)  // 软键盘吃掉的那一截高度（移动端），输入区靠它抬起来

  /**
   * 是否"黏"在底部。真值时新消息进来自动滚到底；用户手动往上翻（或跳到某天）就置假，
   * 免得正在看历史时被新消息一把拽走。滚回底部附近会自动恢复。
   */
  const stickRef = useRef(true)

  const onListScroll = () => {
    const el = listRef.current
    if (!el || isMobile) return // 移动端滚的是整页，见下面那个 window 监听
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  // 移动端：整页滚动，黏底判定看窗口
  useEffect(() => {
    if (!isMobile) return undefined
    const onWin = () => {
      const doc = document.documentElement
      stickRef.current = doc.scrollHeight - window.scrollY - window.innerHeight < 120
    }
    window.addEventListener('scroll', onWin, { passive: true })
    return () => window.removeEventListener('scroll', onWin)
  }, [isMobile])

  /**
   * 滚到底必须在 **DOM 提交之后**做，所以用 useLayoutEffect 而不是在事件回调里 rAF。
   *
   * 之前的写法是收到消息后调一个 rAF 去滚——但 setState 是异步的，rAF 很可能比 React
   * 那次重渲染先跑，量到的是**旧 DOM 的高度**，于是滚到"上一条的底部"，新消息一渲染又被顶下去，
   * 表现就是"永远差一条、根本不动"。首屏也一样：历史拉回来时卡片高度还没量出来、
   * 容器还没溢出，scrollTop 设了等于没设。
   *
   * 依赖里带上 height，就是为了让"高度量出来"这一次也重新滚一遍。
   */
  /**
   * 滚到最新那条。移动端滚的是整页（滚到底就行——底下垫了键盘那么高的空白，
   * 滚到底之后最后一条正好落在输入框上方）；PC 端滚的是消息区自己。
   */
  const toBottom = () => {
    if (isMobile) { window.scrollTo(0, document.documentElement.scrollHeight); return }
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  useLayoutEffect(() => {
    if (!rows || !stickRef.current) return
    toBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, height, kbInset, isMobile])

  /** 图片是异步加载的，加载完内容会变高，黏底状态下要再滚一次 */
  const onMediaLoad = () => {
    if (stickRef.current) toBottom()
  }

  /**
   * 卡片高度**只在 PC 上量**：视口高 - 卡片距顶 - 底部留白，撑满一屏。
   *
   * 移动端一律不定高。之前两版都想让卡片贴着可视视口，结果在 iOS 上一直打架——
   * 软键盘弹出时 iOS 不缩布局视口，只把页面整体往上推，而推多少、什么时候推
   * 是浏览器自己决定的，我这边量到的 `getBoundingClientRect()` 和 `visualViewport`
   * 永远慢半拍，表现就是卡片被压成一小条、下面露出一大片灰底。
   *
   * 现在移动端就是一张普通长页面：消息按内容铺开、页面整体滚动、输入区 sticky 贴底。
   * 键盘弹出时浏览器自己会把输入框滚进可视区——这是浏览器的本职工作，不该由我复刻。
   */
  useEffect(() => {
    if (isMobile) { setHeight(null); return undefined }
    const fit = () => {
      const el = cardRef.current
      if (!el) return
      setHeight(Math.max(360, window.innerHeight - el.getBoundingClientRect().top - 20))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [loading, isMobile])

  /**
   * 量软键盘占掉多高，输入区靠它抬起来。
   *
   * 输入区是 `position: sticky; bottom: 0`，而 sticky 的 bottom 量的是**布局视口**的底边。
   * iOS 弹键盘时布局视口一点没变矮，只是可视视口被压短了——那条"底边"于是落在键盘背面。
   * 结果就是：页面停在最底时还能看见输入框（那是它的自然位置），一往上翻 sticky 生效，
   * 输入框就沉到键盘后面去了。
   *
   * 所以把这条线抬高键盘那一截：
   *   innerHeight（布局视口高）- visualViewport.height - visualViewport.offsetTop
   * 键盘收起时算出来是 0，sticky 退回 bottom:0，和没这段代码时一模一样。
   *
   * 两个刻意的选择：
   * - **量 visualViewport 报的数，不猜键盘高度**，所以换输入法、带候选栏、转屏都跟得上；
   * - **用 sticky 不用 fixed**：iOS 上 fixed 元素在可视视口滚动期间会自己漂移，
   *   sticky 挂在文档滚动上，稳。
   *
   * 小于 80px 的差值当成浏览器地址栏伸缩，不算键盘（键盘再矮也有两百多）。
   */
  useEffect(() => {
    const vv = window.visualViewport
    if (!isMobile || !vv) { setKbInset(0); return undefined }
    let raf = 0
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const gap = Math.round(window.innerHeight - vv.height - vv.offsetTop)
        const next = gap > 80 ? gap : 0
        // 差几个像素就不重渲染了，页面滚动时 visualViewport 也会一直报 scroll
        setKbInset((prev) => (Math.abs(prev - next) < 4 ? prev : next))
      })
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [isMobile])

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
        stickRef.current = true // 进来就该停在最新那条
      })
      .catch(() => { if (alive) setRows([]) })
    chatApi.markRead(topicId).catch(() => {})
    return () => {
      alive = false
      // 离开时再打一次卡：这段时间里进来的消息是当面看过的，不该算未读
      chatApi.markRead(topicId).catch(() => {})
    }
  }, [topic?.canChat, topicId])

  // 哪几天有记录：小日历要拿它标深色。能进群聊的人都能查
  useEffect(() => {
    if (!topic?.canChat) return
    chatApi.days(topicId).then((r) => setDays(new Set(Array.isArray(r) ? r : []))).catch(() => setDays(new Set()))
  }, [topic?.canChat, topicId])

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
      // 滚动交给上面那个 useLayoutEffect，这里只管把数据塞进去
    })
  }, [topic?.canChat, topicId])

  const loadEarlier = async () => {
    if (!rows?.length) return
    try {
      const r = await chatApi.history(topicId, rows[0].sendTime)
      const list = Array.isArray(r) ? r : []
      setMore(list.length >= 30)
      if (list.length) {
        const el = listRef.current
        stickRef.current = false // 正在往回看，别被新消息拽走
        const keep = el ? el.scrollHeight - el.scrollTop : 0
        setRows((prev) => [...list, ...(prev || [])])
        // 往顶部插会把当前内容顶下去，按插入前的距离补回来，视觉上停在原处
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - keep })
      }
    } catch { /* 拦截器已提示 */ }
  }

  /** 跳到某一天的第一条。找不到当天记录时，接口给的是这一天**之后**最近的一批，不会空手而归 */
  const jumpToDay = async (d) => {
    if (!d) return
    try {
      const r = await chatApi.jumpTo(topicId, d.format('YYYY-MM-DD'))
      const list = Array.isArray(r) ? r : []
      setRows(list)
      setMore(list.length > 0)   // 跳过去之后上面一定还有更早的
      setJumped(true)
      stickRef.current = false
      requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = 0 })
      if (!list.length) toast.info('这一天及之后都没有记录')
    } catch { /* 拦截器已提示 */ }
  }

  /** 往后翻一页（只有跳转之后才需要——正常进来就是停在最新那条） */
  const loadNewer = async () => {
    if (!rows?.length) return
    try {
      const r = await chatApi.newer(topicId, rows[rows.length - 1].sendTime)
      const list = Array.isArray(r) ? r : []
      if (!list.length) { setJumped(false); return } // 追平最新了，回到普通模式
      setRows((prev) => [...(prev || []), ...list])
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
        // 手机拍的照片动辄三四 MB，上传前先缩到长边 1600（非图片原样返回）
        const packed = asImage ? await compressImage(file) : file
        const url = await newsApi.uploadCommentFile(packed, topicId)
        if (url) await send(asImage ? { imageUrl: url } : { fileUrl: url, fileName: file.name })
      } catch {
        toast.error(asImage ? '图片上传失败' : '附件上传失败')
      } finally {
        setUploading(false)
      }
    })()
    return false
  }

  /**
   * 直接粘贴图片：截图之后 Cmd+V 就能发，不用先存成文件再点上传。
   * 剪贴板里同时有图片和文字时（比如从网页复制一块内容）优先按图片走，
   * 并且要 preventDefault，否则文件名之类的文本会被一起粘进输入框。
   */
  const onPaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const item = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (!item) return
    const file = item.getAsFile()
    if (!file) return
    e.preventDefault()
    makeUpload(true)(file)
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
      // 只在**这个专题里、且能进群聊**的人里找：@ 一个根本进不来的人，
      // 他既收不到也看不见，纯属误导
      const list = await chatApi.mentionCandidates(topicId, v.slice(at + 1))
      setAtOpts((list || []).slice(0, 6))
      setAtIndex(0)
    } catch {
      setAtOpts(null)
    }
  }
  /**
   * 输入框的按键统一在这里分派。**不能用 antd 的 onPressEnter**——候选面板开着的时候
   * 回车该是"选中这一项"，关着的时候才是"发送"，两个语义共用一个键，必须自己判断先后。
   */
  const onKeyDown = (e) => {
    if (atOpts?.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAtIndex((i) => (i + 1) % atOpts.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAtIndex((i) => (i - 1 + atOpts.length) % atOpts.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickAt(atOpts[atIndex] || atOpts[0]); return }
      if (e.key === 'Escape') { e.preventDefault(); setAtOpts(null); return }
    }
    // 回车发送，Shift+回车换行（和大多数聊天框一致）
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
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
      extra={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
          {/* 按日期查找：所有能进群聊的人都能用，不只是题主，所以排在管理动作前面。
              做成和旁边一样的「图标 + 文字」链接——原来那个带输入框的日期选择器夹在
              两个按钮中间，是这一行里唯一一个有边框的控件，扎眼 */}
          <a onClick={() => setDateOpen(true)} style={{ color: '#666' }}>
            <CalendarOutlined /> 按日期
          </a>
          {/* 真正的日历藏在这里：DatePicker 没法换掉自己的输入框，所以把它缩成零尺寸
              当锚点用，弹层照样挂在这个位置 */}
          <DatePicker
            open={dateOpen}
            onOpenChange={setDateOpen}
            value={null}
            allowClear={false}
            onChange={(d) => { setDateOpen(false); jumpToDay(d) }}
            disabledDate={(d) => d && d > dayjs().endOf('day')}
            style={{ width: 0, height: 0, padding: 0, margin: 0, border: 'none', visibility: 'hidden' }}
            cellRender={(current, info) => {
              if (info.type !== 'date') return info.originNode
              const has = days?.has(current.format('YYYY-MM-DD'))
              return (
                <div className="ant-picker-cell-inner" style={has
                  ? { background: '#fff1e6', color: '#d4380d', fontWeight: 700, borderRadius: 4 }
                  : undefined}
                >
                  {current.date()}
                </div>
              )
            }}
          />
          {/* 备份和清理只给管理者，两个挨在一起 */}
          {topic?.canManage && (
            <a onClick={() => setExportOpen(true)} style={{ color: '#666' }}>
              <DownloadOutlined /> 导出备份
            </a>
          )}
          {topic?.canManage && (
            <a onClick={() => setPurgeOpen(true)} style={{ color: '#666' }}>
              <ClearOutlined /> 清理记录
            </a>
          )}
          <a onClick={() => navigate(`/news/topic/${topicId}`)}>回专题</a>
        </span>
      )}
    >
      {/* 消息区：卡片高度定死之后，滚动就发生在这里面。
          消息从上往下排（最早的顶在最上面），空的部分留在下面 */}
      <div
        ref={listRef}
        onScroll={onListScroll}
        style={isMobile
          // 移动端：跟着整页滚。底下额外垫出键盘那么高的空白——输入区被抬起来之后
          // 会盖住它上面的 kbInset 像素，不垫的话最后一条消息就被压在输入框底下了
          ? { padding: `16px 16px ${8 + kbInset}px` }
          : { flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 8px' }}
      >
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
                          onLoad={onMediaLoad}
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
        {jumped && rows?.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <a onClick={loadNewer} style={{ fontSize: 12, color: '#999' }}>加载更新的消息</a>
          </div>
        )}
        <div ref={endRef} />
        </div>
      </div>

      {/* 输入区：PC 固定在卡片底部；移动端 sticky 贴在**可视**视口底（bottom 抬过键盘高度） */}
      <div style={{
        flexShrink: 0, background: '#fff', borderTop: '1px solid #f0f0f0',
        ...(isMobile ? { position: 'sticky', bottom: kbInset, zIndex: 2 } : null),
        padding: kbInset
          ? '8px 12px 10px'                                     // 键盘顶着的时候没有 home 条，不用留安全区
          : '8px 12px calc(10px + env(safe-area-inset-bottom))',
        borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
      }}>
        <div style={{ position: 'relative' }}>
          {atOpts?.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff',
              border: '1px solid #f0f0f0', borderRadius: 10, boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
              maxHeight: 280, overflowY: 'auto', zIndex: 5, marginBottom: 6, overflow: 'hidden',
            }}>
              {atOpts.map((u, i) => (
                <div
                  key={u.userId}
                  onMouseDown={(e) => { e.preventDefault(); pickAt(u) }}
                  onMouseEnter={() => setAtIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                    background: i === atIndex ? 'rgba(250,84,28,.08)' : 'transparent',
                  }}
                >
                  {u.avatar
                    ? <Avatar size={22} src={u.avatar} />
                    : <Avatar size={22} style={{ background: avatarColor(u.userNickname), fontSize: 12 }}>{String(u.userNickname || '?')[0].toUpperCase()}</Avatar>}
                  <span style={{ fontSize: 13 }}>{dn(u.userId, u.userNickname)}</span>
                  {/* 还没进过这个群、靠关注关系列出来的，标一下——不然会以为他人已经在群里了 */}
                  {u.viaFollow && (
                    <span style={{
                      fontSize: 11, color: '#bbb', border: '1px solid #f0f0f0',
                      borderRadius: 4, padding: '0 4px', lineHeight: '16px',
                    }}>
                      关注
                    </span>
                  )}
                </div>
              ))}
              <div style={{ padding: '5px 12px', borderTop: '1px solid #f5f5f5', fontSize: 11, color: '#bbb' }}>
                ↑↓ 选择 · Enter 确认 · Esc 取消
              </div>
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
              onKeyDown={onKeyDown}
              onPaste={onPaste}
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

      <ChatExportModal topicId={topicId} open={exportOpen} onClose={() => setExportOpen(false)} />

      <ChatPurgeModal
        topicId={topicId}
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        onDone={() => {
          // 清完把当前这屏重新拉一次，不然界面上还挂着已经删掉的消息
          chatApi.history(topicId).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => {})
        }}
      />
    </Card>
  )
}
