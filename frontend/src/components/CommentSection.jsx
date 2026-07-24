import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, Button, Empty, Image, Input, Pagination, Popconfirm, Space, Spin, message } from 'antd'
import { BarChartOutlined, DislikeOutlined, FileOutlined, LikeOutlined, LockOutlined, StarFilled, UserOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../api/news'
import { useAuth } from '../auth/AuthContext'
import CommentComposer, { humanSize } from './CommentComposer'
import RatingCard, { RatingImagePicker } from './RatingCard'
import PollCard from './PollCard'
import { SuperAdminBadge, TopicOwnerBadge, OpBadge } from './RoleBadges'
import UserTitles from './UserTitles'
import useIsMobile from '../hooks/useIsMobile'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

// 单楼回复的分页大小（超过则出分页器）
const REPLY_PAGE_SIZE = 10

// 无头像时按名字哈希出稳定彩底（与帖子列表同款规则）
const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

function UserAvatar({ name, src, size }) {
  return src ? (
    <Avatar size={size} src={src} style={{ flexShrink: 0 }} />
  ) : (
    <Avatar size={size} style={{ background: avatarColor(name), fontWeight: 700, flexShrink: 0 }}>
      {String(name || '匿')[0].toUpperCase()}
    </Avatar>
  )
}

// 把正文里"选中过的 @昵称"渲染成可点链接（跳该用户主页），其余保持纯文本。
// mentionsJson 是后端存的 [{id,name}]，后端读时会补 cur=@对象的当前昵称；
// 用旧 name（正文里就是它）按长度倒序匹配定位，避免 "@li" 抢 "@lisa" 前缀；显示时优先 cur（改名后 @ 显示新名）。
function renderContent(content, mentionsJson) {
  if (!content) return content
  let mentions = []
  try { mentions = JSON.parse(mentionsJson || '[]') } catch { mentions = [] }
  const sorted = mentions.filter((m) => m && m.name).sort((a, b) => b.name.length - a.name.length)
  if (!sorted.length) return content
  const nodes = []
  let i = 0
  let k = 0
  while (i < content.length) {
    let hit = null
    if (content[i] === '@') {
      for (const m of sorted) {
        if (content.startsWith('@' + m.name, i)) { hit = m; break }
      }
    }
    if (hit) {
      nodes.push(
        <Link
          key={k++}
          to={`/users/${hit.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#1677ff', fontWeight: 600 }}
        >
          @{hit.cur || hit.name}
        </Link>,
      )
      i += 1 + hit.name.length
    } else {
      let j = content.indexOf('@', i + 1)
      if (j === -1) j = content.length
      nodes.push(content.slice(i, j))
      i = j
    }
  }
  return nodes
}

// 评论附件渲染：图片走缩略图（点开大图预览），文件走下载卡。
// 只渲染 http(s)/相对路径的 url，挡掉 javascript: 之类（后端保存时已过滤，这里前端再兜一层）。
function CommentAttachments({ attachmentsJson }) {
  let atts = []
  try { atts = JSON.parse(attachmentsJson || '[]') } catch { atts = [] }
  atts = atts.filter((a) => a && typeof a.url === 'string' && /^(https?:\/\/|\/)/.test(a.url))
  if (!atts.length) return null
  const images = atts.filter((a) => a.type === 'image')
  const files = atts.filter((a) => a.type !== 'image')
  return (
    <div style={{ marginTop: 8 }}>
      {images.length > 0 && (
        <Image.PreviewGroup>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((a, i) => (
              <Image key={i} src={a.url} width={108} height={108} style={{ objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        </Image.PreviewGroup>
      )}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: images.length ? 8 : 0 }}>
          {files.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              download={a.name || true}
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, color: 'inherit', maxWidth: 280 }}
            >
              <FileOutlined style={{ color: '#fa541c', fontSize: 18 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || '文件'}</span>
              {a.size != null && <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>{humanSize(a.size)}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// 评论者一行 meta：昵称 + 超管/题主/楼主/头衔 +（楼层号）+ 时间
function MetaRow({ c, authorId, topicOwnerIds, showFloor }) {
  const navigate = useNavigate()
  const { dn } = useAuth() // 备注名替换（仅展示层；徽章判断仍用 userId）
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {c.userId
        ? <a onClick={() => navigate(`/users/${c.userId}`)} style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>{dn(c.userId, c.userName) || '匿名'}</a>
        : <b style={{ fontSize: 14 }}>{dn(c.userId, c.userName) || '匿名'}</b>}
      {c.superManager && <SuperAdminBadge />}
      {topicOwnerIds?.includes(c.userId) && <TopicOwnerBadge />}
      {authorId && c.userId === authorId && <OpBadge />}
      <UserTitles titles={c.titles} size="sm" />
      {showFloor && c.floor != null && <span style={{ fontSize: 12, color: '#bbb' }}>#{c.floor}</span>}
      <span style={{ fontSize: 12, color: '#bbb' }}>{fmt(c.commentDate)}</span>
    </div>
  )
}

/**
 * 一层楼的回复区：全部子孙回复平铺（贴吧式"xxx 回复 xxx：…"，不再逐层缩进），
 * 时间升序 + 超过一页出分页器。回复楼内任意一条 → 新回复挂进本楼（记录被回复人）。
 * bump 变化 = 楼上（直接回楼）发了新回复 → 跳到最后一页刷新，让新回复可见。
 */
function FloorReplies({ floorId, newsId, authorId, topicOwnerIds, locked, bump, onCountDelta }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [replyingId, setReplyingId] = useState(null)
  const totalRef = useRef(0)
  const bumpRef = useRef(bump)

  const requireLogin = () => { message.info('请先登录'); navigate('/login') }

  const load = useCallback(async (p) => {
    try {
      const res = await newsApi.listFlatReplies({ rootId: floorId, page: p, limit: REPLY_PAGE_SIZE })
      setRows(res.records || [])
      setTotal(res.total || 0)
      totalRef.current = res.total || 0
      setPage(p)
    } catch {
      setRows((r) => r || [])
    }
  }, [floorId])

  useEffect(() => { load(1) }, [load])

  // 楼上直接回楼成功 → 跳最后一页展示新回复
  useEffect(() => {
    if (bump !== bumpRef.current) {
      bumpRef.current = bump
      load(Math.max(1, Math.ceil((totalRef.current + 1) / REPLY_PAGE_SIZE)))
    }
  }, [bump, load])

  const like = async (item, type) => {
    if (!user) return requireLogin()
    const res = await (type === 'good' ? newsApi.goodComment(item.commentId) : newsApi.badComment(item.commentId))
    if (res?.result) {
      const d = res.delta || 0
      setRows((list) => (list || []).map((r) => (r.commentId === item.commentId
        ? { ...r, goodNum: (r.goodNum || 0) + (type === 'good' ? d : 0), badNum: (r.badNum || 0) + (type === 'bad' ? d : 0) }
        : r)))
      message.success(res.msg)
    } else {
      message.error(res?.msg || '操作失败')
    }
  }

  // 回复楼内某条：commentRelId=那条的 id（保留"回复了谁"链条），成功后跳最后一页
  const replyTo = async (item, { text, mentions, attachments }) => {
    if (!user) { requireLogin(); return false }
    const res = await newsApi.postComment({
      newsId,
      content: text,
      commentRelId: item.commentId,
      level: String((parseInt(item.level, 10) || 2) + 1),
      ...(mentions.length ? { mentions: JSON.stringify(mentions) } : {}),
      ...(attachments.length ? { attachments: JSON.stringify(attachments) } : {}),
    })
    if (res?.result) {
      message.success(res.msg || '回复成功')
      setReplyingId(null)
      onCountDelta?.(1)
      await load(Math.max(1, Math.ceil((totalRef.current + 1) / REPLY_PAGE_SIZE)))
      return true
    }
    message.error(res?.msg || '回复失败')
    return false
  }

  // 删除楼内自己的回复：tombstone → 原位标灰"原评论已删除"；removed → 重拉当前页并同步楼上计数
  const del = async (item) => {
    const res = await newsApi.deleteComment(item.commentId)
    if (!res?.result) return message.error(res?.msg || '删除失败')
    message.success(res.msg || '已删除')
    if (res.mode === 'tombstone') {
      setRows((list) => (list || []).map((x) => (x.commentId === item.commentId ? { ...x, deleted: '1' } : x)))
    } else {
      onCountDelta?.(-1)
      const newTotal = Math.max(0, totalRef.current - 1)
      await load(Math.min(page, Math.max(1, Math.ceil(newTotal / REPLY_PAGE_SIZE) || 1)))
    }
  }

  if (rows === null) return <div style={{ textAlign: 'center', padding: 14 }}><Spin size="small" /></div>
  if (!rows.length) return null

  return (
    <div style={{ background: '#fafafa', borderRadius: 10, padding: isMobile ? '2px 10px' : '4px 14px', marginTop: 8 }}>
      {rows.map((r) => (
        <div key={r.commentId} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
          {r.deleted !== '1' && <UserAvatar name={r.userName} src={r.commenterAvatar} size={24} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            {r.deleted !== '1' && <MetaRow c={r} authorId={authorId} topicOwnerIds={topicOwnerIds} />}
            {/* 平级楼层："A 回复 B：内容"。直接回楼的不带"回复 B"前缀；已删的整行变墓碑 */}
            <div style={{ margin: '4px 0 2px', whiteSpace: 'pre-wrap', color: r.deleted === '1' ? '#bfbfbf' : '#262626', fontStyle: r.deleted === '1' ? 'italic' : 'normal', fontSize: r.deleted === '1' ? 13 : 14, lineHeight: 1.7 }}>
              {r.deleted !== '1' && r.commentRelId && r.commentRelId !== floorId && r.replyToName && (
                <span style={{ color: '#8c8c8c' }}>
                  回复{' '}
                  {r.replyToUserId
                    ? <Link to={`/users/${r.replyToUserId}`} onClick={(e) => e.stopPropagation()} style={{ color: '#fa541c', fontWeight: 600 }}>@{r.replyToName}</Link>
                    : <b>@{r.replyToName}</b>}
                  ：
                </span>
              )}
              {r.deleted === '1' ? '原评论已删除' : renderContent(r.content, r.mentions)}
            </div>
            {r.deleted !== '1' && <CommentAttachments attachmentsJson={r.attachments} />}
            {r.deleted !== '1' && (
            <Space size={2} wrap={isMobile} style={{ marginLeft: -8, marginTop: 2 }}>
              <Button type="text" size="small" style={{ color: '#8c8c8c' }} icon={<LikeOutlined />} onClick={() => like(r, 'good')}>
                {r.goodNum ?? 0}
              </Button>
              <Button type="text" size="small" style={{ color: '#8c8c8c' }} icon={<DislikeOutlined />} onClick={() => like(r, 'bad')}>
                {r.badNum ?? 0}
              </Button>
              {!locked && (
                <Button
                  type="text"
                  size="small"
                  style={{ color: replyingId === r.commentId ? '#fa541c' : '#8c8c8c' }}
                  onClick={() => (user ? setReplyingId((id) => (id === r.commentId ? null : r.commentId)) : requireLogin())}
                >
                  回复
                </Button>
              )}
              {user && user.userId === r.userId && (
                <Popconfirm title="删除这条回复？" okText="删除" cancelText="取消" onConfirm={() => del(r)}>
                  <Button type="text" size="small" style={{ color: '#ff4d4f' }}>删除</Button>
                </Popconfirm>
              )}
            </Space>
            )}
            {replyingId === r.commentId && (
              <div style={{ marginTop: 8 }}>
                <CommentComposer
                  newsId={newsId}
                  compact
                  placeholder={`回复 ${r.userName || ''}（@ 提及 · 可发图片/文件/表情）`}
                  submitText="发表回复"
                  onSubmit={(payload) => replyTo(r, payload)}
                  onCancel={() => setReplyingId(null)}
                />
              </div>
            )}
          </div>
        </div>
      ))}
      {total > REPLY_PAGE_SIZE && (
        <div style={{ padding: '10px 0', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end' }}>
          <Pagination
            size="small"
            simple={isMobile}
            current={page}
            pageSize={REPLY_PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={(p) => load(p)}
          />
        </div>
      )}
    </div>
  )
}

/**
 * 一层楼（一级评论）：楼主体 + 点赞/点踩/回复 + 展开楼内平铺回复（FloorReplies）。
 * "N 条回复"用全部子孙数（后端按 ROOT_ID 统计的 totalReplyNum）。
 */
function FloorNode({ comment, newsId, authorId, topicOwnerIds, locked, ratingItem, onVoteRating, onDeleteRating, ratingCanDelete, pollItem, onVotePoll, onDeletePoll, onRemoved }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [c, setC] = useState(comment) // 本楼数据（含 goodNum/badNum/totalReplyNum），就地更新
  const [replyOpen, setReplyOpen] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [bump, setBump] = useState(0) // 直接回楼成功 → +1，让 FloorReplies 跳最后一页刷新

  const requireLogin = () => { message.info('请先登录'); navigate('/login') }
  const replyCount = c.totalReplyNum ?? c.commentNum ?? 0

  const like = async (type) => {
    if (!user) return requireLogin()
    const res = await (type === 'good' ? newsApi.goodComment(c.commentId) : newsApi.badComment(c.commentId))
    if (res?.result) {
      const d = res.delta || 0
      setC((p) => ({ ...p, goodNum: (p.goodNum || 0) + (type === 'good' ? d : 0), badNum: (p.badNum || 0) + (type === 'bad' ? d : 0) }))
      message.success(res.msg)
    } else {
      message.error(res?.msg || '操作失败')
    }
  }

  // 直接回楼：commentRelId=楼 id；成功后展开回复区并跳到最新
  const handleReply = async ({ text, mentions, attachments }) => {
    if (!user) { requireLogin(); return false }
    const res = await newsApi.postComment({
      newsId,
      content: text,
      commentRelId: c.commentId,
      level: String((parseInt(c.level, 10) || 1) + 1),
      ...(mentions.length ? { mentions: JSON.stringify(mentions) } : {}),
      ...(attachments.length ? { attachments: JSON.stringify(attachments) } : {}),
    })
    if (res?.result) {
      message.success(res.msg || '回复成功')
      setC((p) => ({ ...p, totalReplyNum: (p.totalReplyNum ?? p.commentNum ?? 0) + 1 }))
      setReplyOpen(false)
      setShowReplies(true)
      setBump((b) => b + 1)
      return true
    }
    message.error(res?.msg || '回复失败')
    return false
  }

  // 删除本楼（仅作者本人）：有回复 → 原位墓碑；无回复 → 整楼从列表移除
  const del = async () => {
    const res = await newsApi.deleteComment(c.commentId)
    if (!res?.result) return message.error(res?.msg || '删除失败')
    message.success(res.msg || '已删除')
    if (res.mode === 'removed') onRemoved?.(c.commentId)
    else setC((p) => ({ ...p, deleted: '1' }))
  }

  return (
    <div style={{ display: 'flex', gap: 12, paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #f5f5f5' }}>
      {c.deleted === '1' ? <UserAvatar name="?" size={36} /> : <UserAvatar name={c.userName} src={c.commenterAvatar} size={36} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {c.deleted !== '1' && <MetaRow c={c} authorId={authorId} topicOwnerIds={topicOwnerIds} showFloor />}

        {/* 墓碑：作者删了这层楼，但楼内回复保留 */}
        {c.deleted === '1' && (
          <div style={{ margin: '6px 0', color: '#bfbfbf', fontStyle: 'italic', fontSize: 14 }}>原评论已删除</div>
        )}

        {/* 内容（@昵称 渲染成可点链接） */}
        {c.deleted !== '1' && c.content && (
          <div style={{ margin: '6px 0 6px', whiteSpace: 'pre-wrap', color: '#262626', fontSize: 14, lineHeight: 1.7 }}>
            {renderContent(c.content, c.mentions)}
          </div>
        )}

        {/* 图片/文件附件 */}
        {c.deleted !== '1' && <CommentAttachments attachmentsJson={c.attachments} />}

        {/* 该楼挂的打分项（楼主开的打分楼） */}
        {c.deleted !== '1' && ratingItem && (
          <div style={{ marginTop: 8 }}>
            <RatingCard
              item={ratingItem}
              onVote={onVoteRating}
              onDelete={onDeleteRating}
              canDelete={ratingCanDelete}
              disabled={locked}
            />
          </div>
        )}

        {/* 该楼挂的投票（楼主开的投票楼） */}
        {c.deleted !== '1' && pollItem && (
          <div style={{ marginTop: 8 }}>
            <PollCard
              item={pollItem}
              onVote={onVotePoll}
              onDelete={onDeletePoll}
              canDelete={ratingCanDelete}
              disabled={locked}
            />
          </div>
        )}

        {/* 操作行；墓碑楼只留"N 条回复"展开 */}
        {c.deleted === '1' ? (
          replyCount > 0 && (
            <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => setShowReplies((s) => !s)}>
              {showReplies ? '收起' : `${replyCount} 条回复`}
            </Button>
          )
        ) : (
        <Space size={2} wrap={isMobile} style={{ marginLeft: -8, marginTop: 4 }}>
          <Button type="text" size="small" style={{ color: '#8c8c8c' }} icon={<LikeOutlined />} onClick={() => like('good')}>
            {c.goodNum ?? 0}
          </Button>
          <Button type="text" size="small" style={{ color: '#8c8c8c' }} icon={<DislikeOutlined />} onClick={() => like('bad')}>
            {c.badNum ?? 0}
          </Button>
          {!locked && (
            <Button type="text" size="small" style={{ color: '#8c8c8c' }} onClick={() => (user ? setReplyOpen((o) => !o) : requireLogin())}>
              回复
            </Button>
          )}
          {replyCount > 0 && (
            <Button type="link" size="small" onClick={() => setShowReplies((s) => !s)}>
              {showReplies ? '收起' : `${replyCount} 条回复`}
            </Button>
          )}
          {user && user.userId === c.userId && (
            <Popconfirm title="删除这条评论？" okText="删除" cancelText="取消" onConfirm={del}>
              <Button type="text" size="small" style={{ color: '#ff4d4f' }}>删除</Button>
            </Popconfirm>
          )}
        </Space>
        )}

        {/* 内联回复框（直接回楼） */}
        {replyOpen && (
          <div style={{ marginTop: 10 }}>
            <CommentComposer
              newsId={newsId}
              compact
              placeholder={`回复 ${c.userName || ''}（@ 提及 · 可发图片/文件/表情）`}
              submitText="发表回复"
              onSubmit={handleReply}
              onCancel={() => setReplyOpen(false)}
            />
          </div>
        )}

        {/* 楼内回复：平铺 + 分页（不再逐层缩进） */}
        {showReplies && (
          <FloorReplies
            floorId={c.commentId}
            newsId={newsId}
            authorId={authorId}
            topicOwnerIds={topicOwnerIds}
            locked={locked}
            bump={bump}
            onCountDelta={(d) => setC((p) => ({ ...p, totalReplyNum: (p.totalReplyNum ?? p.commentNum ?? 0) + d }))}
          />
        )}
      </div>
    </div>
  )
}

/**
 * 帖子下的评论区。顶层评论（level='1'，按楼层）+ 发表评论；楼内回复平铺展示（贴吧式）。
 * 注意：发评论/点赞接口返回旧版 {result,msg}；点赞计数据后端 delta 乐观更新。
 */
export default function CommentSection({
  newsId, authorId, authorName, topicOwnerIds, locked,
  ratingByComment = {}, onVoteRating, onDeleteRating, ratingCanDelete, canOpenRating, onOpenRating,
  pollByComment = {}, onVotePoll, onDeletePoll, onOpenPoll,
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [onlyAuthor, setOnlyAuthor] = useState(false) // 只看楼主：仅展示楼主的顶层评论（其回复照常）
  const [sortBy, setSortBy] = useState('hot') // 默认按热度（点赞最多在前）；time=按时间（最新在前）
  const [ratingOpen, setRatingOpen] = useState(false) // 楼主"开启打分"面板
  const [ratingSubject, setRatingSubject] = useState('')
  const [ratingNote, setRatingNote] = useState('')
  const [ratingImage, setRatingImage] = useState('') // 打分对象配图 URL（可选）
  const [ratingSaving, setRatingSaving] = useState(false)
  const [pollOpen, setPollOpen] = useState(false) // 楼主"发起投票"面板
  const [pollSubject, setPollSubject] = useState('')
  const [pollNote, setPollNote] = useState('')
  const [pollOptions, setPollOptions] = useState(['', '']) // 2-10 个选项
  const [pollSaving, setPollSaving] = useState(false)

  // 楼主开打分楼：NewsDetail 调 openFloor + 刷新打分项，这里刷新楼列表让新楼出现
  const submitRating = async () => {
    const sub = ratingSubject.trim()
    if (!sub) return message.warning('请填写打分对象')
    setRatingSaving(true)
    try {
      await onOpenRating?.(sub, ratingNote.trim(), ratingImage)
      message.success('已开启打分')
      setRatingOpen(false)
      setRatingSubject('')
      setRatingNote('')
      setRatingImage('')
      load()
    } catch { /* 拦截器已弹错 */ } finally {
      setRatingSaving(false)
    }
  }

  // 楼主开投票楼：校验后交给 NewsDetail 的 openPoll（openFloor + 刷新投票项），这里刷新楼列表
  const submitPoll = async () => {
    const sub = pollSubject.trim()
    if (!sub) return message.warning('请填写投票主题')
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean)
    if (opts.length < 2) return message.warning('至少要 2 个选项')
    if (new Set(opts).size !== opts.length) return message.warning('选项不能重复')
    setPollSaving(true)
    try {
      await onOpenPoll?.(sub, opts, pollNote.trim())
      message.success('已发起投票')
      setPollOpen(false)
      setPollSubject('')
      setPollNote('')
      setPollOptions(['', ''])
      load()
    } catch { /* 拦截器已弹错 */ } finally {
      setPollSaving(false)
    }
  }

  // 只看楼主时按楼主 userId 过滤顶层评论；回复不受影响（各楼展开时单独拉取）
  const filtered = onlyAuthor && authorId ? comments.filter((c) => c.userId === authorId) : comments
  // 排序：时间=后端默认楼层倒序（最新在前）；热度=点赞数降序（同赞按时间）
  const shown = sortBy === 'hot'
    ? [...filtered].sort((a, b) => (b.goodNum || 0) - (a.goodNum || 0) || (b.floor || 0) - (a.floor || 0))
    : filtered

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await newsApi.listComments({ newsId, level: '1', page: 1, limit: 100 })
      setComments(res.records || [])
    } finally {
      setLoading(false)
    }
  }, [newsId])
  useEffect(() => { load() }, [load])

  // 提交评论：成功返回 true 让 composer 清空
  const handlePost = async ({ text, mentions, attachments }) => {
    if (!user) { message.info('请先登录'); navigate('/login'); return false }
    const res = await newsApi.postComment({
      newsId,
      content: text,
      level: '1',
      ...(mentions.length ? { mentions: JSON.stringify(mentions) } : {}),
      ...(attachments.length ? { attachments: JSON.stringify(attachments) } : {}),
    })
    if (res?.result) {
      message.success(res.msg || '评论成功')
      load()
      return true
    }
    message.error(res?.msg || '评论失败')
    return false
  }

  return (
    <div style={{ marginTop: 22 }}>
      {/* 头部：桌面=标题+右对齐胶囊一行；移动端=标题一行、三个胶囊自成一行（紧凑尺寸，不换行乱堆） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {onlyAuthor ? '楼主评论' : '全部评论'} <span style={{ color: '#999', fontWeight: 400, fontSize: 14 }}>({shown.length})</span>
        </div>
        {!isMobile && <span style={{ flex: 1 }} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, width: isMobile ? '100%' : 'auto' }}>
          {/* 排序：时间（最新在前）/ 热度（点赞最多） */}
          <div style={{ display: 'inline-flex', background: '#f5f5f5', borderRadius: 999, padding: 2, flexShrink: 0 }}>
            {[['time', '时间'], ['hot', '热度']].map(([v, l]) => (
              <span
                key={v}
                onClick={() => setSortBy(v)}
                title={v === 'time' ? '按时间：最新的在前' : '按热度：点赞最多的在前'}
                style={{
                  padding: '2px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', userSelect: 'none',
                  whiteSpace: 'nowrap', transition: 'all .15s',
                  color: sortBy === v ? '#fa541c' : '#8c8c8c',
                  background: sortBy === v ? '#fff' : 'transparent',
                  fontWeight: sortBy === v ? 700 : 400,
                  boxShadow: sortBy === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}
              >
                {l}
              </span>
            ))}
          </div>
          {canOpenRating && !locked && (
            <span
              onClick={() => setRatingOpen((v) => !v)}
              title="以一条新楼开启一个打分项（仅楼主）"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none',
                padding: isMobile ? '4px 10px' : '4px 14px', borderRadius: 999,
                fontSize: isMobile ? 12 : 13, fontWeight: 500, whiteSpace: 'nowrap',
                color: ratingOpen ? '#fff' : '#fa8c16',
                background: ratingOpen ? '#fa8c16' : '#fff7e6',
                border: `1px solid ${ratingOpen ? '#fa8c16' : '#ffd591'}`,
                transition: 'all .15s',
              }}
            >
              <StarFilled /> 开启打分
            </span>
          )}
          {canOpenRating && !locked && (
            <span
              onClick={() => setPollOpen((v) => !v)}
              title="以一条新楼发起一个投票（仅楼主）"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none',
                padding: isMobile ? '4px 10px' : '4px 14px', borderRadius: 999,
                fontSize: isMobile ? 12 : 13, fontWeight: 500, whiteSpace: 'nowrap',
                color: pollOpen ? '#fff' : '#1677ff',
                background: pollOpen ? '#1677ff' : '#e6f4ff',
                border: `1px solid ${pollOpen ? '#1677ff' : '#91caff'}`,
                transition: 'all .15s',
              }}
            >
              <BarChartOutlined /> 发起投票
            </span>
          )}
          {authorId && (
            <span
              onClick={() => setOnlyAuthor((v) => !v)}
              title={onlyAuthor ? '显示全部评论' : '只看楼主的评论'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none',
                padding: isMobile ? '4px 10px' : '4px 14px', borderRadius: 999,
                fontSize: isMobile ? 12 : 13, fontWeight: 500, whiteSpace: 'nowrap',
                color: onlyAuthor ? '#fff' : '#8c8c8c',
                background: onlyAuthor ? '#fa541c' : '#f5f5f5',
                border: `1px solid ${onlyAuthor ? '#fa541c' : '#ececec'}`,
                boxShadow: onlyAuthor ? '0 2px 8px rgba(250,84,28,.25)' : 'none',
                transition: 'all .15s',
              }}
            >
              <UserOutlined /> 只看楼主
            </span>
          )}
        </div>
      </div>

      {/* 楼主开打分面板：对象必填 + 说明可选，发布=发一条新楼并挂上打分项 */}
      {ratingOpen && canOpenRating && !locked && (
        <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d46b08', marginBottom: 10 }}>
            <StarFilled style={{ marginRight: 6 }} />开启新打分（会以一条新楼发布）
          </div>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            <Input
              placeholder="想为什么打分？（必填）"
              maxLength={30}
              showCount
              value={ratingSubject}
              onChange={(e) => setRatingSubject(e.target.value)}
              style={{ maxWidth: 360, display: 'block' }}
            />
            <RatingImagePicker value={ratingImage} onChange={setRatingImage} upload={(f) => newsApi.uploadNewsImage(f, newsId)} />
            <Input
              placeholder="说明文字（可选，作为楼的内容）"
              maxLength={200}
              value={ratingNote}
              onChange={(e) => setRatingNote(e.target.value)}
            />
            <Space>
              <Button type="primary" size="small" loading={ratingSaving} onClick={submitRating} style={{ background: '#fa8c16', borderColor: '#fa8c16' }}>
                发布打分楼
              </Button>
              <Button size="small" onClick={() => setRatingOpen(false)}>取消</Button>
            </Space>
          </Space>
        </div>
      )}

      {/* 楼主发起投票面板：主题必填 + 2-10 个选项 + 说明可选，发布=发一条新楼并挂上投票 */}
      {pollOpen && canOpenRating && !locked && (
        <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0958d9', marginBottom: 10 }}>
            <BarChartOutlined style={{ marginRight: 6 }} />发起新投票（会以一条新楼发布）
          </div>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            <Input
              placeholder="想投什么？（必填）"
              maxLength={30}
              showCount
              value={pollSubject}
              onChange={(e) => setPollSubject(e.target.value)}
              style={{ maxWidth: 360, display: 'block' }}
            />
            {pollOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
                <Input
                  placeholder={`选项 ${i + 1}`}
                  maxLength={20}
                  value={opt}
                  onChange={(e) => setPollOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {pollOptions.length > 2 && (
                  <Button size="small" type="text" danger onClick={() => setPollOptions((arr) => arr.filter((_, j) => j !== i))}>删</Button>
                )}
              </div>
            ))}
            {pollOptions.length < 10 && (
              <Button size="small" onClick={() => setPollOptions((arr) => [...arr, ''])} style={{ width: 120 }}>+ 添加选项</Button>
            )}
            <Input
              placeholder="说明文字（可选，作为楼的内容）"
              maxLength={200}
              value={pollNote}
              onChange={(e) => setPollNote(e.target.value)}
            />
            <Space>
              <Button type="primary" size="small" loading={pollSaving} onClick={submitPoll}>
                发布投票楼
              </Button>
              <Button size="small" onClick={() => setPollOpen(false)}>取消</Button>
            </Space>
          </Space>
        </div>
      )}

      {locked ? (
        <div
          style={{
            background: '#fafafa', border: '1px dashed #e0e0e0', borderRadius: 10,
            padding: '14px 20px', textAlign: 'center', color: '#8c8c8c', marginBottom: 20,
          }}
        >
          <LockOutlined /> 该帖已被锁定，仅可查看，暂不能评论
        </div>
      ) : user ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <UserAvatar name={user.userNickname} src={user.avatar} size={36} />
          <div style={{ flex: 1 }}>
            <CommentComposer
              newsId={newsId}
              placeholder="说点什么…（@ 提及 · 可发图片/文件/表情）"
              submitText="发表评论"
              onSubmit={handlePost}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#fafafa', border: '1px dashed #e0e0e0', borderRadius: 10,
            padding: '16px 20px', textAlign: 'center', color: '#888', marginBottom: 20,
          }}
        >
          登录后参与评论　<a onClick={() => navigate('/login')}>去登录</a>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : shown.length ? (
        shown.map((c) => (
          <FloorNode
            key={c.commentId}
            comment={c}
            newsId={newsId}
            authorId={authorId}
            topicOwnerIds={topicOwnerIds}
            locked={locked}
            ratingItem={ratingByComment[c.commentId]}
            onVoteRating={onVoteRating}
            onDeleteRating={onDeleteRating}
            ratingCanDelete={ratingCanDelete}
            pollItem={pollByComment[c.commentId]}
            onVotePoll={onVotePoll}
            onDeletePoll={onDeletePoll}
            onRemoved={(id) => setComments((list) => list.filter((x) => x.commentId !== id))}
          />
        ))
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={onlyAuthor ? '楼主还没在本帖发表评论' : '还没有评论，来抢沙发'}
        />
      )}
    </div>
  )
}
