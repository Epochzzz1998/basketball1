import { useEffect, useRef, useState } from 'react'
import { Avatar, Checkbox, Form, Input, Modal, Radio, Select, Switch, message } from 'antd'
import { topicApi } from '../api/topic'
import { searchApi } from '../api/search'
import { useAuth } from '../auth/AuthContext'

/**
 * 建 / 改专题弹窗。
 * - 建（admin）：名称/简介 + 指定 owner + 公开性 + 公开专题的"开放发帖/发言"；
 * - 改（admin 或 owner，传 topic）：改设置（owner 不在这里改）。
 * 公开=人人可浏览、默认只限白名单发帖发言；勾"开放发帖/发言"则任何登录用户都能发。
 */

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

export default function TopicEditModal({ open, onClose, onSaved, topic }) {
  const isEdit = !!topic
  const { user } = useAuth()
  const isSuper = !!user?.isSuperManager // 超管建专题可代指定 owner；普通用户创建后自己即题主
  const [form] = Form.useForm()
  const [visibility, setVisibility] = useState('public')
  const [opts, setOpts] = useState([])
  const [saving, setSaving] = useState(false)
  const timer = useRef()

  useEffect(() => {
    if (!open) return
    if (isEdit) {
      form.setFieldsValue({
        name: topic.name, description: topic.description,
        visibility: topic.visibility, openPost: topic.openPost, openComment: topic.openComment,
        listed: topic.listed !== false,
      })
      setVisibility(topic.visibility || 'public')
    } else {
      form.resetFields()
      form.setFieldsValue({ visibility: 'public', openPost: false, openComment: false, listed: true })
      setVisibility('public')
    }
    setOpts([])
  }, [open, isEdit, topic, form])

  const search = (kw) => {
    clearTimeout(timer.current)
    if (!kw.trim()) return setOpts([])
    timer.current = setTimeout(async () => {
      try {
        const list = await searchApi.mentionUsers(kw)
        setOpts((list || []).map((u) => ({ value: u.userId, label: u.userNickname, avatar: u.avatar })))
      } catch { setOpts([]) }
    }, 250)
  }

  const submit = async () => {
    let v
    try { v = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      const payload = {
        name: v.name,
        description: v.description || '',
        visibility: v.visibility,
        listed: v.listed === false ? '0' : '1',
        openPost: v.visibility === 'public' && v.openPost ? '1' : '0',
        openComment: v.visibility === 'public' && v.openComment ? '1' : '0',
      }
      if (isEdit) {
        await topicApi.update({ topicId: topic.topicId, ...payload })
        message.success('已保存')
      } else {
        await topicApi.create({ ...payload, ownerId: v.ownerId })
        message.success('专题已创建')
      }
      onSaved?.()
      onClose()
    } catch { /* 拦截器已提示 */ } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      okText={isEdit ? '保存' : '创建'}
      title={isEdit ? '编辑专题' : '新建专题'}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item name="name" label="专题名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="如：读书交流区、资源分享区" maxLength={40} showCount />
        </Form.Item>
        <Form.Item name="description" label="简介">
          <Input.TextArea placeholder="一句话介绍这个专题" maxLength={200} autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        {!isEdit && isSuper && (
          <Form.Item name="ownerId" label="专题 owner（负责管理成员权限）" rules={[{ required: true, message: '请指定一个 owner' }]}>
            <Select
              showSearch
              filterOption={false}
              placeholder="搜索用户指定为 owner"
              onSearch={search}
              notFoundContent={null}
              options={opts.map((o) => ({
                value: o.value,
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {o.avatar ? <Avatar size={20} src={o.avatar} /> : <Avatar size={20} style={{ background: avatarColor(o.label), fontSize: 11 }}>{String(o.label || '?')[0].toUpperCase()}</Avatar>}
                    {o.label}
                  </span>
                ),
              }))}
            />
          </Form.Item>
        )}
        <Form.Item name="visibility" label="可见性">
          <Radio.Group onChange={(e) => setVisibility(e.target.value)}>
            <Radio value="public">公开（人人可浏览）</Radio>
            <Radio value="private">私密（仅授权成员可浏览）</Radio>
          </Radio.Group>
        </Form.Item>
        {visibility === 'public' && (
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>公开专题默认只有白名单成员能发帖/发言，可放开给所有人：</div>
            <Form.Item name="openPost" valuePropName="checked" noStyle>
              <Checkbox>允许所有登录用户发帖</Checkbox>
            </Form.Item>
            <Form.Item name="openComment" valuePropName="checked" noStyle>
              <Checkbox style={{ marginLeft: 16 }}>允许所有登录用户发言</Checkbox>
            </Form.Item>
          </div>
        )}
        <Form.Item
          name="listed"
          label="在百家说中可见"
          valuePropName="checked"
          extra="关闭后：本专题不在百家说列表出现、帖子也不被全站搜索和首页热榜收录；题主、管理员、已加入成员仍能在列表看到并进入。"
          style={{ marginTop: 12 }}
        >
          <Switch checkedChildren="可见" unCheckedChildren="隐藏" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
