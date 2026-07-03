import { useEffect, useState } from 'react'
import { Button, Card, Popconfirm, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined, TrophyFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { userApi } from '../../api/user'

/**
 * 球员认证审核（superManager）：列出待审核的绑定申请，通过 → 用户获得认证球员徽章；
 * 驳回 → 清空该用户的绑定。同一球员只允许一个已认证账号（后端双重校验）。
 */

const fmt = (v) => {
  if (!v) return '-'
  const t = new Date(v)
  if (Number.isNaN(t.getTime())) return String(v).slice(0, 10)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

export default function VerifyBindings() {
  const [rows, setRows] = useState(null)
  const [acting, setActing] = useState(null) // 正在处理的 userId

  const load = () => {
    setRows(null)
    userApi.bindings()
      .then((r) => setRows(r || []))
      .catch(() => { setRows([]); message.error('加载失败') })
  }

  useEffect(load, [])

  const review = async (userId, approve) => {
    setActing(userId)
    try {
      const res = await userApi.reviewBinding(userId, approve)
      message.success(res?.msg || '已处理')
      load()
    } catch (e) {
      message.error(e?.msg || '操作失败')
    } finally {
      setActing(null)
    }
  }

  const columns = [
    {
      title: '申请用户',
      render: (_, r) => (
        <Space size={6}>
          <Link to={`/users/${r.userId}`}><b>{r.userNickname || r.userName}</b></Link>
          <span style={{ color: '#999', fontSize: 12 }}>@{r.userName}</span>
        </Space>
      ),
    },
    {
      title: '申请绑定球员',
      render: (_, r) => (
        <Space size={6}>
          <Tag color="volcano">#{r.playerNumber ?? '-'}</Tag>
          <Link to={`/players/${r.playerId}`}><b>{r.playerName || r.playerId}</b></Link>
        </Space>
      ),
    },
    { title: '申请时间', dataIndex: 'applyTime', width: 170, render: fmt },
    {
      title: '操作', width: 170,
      render: (_, r) => (
        <Space>
          <Popconfirm title={`确认通过「${r.userNickname || r.userName}」的认证？`} onConfirm={() => review(r.userId, true)}>
            <Button type="primary" size="small" loading={acting === r.userId} icon={<TrophyFilled />}>通过</Button>
          </Popconfirm>
          <Popconfirm title="驳回并清空该用户的绑定？" onConfirm={() => review(r.userId, false)}>
            <Button danger size="small" loading={acting === r.userId}>驳回</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="球员认证审核"
      extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}
      styles={{ body: { padding: '4px 12px 12px' } }}
    >
      <Table
        className="clean-table"
        rowKey="userId"
        loading={rows === null}
        dataSource={rows || []}
        columns={columns}
        pagination={false}
        locale={{ emptyText: '暂无待审核申请' }}
      />
    </Card>
  )
}
