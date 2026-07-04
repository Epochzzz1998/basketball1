import { useEffect, useRef, useState } from 'react'
import {
  Avatar, Button, Card, Col, Empty, Form, Input, List, Modal, Popconfirm,
  Row, Select, Space, Spin, Statistic, Tabs, Tag, Upload, message,
} from 'antd'
import { CameraOutlined, CommentOutlined, EditOutlined, LikeOutlined, LockOutlined, MessageOutlined, TrophyFilled } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { userApi } from '../../api/user'
import { searchApi } from '../../api/search'
import { useAuth } from '../../auth/AuthContext'

/**
 * 用户主页（/users/:userId，公开）。他人视角：资料横幅 + 统计条 + 帖子/评论。
 * 本人视角额外：编辑昵称、修改密码、球员认证绑定（申请 → 超管审核 → 认证徽章）。
 * 认证三态 identStatus：0 未认证 / 2 审核中 / 1 已认证。
 */

const ROLE_META = {
  superManager: { label: '超级管理员', color: 'gold' },
  manager: { label: '管理员', color: 'geekblue' },
}

const fmtDate = (v) => {
  if (!v) return '-'
  const t = new Date(v)
  if (Number.isNaN(t.getTime())) return String(v).slice(0, 10)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}

const daysSince = (v) => {
  if (!v) return '-'
  const t = new Date(v)
  if (Number.isNaN(t.getTime())) return '-'
  return Math.max(1, Math.floor((Date.now() - t.getTime()) / 86400000))
}

function PostList({ posts }) {
  if (!posts?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有发过帖子" />
  return (
    <List
      dataSource={posts}
      renderItem={(p) => (
        <List.Item
          style={{ padding: '12px 4px' }}
          extra={
            <Space size={14} style={{ color: '#999', fontSize: 13, whiteSpace: 'nowrap' }}>
              <span><LikeOutlined /> {p.goodNum ?? 0}</span>
              <span><CommentOutlined /> {p.commentNum ?? 0}</span>
              <span>{fmtDate(p.publishDate)}</span>
            </Space>
          }
        >
          <Space size={8} style={{ minWidth: 0 }}>
            {p.newsChannel === 'official'
              ? <Tag color="orange" style={{ flexShrink: 0 }}>官方</Tag>
              : <Tag style={{ flexShrink: 0 }}>论坛</Tag>}
            <Link
              to={`/news/${p.newsId}`}
              style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {p.title}
            </Link>
          </Space>
        </List.Item>
      )}
    />
  )
}

function CommentTrail({ comments }) {
  if (!comments?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有发表过评论" />
  return (
    <List
      dataSource={comments}
      renderItem={(c) => (
        <List.Item style={{ padding: '12px 4px', display: 'block' }}>
          <div
            style={{
              fontSize: 14, lineHeight: 1.6, display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {Number(c.level) > 1 && <Tag color="cyan" style={{ marginRight: 6 }}>回复</Tag>}
            {c.content}
          </div>
          <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
            {c.newsTitle
              ? <>在 <Link to={`/news/${c.newsId}`}>《{c.newsTitle}》</Link> 下</>
              : <span>原帖已删除</span>}
            <span style={{ margin: '0 8px' }}>·</span>{fmtDate(c.commentDate)}
            <span style={{ margin: '0 8px' }}>·</span><LikeOutlined /> {c.goodNum ?? 0}
          </div>
        </List.Item>
      )}
    />
  )
}

/** 绑定球员弹窗：搜索球员（复用全局搜索接口）→ 提交认证申请 */
function BindPlayerModal({ open, onCancel, onDone }) {
  const [opts, setOpts] = useState([])
  const [val, setVal] = useState()
  const [saving, setSaving] = useState(false)
  const timer = useRef()

  const search = (kw) => {
    clearTimeout(timer.current)
    const k = kw.trim()
    if (!k) return setOpts([])
    timer.current = setTimeout(async () => {
      try {
        const d = await searchApi.globalSearch(k)
        setOpts((d?.players || []).map((p) => ({
          value: p.playerId,
          label: `#${p.playerNumber ?? '-'}  ${p.playerName}`,
        })))
      } catch {
        setOpts([])
      }
    }, 300)
  }

  const submit = async () => {
    if (!val) return message.warning('请先选择球员')
    setSaving(true)
    try {
      const res = await userApi.bindPlayer(val)
      message.success(res?.msg || '已提交认证申请')
      setVal(undefined)
      setOpts([])
      onDone()
    } catch (e) {
      message.error(e?.msg || '提交失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="绑定球员（需超级管理员审核）" open={open} onCancel={onCancel} onOk={submit} confirmLoading={saving} okText="提交申请" destroyOnClose>
      <Select
        showSearch
        filterOption={false}
        onSearch={search}
        options={opts}
        value={val}
        onChange={setVal}
        placeholder="输入球员姓名搜索"
        style={{ width: '100%' }}
        notFoundContent={null}
      />
      <p style={{ color: '#999', fontSize: 12, marginTop: 12, lineHeight: 1.7 }}>
        提交后进入「审核中」状态；超级管理员通过后，你的资料卡与评论区将展示
        <Tag color="gold" style={{ margin: '0 4px' }}><TrophyFilled /> 认证球员</Tag>标识。
        同一球员只能被一个账号认证。
      </p>
    </Modal>
  )
}

export default function UserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: me, refresh: refreshAuth } = useAuth()
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [bindOpen, setBindOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)     // 暂存的新头像，点"保存"才上传
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [editForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  const isSelf = !!me && me.userId === userId


  const load = () => {
    userApi.profile(userId)
      .then((d) => (d?.user ? setData(d) : setFailed(true)))
      .catch(() => setFailed(true))
  }

  useEffect(() => {
    let alive = true
    setData(null)
    setFailed(false)
    userApi.profile(userId)
      .then((d) => { if (alive) (d?.user ? setData(d) : setFailed(true)) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [userId])

  if (failed) {
    return (
      <Card>
        <Empty description="用户不存在或已注销">
          <Button onClick={() => navigate(-1)}>← 返回</Button>
        </Empty>
      </Card>
    )
  }
  if (data === null) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />

  const { user, stats, posts, comments } = data
  const role = ROLE_META[user.userRole]
  const displayName = user.userNickname || user.userName
  const verified = user.identStatus === 1
  const pending = user.identStatus === 2

  const closeEdit = () => {
    setEditOpen(false)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  // 保存 = （有新头像则先传）+ 更新昵称；应用内刷新（主页数据 + 顶栏），不整页 reload
  const saveEdit = async () => {
    const { userNickname } = await editForm.validateFields()
    setSaving(true)
    try {
      if (avatarFile) {
        await userApi.uploadAvatar(avatarFile)
      }
      const res = await userApi.updateProfile(userNickname.trim())
      message.success(res?.msg || '已更新')
      closeEdit()
      load()
      refreshAuth()
    } catch (e) {
      message.error(e?.msg || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async () => {
    const v = await pwdForm.validateFields()
    try {
      const res = await userApi.changePassword(v.oldPassword, v.newPassword)
      message.success(res?.msg || '密码已修改')
      setPwdOpen(false)
      pwdForm.resetFields()
    } catch (e) {
      message.error(e?.msg || '修改失败')
    }
  }

  const unbind = async () => {
    try {
      const res = await userApi.unbindPlayer()
      message.success(res?.msg || '已解除')
      load()
    } catch (e) {
      message.error(e?.msg || '操作失败')
    }
  }

  return (
    <>
      {/* 渐变横幅：身份区（本人视角右上角有编辑入口） */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fa541c 0%, #ff7a45 55%, #ffa940 100%)',
          borderRadius: 12, padding: '30px 30px 52px', color: '#fff', position: 'relative',
        }}
      >
        {isSelf && (
          <Space style={{ position: 'absolute', top: 18, right: 20 }}>
            <Button ghost size="small" icon={<EditOutlined />} onClick={() => { editForm.setFieldsValue({ userNickname: displayName }); setEditOpen(true) }}>
              编辑资料
            </Button>
            <Button ghost size="small" icon={<LockOutlined />} onClick={() => setPwdOpen(true)}>
              修改密码
            </Button>
          </Space>
        )}
        {!isSelf && me && (
          <Button
            ghost
            size="small"
            icon={<MessageOutlined />}
            style={{ position: 'absolute', top: 18, right: 20 }}
            onClick={() => navigate(`/messages?peerId=${userId}`)}
          >
            发私信
          </Button>
        )}
        <Space size={20} align="center">
          <Avatar
            size={76}
            src={user.avatar || undefined}
            style={{ background: '#fff', color: '#fa541c', fontWeight: 800, fontSize: 32 }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <Space size={10} wrap align="center">
              <span style={{ fontSize: 26, fontWeight: 700 }}>{displayName}</span>
              {role && <Tag color={role.color}>{role.label}</Tag>}
              {verified && user.playerId && (
                <Tag color="gold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/players/${user.playerId}`)}>
                  <TrophyFilled /> 认证球员{user.playerName ? ` · ${user.playerName}` : ''}
                </Tag>
              )}
              {isSelf && pending && (
                <>
                  <Tag color="orange">认证审核中{user.playerName ? ` · ${user.playerName}` : ''}</Tag>
                  <Popconfirm title="撤销这次认证申请？" onConfirm={unbind}>
                    <a style={{ color: '#fff', textDecoration: 'underline', fontSize: 12 }}>撤销</a>
                  </Popconfirm>
                </>
              )}
              {isSelf && !verified && !pending && (
                <Tag
                  style={{ background: 'transparent', borderStyle: 'dashed', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setBindOpen(true)}
                >
                  + 绑定球员
                </Tag>
              )}
              {isSelf && verified && (
                <Popconfirm title="解除球员绑定？解除后需重新申请认证。" onConfirm={unbind}>
                  <a style={{ color: '#fff', textDecoration: 'underline', fontSize: 12 }}>解绑</a>
                </Popconfirm>
              )}
            </Space>
            <div style={{ opacity: 0.9, marginTop: 6, fontSize: 14 }}>@{user.userName}</div>
            <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
              加入于 {fmtDate(user.registTime)} · 最近活跃 {fmtDate(user.lastLoginTime)}
              {verified && user.checkTime ? ` · 认证于 ${fmtDate(user.checkTime)}` : ''}
            </div>
          </div>
        </Space>
      </div>

      {/* 悬浮统计条 */}
      <Card style={{ margin: '-34px 22px 16px', borderRadius: 12 }} styles={{ body: { padding: '16px 24px' } }}>
        <Row gutter={16}>
          <Col xs={12} sm={6}><Statistic title="发帖" value={stats.posts ?? 0} /></Col>
          <Col xs={12} sm={6}><Statistic title="评论" value={stats.comments ?? 0} /></Col>
          <Col xs={12} sm={6}>
            <Statistic title="获赞" value={stats.likes ?? 0} valueStyle={{ color: '#fa541c' }} prefix={<LikeOutlined />} />
          </Col>
          <Col xs={12} sm={6}><Statistic title="加入天数" value={daysSince(user.registTime)} /></Col>
        </Row>
      </Card>

      {/* 内容区 */}
      <Card styles={{ body: { padding: '8px 20px 16px' } }}>
        <Tabs
          defaultActiveKey="posts"
          items={[
            { key: 'posts', label: `${isSelf ? '我' : '他'}的帖子（${stats.posts ?? 0}）`, children: <PostList posts={posts} /> },
            { key: 'comments', label: `${isSelf ? '我' : '他'}的评论（${stats.comments ?? 0}）`, children: <CommentTrail comments={comments} /> },
          ]}
        />
      </Card>

      {/* 编辑资料：头像 + 昵称（头像先暂存，点"保存"才上传生效） */}
      <Modal title="编辑资料" open={editOpen} onCancel={closeEdit} onOk={saveEdit} okText="保存" confirmLoading={saving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item label="头像">
            <Space size={16} align="center">
              <Avatar
                size={64}
                src={avatarPreview || user.avatar || undefined}
                style={{ background: '#fff2ea', color: '#fa541c', fontWeight: 800, fontSize: 26 }}
              >
                {displayName.slice(0, 1).toUpperCase()}
              </Avatar>
              <Upload
                accept="image/*"
                maxCount={1}
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > 5 * 1024 * 1024) {
                    message.error('图片不能超过 5MB')
                    return Upload.LIST_IGNORE
                  }
                  if (avatarPreview) URL.revokeObjectURL(avatarPreview)
                  setAvatarFile(file)
                  setAvatarPreview(URL.createObjectURL(file))
                  return false // 不自动上传，点"保存"才提交
                }}
              >
                <Button icon={<CameraOutlined />}>选择新头像</Button>
              </Upload>
              <span style={{ color: '#999', fontSize: 12 }}>jpg/png/webp ≤ 5MB，点"保存"后生效</span>
            </Space>
          </Form.Item>
          <Form.Item
            name="userNickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }, { max: 20, message: '最多 20 个字符' }]}
          >
            <Input maxLength={20} showCount placeholder="新的昵称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码 */}
      <Modal title="修改密码" open={pwdOpen} onCancel={() => setPwdOpen(false)} onOk={savePassword} okText="确认修改" destroyOnClose>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password placeholder="原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, max: 32, message: '6-32 位' }]}
          >
            <Input.Password placeholder="新密码（6-32 位）" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  !v || getFieldValue('newPassword') === v ? Promise.resolve() : Promise.reject(new Error('两次输入不一致')),
              }),
            ]}
          >
            <Input.Password placeholder="再输一遍" />
          </Form.Item>
        </Form>
      </Modal>

      <BindPlayerModal open={bindOpen} onCancel={() => setBindOpen(false)} onDone={() => { setBindOpen(false); load() }} />
    </>
  )
}
