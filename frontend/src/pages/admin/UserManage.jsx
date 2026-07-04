import { useRef } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Avatar, Switch, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { userApi } from '../../api/user'
import { useAuth } from '../../auth/AuthContext'

/**
 * 全局用户管理（超级管理员）。管理所有注册用户的**全局**权限（不是某个专题）：
 * 是否可登录 / 浏览论坛新闻 / 发言 / 发帖。超管账号与自己不可修改。
 * 每个开关即改即存（POST /user/setUserPerms）。
 */

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—')
const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

export default function UserManage() {
  const { user } = useAuth()
  const actionRef = useRef()

  // 改一个开关：locked（超管/自己）不可改
  const toggle = async (row, field, checked) => {
    try {
      await userApi.setUserPerms({ userId: row.userId, [field]: checked ? '1' : '0' })
      message.success('已保存')
      actionRef.current?.reload()
    } catch { /* 拦截器已提示 */ }
  }

  const permSwitch = (row, field, value) => {
    const locked = row.isSuperManager || row.userId === user?.userId
    return (
      <Switch
        size="small"
        checked={value}
        disabled={locked}
        onChange={(c) => toggle(row, field, c)}
      />
    )
  }

  const columns = [
    {
      title: '用户', dataIndex: 'userNickname', ellipsis: true,
      render: (_, r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {r.avatar
            ? <Avatar size={28} src={r.avatar} />
            : <Avatar size={28} style={{ background: avatarColor(r.userNickname), fontWeight: 700 }}>{String(r.userNickname || '?')[0].toUpperCase()}</Avatar>}
          <span>{r.userNickname}</span>
          {r.isSuperManager && <Tag color="red">超管</Tag>}
          {r.userId === user?.userId && <Tag>我</Tag>}
        </span>
      ),
    },
    { title: '姓名', dataIndex: 'userName', width: 120, search: false, render: (v) => v || '—' },
    { title: '注册', dataIndex: 'registTime', width: 150, search: false, render: (_, r) => fmt(r.registTime) },
    { title: '最近登录', dataIndex: 'lastLoginTime', width: 150, search: false, render: (_, r) => fmt(r.lastLoginTime) },
    { title: '可登录', dataIndex: 'enabled', width: 80, align: 'center', search: false, render: (_, r) => permSwitch(r, 'enabled', r.enabled) },
    { title: '可浏览', dataIndex: 'canBrowse', width: 80, align: 'center', search: false, render: (_, r) => permSwitch(r, 'canBrowse', r.canBrowse) },
    { title: '可发言', dataIndex: 'canComment', width: 80, align: 'center', search: false, render: (_, r) => permSwitch(r, 'canComment', r.canComment) },
    { title: '可发帖', dataIndex: 'canPost', width: 80, align: 'center', search: false, render: (_, r) => permSwitch(r, 'canPost', r.canPost) },
  ]

  return (
    <ProTable
      actionRef={actionRef}
      rowKey="userId"
      headerTitle="用户管理"
      columns={columns}
      search={{ labelWidth: 'auto' }}
      pagination={{ pageSize: 20 }}
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
