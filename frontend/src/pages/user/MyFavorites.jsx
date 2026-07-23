import { useEffect, useState } from 'react'
import { Button, Card, Empty, Spin, Tag, message } from 'antd'
import { StarFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'

/**
 * 我的收藏（仅本人，头像下拉进入）。时间倒序；已删/被隐藏/无权查看的帖子后端已过滤。
 * 每行可直接取消收藏（乐观移除）。
 */
const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '')

export default function MyFavorites() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    newsApi.myFavorites().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [])

  const unfavorite = async (newsId) => {
    try {
      await newsApi.favorite(newsId) // toggle：已收藏 → 取消
      setRows((list) => (list || []).filter((r) => r.newsId !== newsId))
      message.success('已取消收藏')
    } catch { /* 拦截器已提示 */ }
  }

  return (
    <Card
      title={<span><StarFilled style={{ color: '#faad14', marginRight: 8 }} />我的收藏{rows?.length ? `（${rows.length}）` : ''}</span>}
      style={{ borderRadius: 14 }}
    >
      {rows === null ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : rows.length ? (
        rows.map((r) => (
          <div
            key={r.newsId}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', borderBottom: '1px solid #f5f5f5' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/news/${r.newsId}`} style={{ fontWeight: 600, fontSize: 15, color: '#262626', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title || '(无标题)'}
              </Link>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Tag bordered={false} style={{ marginInlineEnd: 0 }}>{r.newsChannel === 'official' ? '官方新闻' : '百家说'}</Tag>
                <span>{r.author}</span>
                <span>发布于 {fmt(r.publishDate)}</span>
                <span>收藏于 {fmt(r.favTime)}</span>
              </div>
            </div>
            <Button size="small" onClick={() => unfavorite(r.newsId)}>取消收藏</Button>
          </div>
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有收藏，看到喜欢的帖子点「收藏」存起来" />
      )}
    </Card>
  )
}
