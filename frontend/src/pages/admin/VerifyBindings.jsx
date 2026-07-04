import { useEffect, useState } from 'react'
import { Button, Card, Popconfirm, Segmented, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined, TrophyFilled } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { userApi } from '../../api/user'

/**
 * 球员认证审核（superManager）：
 * - 待审核：列出待处理申请，通过 → 用户获得认证徽章；驳回 → 清空绑定。
 * - 历史记录：所有认证申请的处理记录（通过/驳回/撤销）+ 时间 + 审核人。
 * 同一球员只允许一个已认证账号（后端双重校验）。
 */

const fmt = (v) => {
  if (!v) return '-'
  const t = new Date(v)
  if (Number.isNaN(t.getTime())) return String(v).slice(0, 10)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

const STATUS_TAG = {
  pending: <Tag color="processing">审核中</Tag>,
  approved: <Tag color="success">已通过</Tag>,
  rejected: <Tag color="error">已驳回</Tag>,
  cancelled: <Tag>已撤销</Tag>,
}

const userCell = (r) => (
  <Space size={6}>
    <Link to={`/users/${r.userId}`}><b>{r.userNickname || r.userName || r.userId}</b></Link>
  </Space>
)
const playerCell = (r) => (r.playerId ? (
  <Space size={6}>
    <Tag color="volcano">#{r.playerNumber ?? '-'}</Tag>
    <Link to={`/players/${r.playerId}`}><b>{r.playerName || r.playerId}</b></Link>
  </Space>
) : <span style={{ color: '#ccc' }}>—</span>)

export default function VerifyBindings() {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState(null) // 待审核
  const [history, setHistory] = useState(null) // 历史
  const [acting, setActing] = useState(null)

  const loadPending = () => {
    setRows(null)
    userApi.bindings().then((r) => setRows(r || [])).catch(() => { setRows([]); message.error('加载失败') })
  }
  const loadHistory = () => {
    setHistory(null)
    userApi.verifyHistory({ page: 1, limit: 200 })
      .then((r) => setHistory(r?.records || []))
      .catch(() => { setHistory([]); message.error('加载失败') })
  }

  useEffect(() => {
    if (tab === 'pending') loadPending()
    else loadHistory()
  }, [tab])

  const review = async (userId, approve) => {
    setActing(userId)
    try {
      const res = await userApi.reviewBinding(userId, approve)
      message.success(res?.msg || '已处理')
      loadPending()
    } catch (e) {
      message.error(e?.msg || '操作失败')
    } finally {
      setActing(null)
    }
  }

  const pendingColumns = [
    { title: '申请用户', render: (_, r) => userCell(r) },
    { title: '申请绑定球员', render: (_, r) => playerCell(r) },
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

  const historyColumns = [
    { title: '用户', render: (_, r) => userCell(r) },
    { title: '球员', render: (_, r) => playerCell(r) },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => STATUS_TAG[v] || <Tag>{v}</Tag> },
    { title: '申请时间', dataIndex: 'applyTime', width: 160, render: fmt },
    { title: '处理时间', dataIndex: 'handleTime', width: 160, render: fmt },
    { title: '审核人', dataIndex: 'handlerName', width: 120, render: (v) => v || '—' },
  ]

  const refresh = () => (tab === 'pending' ? loadPending() : loadHistory())

  return (
    <Card
      title="球员认证审核"
      extra={<Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>}
      styles={{ body: { padding: '12px 12px' } }}
    >
      <Segmented
        style={{ marginBottom: 12 }}
        value={tab}
        onChange={setTab}
        options={[{ label: '待审核', value: 'pending' }, { label: '历史记录', value: 'history' }]}
      />
      {tab === 'pending' ? (
        <Table
          className="clean-table"
          rowKey="userId"
          loading={rows === null}
          dataSource={rows || []}
          columns={pendingColumns}
          pagination={false}
          locale={{ emptyText: '暂无待审核申请' }}
        />
      ) : (
        <Table
          className="clean-table"
          rowKey={(r, i) => `${r.userId}-${r.handleTime || r.applyTime}-${i}`}
          loading={history === null}
          dataSource={history || []}
          columns={historyColumns}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
          locale={{ emptyText: '暂无审核记录' }}
        />
      )}
    </Card>
  )
}
