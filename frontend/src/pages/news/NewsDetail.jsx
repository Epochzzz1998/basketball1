import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Skeleton, Space, Tag, Typography, message } from 'antd'
import { DislikeOutlined, LikeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import DOMPurify from 'dompurify'
import { newsApi } from '../../api/news'
import { useAuth } from '../../auth/AuthContext'
import CommentSection from '../../components/CommentSection'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 资讯详情（公开，/news/:newsId）。替代 news-show.ftl。
 * content 是后台富文本编辑器存的 HTML，用 dangerouslySetInnerHTML 渲染。
 * 注意：内容由 manager 发布（半可信），P6 可加 DOMPurify 做 XSS 净化再渲染。
 */
export default function NewsDetail() {
  const { newsId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

  // 帖子点赞/点踩：登录才行；计数经 RabbitMQ 异步更新，这里只提示，不强求即时变
  const likePost = async (type) => {
    if (!user) { message.info('请先登录'); navigate('/login'); return }
    const res = await (type === 'good' ? newsApi.goodPost(newsId) : newsApi.badPost(newsId))
    if (res?.result) {
      const d = res.delta || 0 // 后端给的计数增量（+1 点亮 / -1 取消），即时更新数字
      setNews((n) => (n ? {
        ...n,
        goodNum: (n.goodNum || 0) + (type === 'good' ? d : 0),
        badNum: (n.badNum || 0) + (type === 'bad' ? d : 0),
      } : n))
      message.success(res.msg)
    } else {
      message.error(res?.msg || '操作失败')
    }
  }

  useEffect(() => {
    let alive = true // 防止请求回来时组件已卸载还 setState
    setLoading(true)
    newsApi
      .getNews(newsId)
      .then((data) => { if (alive) setNews(data?.news || null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [newsId])

  return (
    <Card>
      <Link to="/news"><Button style={{ marginBottom: 16 }}>← 返回资讯</Button></Link>
      <Skeleton loading={loading} active paragraph={{ rows: 8 }}>
        {news ? (
          <>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>{news.title}</Typography.Title>
            <Space size={[8, 4]} wrap style={{ color: '#888', marginBottom: 16 }}>
              {news.author && <span>{news.author}</span>}
              {news.publishDate && <span>{fmt(news.publishDate)}</span>}
              {news.team && <Tag>{news.team}</Tag>}
              {news.newsType && <Tag color="blue">{news.newsType}</Tag>}
            </Space>
            {/* 正文是用户发帖的 HTML：发帖已对所有登录用户开放（不可信），渲染前必须用 DOMPurify 净化，防存储型 XSS */}
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(news.content || '') }} />
            <Space style={{ marginTop: 16 }}>
              <Button icon={<LikeOutlined />} onClick={() => likePost('good')}>顶 {news.goodNum ?? 0}</Button>
              <Button icon={<DislikeOutlined />} onClick={() => likePost('bad')}>踩 {news.badNum ?? 0}</Button>
            </Space>
            <CommentSection newsId={newsId} />
          </>
        ) : (
          <Typography.Text type="secondary">资讯不存在或已删除。</Typography.Text>
        )}
      </Skeleton>
    </Card>
  )
}
