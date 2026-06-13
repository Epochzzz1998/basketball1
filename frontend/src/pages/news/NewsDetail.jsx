import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button, Card, Skeleton, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 资讯详情（公开，/news/:newsId）。替代 news-show.ftl。
 * content 是后台富文本编辑器存的 HTML，用 dangerouslySetInnerHTML 渲染。
 * 注意：内容由 manager 发布（半可信），P6 可加 DOMPurify 做 XSS 净化再渲染。
 */
export default function NewsDetail() {
  const { newsId } = useParams()
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

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
            <div dangerouslySetInnerHTML={{ __html: news.content || '' }} />
          </>
        ) : (
          <Typography.Text type="secondary">资讯不存在或已删除。</Typography.Text>
        )}
      </Skeleton>
    </Card>
  )
}
