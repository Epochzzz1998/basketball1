import { useRef } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Avatar, Tag } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../../api/user'
import { useAuth } from '../../auth/AuthContext'
import UserTitles from '../../components/UserTitles'

/**
 * 全局用户管理（超级管理员）——列表页。
 * 每行是一个用户的小结（身份 + 头衔 + 哪些权限/功能被关），**点击整行进入该用户的管理详情页**
 * （/admin/users/:userId）逐项设置。列表本身不再直接放一堆开关，菜单再多也不挤。
 */

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—')
const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

export default function UserManage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const actionRef = useRef()

  // 权限/功能小结：被关掉的用红标列出；全开=一个绿标
  const summary = (r) => {
    const off = []
    if (!r.enabled) off.push('禁登录')
    if (!r.canBrowse) off.push('禁浏览')
    if (!r.canComment) off.push('禁发言')
    if (!r.canPost) off.push('禁发帖')
    if (!r.featData) off.push('无数据分析')
    if (!r.featNews) off.push('无新闻')
    if (!r.featForum) off.push('无百家说')
    if (!r.featPm) off.push('无私信')
    if (!off.length) return <Tag color="green" style={{ marginInlineEnd: 0 }}>全部开放</Tag>
    return off.map((t) => <Tag key={t} color="red" style={{ marginInlineEnd: 4 }}>{t}</Tag>)
  }

  const columns = [
    {
      title: '用户', dataIndex: 'userNickname', ellipsis: true,
      render: (_, r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {r.avatar
            ? <Avatar size={28} src={r.avatar} />
            : <Avatar size={28} style={{ background: avatarColor(r.userNickname), fontWeight: 700 }}>{String(r.userNickname || '?')[0].toUpperCase()}</Avatar>}
          <span style={{ fontWeight: 600 }}>{r.userNickname}</span>
          {r.isSuperManager && <Tag color="red">超管</Tag>}
          {r.userId === user?.userId && <Tag>我</Tag>}
          <UserTitles titles={r.titles} size="sm" />
        </span>
      ),
    },
    { title: '注册', dataIndex: 'registTime', width: 150, search: false, render: (_, r) => fmt(r.registTime) },
    { title: '最近登录', dataIndex: 'lastLoginTime', width: 150, search: false, render: (_, r) => fmt(r.lastLoginTime) },
    { title: '权限 / 功能', search: false, render: (_, r) => summary(r) },
    { title: '', width: 40, align: 'center', search: false, render: () => <RightOutlined style={{ color: '#ccc' }} /> },
  ]

  return (
    <ProTable
      actionRef={actionRef}
      rowKey="userId"
      headerTitle="用户管理"
      columns={columns}
      search={{ labelWidth: 'auto' }}
      scroll={{ x: 'max-content' }}
      pagination={{ pageSize: 20 }}
      onRow={(r) => ({ onClick: () => navigate(`/admin/users/${r.userId}`), style: { cursor: 'pointer' } })}
      request={async (params) => {
        const res = await userApi.adminList({
          page: params.current,
          limit: params.pageSize,
          keyword: params.userNickname || undefined,
        })
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
    />
  )
}
