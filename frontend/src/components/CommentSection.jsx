import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Empty, Image, Space, Spin, Tag, Tooltip, message } from 'antd'
import { DislikeOutlined, FileOutlined, LikeOutlined, TrophyFilled, UserOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../api/news'
import { useAuth } from '../auth/AuthContext'
import CommentComposer, { humanSize } from './CommentComposer'
import { SuperAdminBadge, TopicOwnerBadge, OpBadge } from './RoleBadges'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

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
// mentionsJson 是后端存的 [{id,name}]；按名字长度倒序匹配，避免 "@li" 抢了 "@lisa" 的前缀。
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
          style={{ color: '#fa541c', fontWeight: 600 }}
        >
          @{hit.name}
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

/**
 * 单条评论节点（递归）。支持点赞/点踩、回复（内联 CommentComposer）、展开子回复（楼中楼左侧线缩进）。
 * - 回复：commentRelId=本评论 id、level=本 level+1（与后端 getCommentInit 一致）；
 * - 子回复用 listComments({commentRelId}) 拉取；commentNum 是该评论的回复数。
 * 评论内容是纯文本（React 自动转义）；@昵称渲染成链接；末尾渲染图片/文件附件。
 */
function CommentNode({ comment, newsId, depth = 0, authorId, topicOwnerId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [c, setC] = useState(comment) // 本节点数据（含 goodNum/badNum/commentNum），就地更新
  const [replyOpen, setReplyOpen] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)

  const requireLogin = () => { message.info('请先登录'); navigate('/login') }

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

  const loadReplies = async () => {
    setLoadingReplies(true)
    try {
      const res = await newsApi.listComments({ commentRelId: c.commentId, page: 1, limit: 100 })
      setReplies(res.records || [])
      setRepliesLoaded(true)
    } finally {
      setLoadingReplies(false)
    }
  }

  const toggleReplies = async () => {
    if (!showReplies && !repliesLoaded) await loadReplies()
    setShowReplies((s) => !s)
  }

  // 提交回复：成功返回 true 让 composer 清空
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
      setC((p) => ({ ...p, commentNum: (p.commentNum || 0) + 1 }))
      await loadReplies()
      setShowReplies(true)
      setReplyOpen(false)
      return true
    }
    message.error(res?.msg || '回复失败')
    return false
  }

  const top = depth === 0

  return (
    <div
      style={{
        display: 'flex', gap: 12, paddingTop: top ? 16 : 12,
        paddingBottom: top ? 16 : 0,
        borderBottom: top ? '1px solid #f5f5f5' : 'none',
      }}
    >
      <UserAvatar name={c.userName} src={c.commenterAvatar} size={top ? 36 : 28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 头行：昵称 + 认证 + 楼层 + 时间 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {c.userId
            ? <a onClick={() => navigate(`/users/${c.userId}`)} style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>{c.userName || '匿名'}</a>
            : <b style={{ fontSize: 14 }}>{c.userName || '匿名'}</b>}
          {c.superManager && <SuperAdminBadge />}
          {topicOwnerId && c.userId === topicOwnerId && <TopicOwnerBadge />}
          {authorId && c.userId === authorId && <OpBadge />}
          {c.verifiedPlayerId && (
            <Tooltip title="认证球员 · 点击看生涯数据">
              <Tag
                color="gold"
                style={{ cursor: 'pointer', marginInlineEnd: 0, lineHeight: '18px' }}
                onClick={() => navigate(`/players/${c.verifiedPlayerId}`)}
              >
                <TrophyFilled /> {c.verifiedPlayerName || '认证球员'}
              </Tag>
            </Tooltip>
          )}
          {c.floor != null && <span style={{ fontSize: 12, color: '#bbb' }}>#{c.floor}</span>}
          <span style={{ fontSize: 12, color: '#bbb' }}>{fmt(c.commentDate)}</span>
        </div>

        {/* 内容（@昵称 渲染成可点链接） */}
        {c.content && (
          <div style={{ margin: '6px 0 6px', whiteSpace: 'pre-wrap', color: '#262626', fontSize: 14, lineHeight: 1.7 }}>
            {renderContent(c.content, c.mentions)}
          </div>
        )}

        {/* 图片/文件附件 */}
        <CommentAttachments attachmentsJson={c.attachments} />

        {/* 操作行 */}
        <Space size={2} style={{ marginLeft: -8, marginTop: 4 }}>
          <Button type="text" size="small" style={{ color: '#8c8c8c' }} icon={<LikeOutlined />} onClick={() => like('good')}>
            {c.goodNum ?? 0}
          </Button>
          <Button type="text" size="small" style={{ color: '#8c8c8c' }} icon={<DislikeOutlined />} onClick={() => like('bad')}>
            {c.badNum ?? 0}
          </Button>
          <Button type="text" size="small" style={{ color: '#8c8c8c' }} onClick={() => (user ? setReplyOpen((o) => !o) : requireLogin())}>
            回复
          </Button>
          {c.commentNum > 0 && (
            <Button type="link" size="small" onClick={toggleReplies} loading={loadingReplies}>
              {showReplies ? '收起' : `${c.commentNum} 条回复`}
            </Button>
          )}
        </Space>

        {/* 内联回复框 */}
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

        {/* 楼中楼：左侧线缩进 */}
        {showReplies && replies.length > 0 && (
          <div style={{ borderLeft: '2px solid #f0f0f0', paddingLeft: 14, marginTop: 4 }}>
            {replies.map((r) => (
              <CommentNode key={r.commentId} comment={r} newsId={newsId} depth={depth + 1} authorId={authorId} topicOwnerId={topicOwnerId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 帖子下的评论区。顶层评论（level='1'，按楼层）+ 发表评论 + 递归楼中楼。
 * 注意：发评论/点赞接口返回旧版 {result,msg}；点赞计数据后端 delta 乐观更新。
 */
export default function CommentSection({ newsId, authorId, authorName, topicOwnerId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [onlyAuthor, setOnlyAuthor] = useState(false) // 只看楼主：仅展示楼主的顶层评论（其回复照常）

  // 只看楼主时按楼主 userId 过滤顶层评论；回复不受影响（各评论展开时单独拉取）
  const shown = onlyAuthor && authorId ? comments.filter((c) => c.userId === authorId) : comments

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          {onlyAuthor ? '楼主评论' : '全部评论'} <span style={{ color: '#999', fontWeight: 400, fontSize: 14 }}>({shown.length})</span>
        </div>
        <span style={{ flex: 1 }} />
        {authorId && (
          <span
            onClick={() => setOnlyAuthor((v) => !v)}
            title={onlyAuthor ? '显示全部评论' : '只看楼主的评论'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none',
              padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
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

      {user ? (
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
        shown.map((c) => <CommentNode key={c.commentId} comment={c} newsId={newsId} authorId={authorId} topicOwnerId={topicOwnerId} />)
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={onlyAuthor ? '楼主还没在本帖发表评论' : '还没有评论，来抢沙发'}
        />
      )}
    </div>
  )
}
