import { useRef } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Button, Popconfirm, Tag, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

/**
 * 资讯管理（manager）。看/建/编辑/删资讯。
 * 列表复用公开的 /news/newsListData；删除走 DELETE /news/delete。
 * actionRef 用来在删除/保存后命令式刷新表格。
 */
export default function NewsManage() {
  const navigate = useNavigate()
  const actionRef = useRef()

  const onDelete = async (newsId) => {
    await newsApi.deleteNews(newsId)
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns = [
    {
      title: '标题', dataIndex: 'title', ellipsis: true,
      render: (_, r) => <Link to={`/news/${r.newsId}`}>{r.title || '(无标题)'}</Link>,
    },
    {
      title: '频道', dataIndex: 'newsChannel', width: 90,
      render: (_, r) => (r.newsChannel === 'official' ? <Tag color="orange">官方</Tag> : <Tag>论坛</Tag>),
    },
    { title: '作者', dataIndex: 'author', width: 120 },
    { title: '球队', dataIndex: 'team', width: 110 },
    { title: '分类', dataIndex: 'newsType', width: 110 },
    { title: '发布时间', dataIndex: 'publishDate', width: 160, render: (_, r) => fmt(r.publishDate) },
    {
      title: '操作', valueType: 'option', width: 120,
      render: (_, r) => [
        <a key="edit" onClick={() => navigate(`/news/edit/${r.newsId}`)}>编辑</a>,
        <Popconfirm key="del" title="删除这条资讯？" onConfirm={() => onDelete(r.newsId)}>
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <ProTable
      rowKey="newsId"
      actionRef={actionRef}
      headerTitle="资讯管理"
      search={false}
      pagination={{ pageSize: 10 }}
      request={async (params) => {
        const res = await newsApi.listNews({ page: params.current, limit: params.pageSize })
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
      toolBarRender={() => [
        <Button key="new" type="primary" onClick={() => navigate('/news/new')}>新建资讯</Button>,
      ]}
      columns={columns}
    />
  )
}
