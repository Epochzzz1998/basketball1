import { useState } from 'react'
import { Button, Input, Modal, Tag, message } from 'antd'
import { CheckCircleOutlined, UserAddOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { topicApi } from '../api/topic'
import { useAuth } from '../auth/AuthContext'

/**
 * 申请加入/申请权限按钮（自决显隐 + 上下文文案）：
 * - 管理者(owner/admin) 或已拥有全部权限 → 不渲染；
 * - 无浏览权（私密未加入）→「申请加入」；
 * - 有浏览、缺发言/发帖 →「申请发言/发帖权限」等（按缺什么显示）；
 * - 已提交申请 →「申请审核中」标签。
 * 具体给哪些权限由 owner 审批时勾选决定，这里只发起申请（可带留言）。
 */
export default function TopicApplyButton({ topic, onApplied, banner, block, size }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  if (!topic || topic.canManage) return null
  const needView = !topic.canView
  const needComment = topic.canView && !topic.canComment
  const needPost = topic.canView && !topic.canPost
  if (!needView && !needComment && !needPost) return null // 已有全部权限，无需申请

  if (topic.myRequestPending) {
    return <Tag icon={<CheckCircleOutlined />} color={banner ? 'default' : 'orange'}>申请审核中</Tag>
  }

  const label = needView ? '申请加入'
    : needComment && needPost ? '申请发言 / 发帖权限'
      : needPost ? '申请发帖权限'
        : '申请发言权限'

  const submit = async () => {
    setSaving(true)
    try {
      await topicApi.apply(topic.topicId, msg.trim())
      message.success('已提交申请，等待审批')
      setOpen(false)
      setMsg('')
      onApplied?.()
    } catch { /* 拦截器已提示 */ } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type={banner ? 'default' : 'primary'}
        block={block}
        size={size}
        icon={<UserAddOutlined />}
        onClick={() => (user ? setOpen(true) : navigate('/login'))}
        style={banner ? { fontWeight: 600, flexShrink: 0 } : undefined}
      >
        {user ? label : '登录后申请'}
      </Button>
      <Modal open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} okText="提交申请" title={`${label}「${topic?.name || ''}」`}>
        <Input.TextArea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="给专题 owner 留句话，说明你想要的权限（可选）"
          maxLength={200}
          autoSize={{ minRows: 3, maxRows: 5 }}
        />
      </Modal>
    </>
  )
}
