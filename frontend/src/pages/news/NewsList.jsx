import { ProList } from '@ant-design/pro-components'
import { Button } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'
import { useAuth } from '../../auth/AuthContext'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 帖子列表（公开），按频道复用：
 * - channel="forum"（默认）：资讯论坛，登录用户皆可发帖；
 * - channel="official"：官方新闻区，只有 manager+ 能看到"发布新闻"按钮（后端 /news/save 兜底校验）。
 * 两区详情/评论/点赞共用同一套页面与权限。channel 放进 params，切换菜单时 ProList 自动重新请求。
 */
export default function NewsList({ channel = 'forum' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const official = channel === 'official'

  const postButton = official
    ? user?.isManagerOrOver
      ? [
          <Button key="post" type="primary" onClick={() => navigate('/news/new?channel=official')}>
            发布新闻
          </Button>,
        ]
      : []
    : [
        <Button key="post" type="primary" onClick={() => (user ? navigate('/news/new') : navigate('/login'))}>
          发帖
        </Button>,
      ]

  return (
    <ProList
      rowKey="newsId"
      headerTitle={official ? '官方新闻' : '资讯论坛'}
      toolBarRender={() => postButton}
      pagination={{ pageSize: 10 }}
      params={{ newsChannel: channel }}
      request={async (params) => {
        const res = await newsApi.listNews({
          page: params.current,
          limit: params.pageSize,
          newsChannel: params.newsChannel,
        })
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
      metas={{
        title: {
          render: (_, row) => <Link to={`/news/${row.newsId}`}>{row.title || '(无标题)'}</Link>,
        },
        description: {
          render: (_, row) =>
            [row.author, fmt(row.publishDate), row.team, row.newsType].filter(Boolean).join(' · '),
        },
        actions: {
          render: (_, row) => [
            <span key="g">👍 {row.goodNum ?? 0}</span>,
            <span key="c">💬 {row.commentNum ?? 0}</span>,
          ],
        },
      }}
    />
  )
}
