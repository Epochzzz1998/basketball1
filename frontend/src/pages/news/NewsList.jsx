import { ProList } from '@ant-design/pro-components'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 资讯列表（公开）。替代 news-list.ftl。
 * ProList 是 ProTable 的“列表/信息流”版，request 契约一样（返回 {data,total,success}），
 * 只是渲染成一条条卡片而非表格——更适合资讯。标题点进详情页。
 */
export default function NewsList() {
  return (
    <ProList
      rowKey="newsId"
      headerTitle="篮球资讯"
      pagination={{ pageSize: 10 }}
      request={async (params) => {
        const res = await newsApi.listNews({ page: params.current, limit: params.pageSize })
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
