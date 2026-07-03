import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Divider, Empty, Input, Space, Spin, Tag, Tooltip, message } from 'antd'
import { DislikeOutlined, LikeOutlined, TrophyFilled } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../api/news'
import { useAuth } from '../auth/AuthContext'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 单条评论节点（递归）。支持点赞/点踩、回复（内联框）、展开子回复（再用 CommentNode 渲染，逐层缩进）。
 * - 回复：commentRelId=本评论 id、level=本 level+1（与后端 getCommentInit 一致）；
 * - 子回复用 listComments({commentRelId}) 拉取；commentNum 是该评论的回复数。
 * 评论内容是纯文本，React 自动转义，无 XSS 风险。
 */
function CommentNode({ comment, newsId, depth = 0 }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [c, setC] = useState(comment) // 本节点数据（含 goodNum/badNum/commentNum），就地更新
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  const submitReply = async () => {
    if (!user) return requireLogin()
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      const res = await newsApi.postComment({
        newsId,
        content: replyText.trim(),
        commentRelId: c.commentId,
        level: String((parseInt(c.level, 10) || 1) + 1),
      })
      if (res?.result) {
        message.success(res.msg || '回复成功')
        setReplyText('')
        setReplyOpen(false)
        setC((p) => ({ ...p, commentNum: (p.commentNum || 0) + 1 }))
        await loadReplies()
        setShowReplies(true)
      } else {
        message.error(res?.msg || '回复失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginLeft: depth ? 24 : 0, paddingTop: 8 }}>
      <Space size="small" wrap>
        <Avatar size="small" src={c.commenterAvatar || undefined}>{(c.userName || '匿')[0]}</Avatar>
        {c.userId
          ? <a onClick={() => navigate(`/users/${c.userId}`)} style={{ fontWeight: 700 }}>{c.userName || '匿名'}</a>
          : <b>{c.userName || '匿名'}</b>}
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
        {c.floor != null && <Tag>#{c.floor}</Tag>}
        <span style={{ color: '#aaa' }}>{fmt(c.commentDate)}</span>
      </Space>
      <div style={{ margin: '4px 0 4px 28px', whiteSpace: 'pre-wrap', color: '#333' }}>{c.content}</div>
      <Space size="small" style={{ marginLeft: 28 }}>
        <Button type="text" size="small" icon={<LikeOutlined />} onClick={() => like('good')}>{c.goodNum ?? 0}</Button>
        <Button type="text" size="small" icon={<DislikeOutlined />} onClick={() => like('bad')}>{c.badNum ?? 0}</Button>
        <Button type="link" size="small" onClick={() => (user ? setReplyOpen((o) => !o) : requireLogin())}>回复</Button>
        {c.commentNum > 0 && (
          <Button type="link" size="small" onClick={toggleReplies} loading={loadingReplies}>
            {showReplies ? '收起' : `查看 ${c.commentNum} 条回复`}
          </Button>
        )}
      </Space>

      {replyOpen && (
        <div style={{ marginLeft: 28, marginTop: 8 }}>
          <Input.TextArea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`回复 ${c.userName || ''}`}
            maxLength={500}
            autoSize={{ minRows: 2, maxRows: 5 }}
          />
          <Space style={{ marginTop: 6 }}>
            <Button type="primary" size="small" loading={submitting} onClick={submitReply}>发表回复</Button>
            <Button size="small" onClick={() => setReplyOpen(false)}>取消</Button>
          </Space>
        </div>
      )}

      {showReplies && replies.map((r) => (
        <CommentNode key={r.commentId} comment={r} newsId={newsId} depth={depth + 1} />
      ))}

      {depth === 0 && <Divider style={{ margin: '8px 0' }} />}
    </div>
  )
}

/**
 * 帖子下的评论区。顶层评论（level='1'，按楼层）+ 发表评论 + 递归楼中楼。
 * 注意：发评论/点赞接口返回旧版 {result,msg}；点赞计数据后端 delta 乐观更新。
 */
export default function CommentSection({ newsId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const submit = async () => {
    if (!user) { message.info('请先登录'); navigate('/login'); return }
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await newsApi.postComment({ newsId, content: text.trim(), level: '1' })
      if (res?.result) {
        message.success(res.msg || '评论成功')
        setText('')
        load()
      } else {
        message.error(res?.msg || '评论失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <Divider orientation="left">评论（{comments.length}）</Divider>

      {user ? (
        <div style={{ marginBottom: 20 }}>
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="说点什么…"
            maxLength={500}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
          <Button type="primary" style={{ marginTop: 8 }} loading={submitting} onClick={submit}>发表评论</Button>
        </div>
      ) : (
        <p style={{ color: '#888' }}>
          登录后参与评论。<a onClick={() => navigate('/login')}>去登录</a>
        </p>
      )}

      {loading ? (
        <Spin />
      ) : comments.length ? (
        comments.map((c) => <CommentNode key={c.commentId} comment={c} newsId={newsId} />)
      ) : (
        <Empty description="还没有评论，来抢沙发" />
      )}
    </div>
  )
}
