import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Divider, Empty, Input, List, Space, Tag, message } from 'antd'
import { DislikeOutlined, LikeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../api/news'
import { useAuth } from '../auth/AuthContext'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 帖子下的评论区。顶层评论列表（level='1'，按楼层排）+ 发表评论 + 评论点赞/点踩。
 * 评论内容是纯文本（非 HTML），React 自动转义，无需 DOMPurify。
 * 注意：发评论/点赞接口返回旧版 {result,msg}；点赞计数经 RabbitMQ 异步更新，不会立刻变。
 * 嵌套回复（commentRelId/level）留作下一步细化。
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

  const requireLogin = () => {
    message.info('请先登录')
    navigate('/login')
  }

  const submit = async () => {
    if (!user) return requireLogin()
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

  const likeComment = async (c, type) => {
    if (!user) return requireLogin()
    const res = await (type === 'good' ? newsApi.goodComment(c.commentId) : newsApi.badComment(c.commentId))
    if (res?.result) {
      const d = res.delta || 0 // 即时更新该评论的赞/踩数
      setComments((list) => list.map((x) => (x.commentId === c.commentId
        ? { ...x, goodNum: (x.goodNum || 0) + (type === 'good' ? d : 0), badNum: (x.badNum || 0) + (type === 'bad' ? d : 0) }
        : x)))
      message.success(res.msg)
    } else {
      message.error(res?.msg || '操作失败')
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
          <Button type="primary" style={{ marginTop: 8 }} loading={submitting} onClick={submit}>
            发表评论
          </Button>
        </div>
      ) : (
        <p style={{ color: '#888' }}>
          登录后参与评论。<a onClick={() => navigate('/login')}>去登录</a>
        </p>
      )}

      <List
        loading={loading}
        dataSource={comments}
        locale={{ emptyText: <Empty description="还没有评论，来抢沙发" /> }}
        renderItem={(c) => (
          <List.Item
            actions={[
              <Button key="g" type="text" size="small" icon={<LikeOutlined />} onClick={() => likeComment(c, 'good')}>
                {c.goodNum ?? 0}
              </Button>,
              <Button key="b" type="text" size="small" icon={<DislikeOutlined />} onClick={() => likeComment(c, 'bad')}>
                {c.badNum ?? 0}
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar>{(c.userName || '匿')[0]}</Avatar>}
              title={
                <Space size="small" wrap>
                  <span>{c.userName || '匿名'}</span>
                  {c.floor != null && <Tag>#{c.floor}</Tag>}
                  <span style={{ color: '#aaa', fontWeight: 'normal' }}>{fmt(c.commentDate)}</span>
                </Space>
              }
              description={<span style={{ color: '#333', whiteSpace: 'pre-wrap' }}>{c.content}</span>}
            />
          </List.Item>
        )}
      />
    </div>
  )
}
