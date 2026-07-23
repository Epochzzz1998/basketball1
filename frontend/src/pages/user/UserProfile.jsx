import { useEffect, useRef, useState } from 'react'
import {
  Avatar, Button, Card, Col, Empty, Form, Grid, Input, List, Modal, Popconfirm,
  Row, Select, Space, Spin, Statistic, Switch, Tabs, Tag, Upload, message,
} from 'antd'
import { CameraOutlined, CheckOutlined, CommentOutlined, EditOutlined, LikeOutlined, LockOutlined, MessageOutlined, PlusOutlined, StopOutlined, TrophyFilled } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { userApi } from '../../api/user'
import { followApi } from '../../api/follow'
import { blockApi } from '../../api/block'
import { searchApi } from '../../api/search'
import { useAuth } from '../../auth/AuthContext'
import UserTitles from '../../components/UserTitles'

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

function PostList({ posts, hidden }) {
  if (hidden) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该用户已隐藏发帖" />
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

function CommentTrail({ comments, hidden }) {
  if (hidden) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该用户已隐藏评论" />
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

// 关注/粉丝列表弹窗：行=头像+昵称+互关标，点击跳对方主页
function FollowListModal({ userId, tab, onClose, onTabChange }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!tab) return
    setRows(null)
    followApi.list(userId, tab).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [userId, tab])

  return (
    <Modal open={!!tab} footer={null} onCancel={onClose} title={null} width={420}>
      <Tabs
        activeKey={tab || 'following'}
        onChange={onTabChange}
        items={[{ key: 'following', label: '关注' }, { key: 'followers', label: '粉丝' }]}
      />
      {rows === null ? (
        <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
      ) : rows.length ? (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {rows.map((r) => (
            <div
              key={r.userId}
              onClick={() => { onClose(); navigate(`/users/${r.userId}`) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid #fafafa', cursor: 'pointer' }}
            >
              <Avatar size={34} src={r.avatar || undefined} style={{ background: '#fa541c', fontWeight: 700, flexShrink: 0 }}>
                {String(r.userNickname || '?')[0].toUpperCase()}
              </Avatar>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {r.userNickname}
              </span>
              {r.mutual && <Tag color="green" style={{ marginInlineEnd: 0 }}>互相关注</Tag>}
            </div>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tab === 'followers' ? '还没有粉丝' : '还没有关注任何人'} />
      )}
    </Modal>
  )
}

// 黑名单管理弹窗（仅本人）：列表 + 逐个解除
function BlocklistModal({ open, onClose }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!open) return
    setRows(null)
    blockApi.list().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [open])

  const unblock = async (userId) => {
    try {
      await blockApi.toggle(userId)
      setRows((list) => (list || []).filter((r) => r.userId !== userId))
      message.success('已解除拉黑')
    } catch { /* 拦截器已提示 */ }
  }

  return (
    <Modal open={open} footer={null} onCancel={onClose} title="黑名单管理" width={420}>
      {rows === null ? (
        <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
      ) : rows.length ? (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {rows.map((r) => (
            <div key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid #fafafa' }}>
              <Avatar size={34} src={r.avatar || undefined} style={{ background: '#999', fontWeight: 700, flexShrink: 0 }}>
                {String(r.userNickname || '?')[0].toUpperCase()}
              </Avatar>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {r.userNickname}
              </span>
              <Button size="small" onClick={() => unblock(r.userId)}>解除拉黑</Button>
            </div>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="黑名单是空的" />
      )}
      <div style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>被拉黑的用户无法给你发私信、无法关注你；帖子和评论互相仍可见。</div>
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
  const [followTab, setFollowTab] = useState(null)
  const [blocklistOpen, setBlocklistOpen] = useState(false) // 本人黑名单管理弹窗 // null=关 | 'following' | 'followers'（关注/粉丝列表弹窗）
  const [editForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  const isSelf = !!me && me.userId === userId
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md // < 768px：横幅缩小、操作按钮挪到下方一行


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

  const { user, stats, posts, comments, postsHidden, commentsHidden, followerCount, followingCount, following, blockedByMe } = data
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

  // 主页隐私：即改即存（隐藏后他人主页看不到，本人仍可见）
  const togglePrivacy = async (field, checked) => {
    try {
      await userApi.setActivityPrivacy({ [field]: checked ? '1' : '0' })
      message.success('已保存')
      load()
    } catch (e) {
      message.error(e?.msg || '保存失败')
    }
  }

  // 关注/取关：接口回最新状态，就地更新 data（不整页刷）
  const toggleFollow = async () => {
    try {
      const res = await followApi.toggle(userId)
      setData((d) => (d ? { ...d, following: res.following, followerCount: res.followerCount } : d))
      message.success(res.following ? '已关注' : '已取消关注')
    } catch { /* 拦截器已提示 */ }
  }

  // 拉黑/解除：拉黑会自动解除双向关注（后端处理），本地同步刷新状态
  const toggleBlock = async () => {
    try {
      const res = await blockApi.toggle(userId)
      setData((d) => (d ? { ...d, blockedByMe: res.blocked, ...(res.blocked ? { following: false } : {}) } : d))
      message.success(res.blocked ? '已拉黑，对方无法再私信或关注你' : '已解除拉黑')
    } catch { /* 拦截器已提示 */ }
  }

  // 横幅操作按钮：本人=编辑资料/改密码；他人=关注 + 发私信 + 拉黑。桌面绝对定位右上角，移动端挪到横幅下方
  const actionBtns = isSelf ? (
    <>
      <Button ghost size="small" icon={<EditOutlined />} onClick={() => { editForm.setFieldsValue({ userNickname: displayName }); setEditOpen(true) }}>
        编辑资料
      </Button>
      <Button ghost size="small" icon={<LockOutlined />} onClick={() => setPwdOpen(true)}>
        修改密码
      </Button>
    </>
  ) : me ? (
    <>
      <Button
        ghost={!following}
        size="small"
        icon={following ? <CheckOutlined /> : <PlusOutlined />}
        onClick={toggleFollow}
        style={following ? { background: 'rgba(255,255,255,.28)', borderColor: 'transparent', color: '#fff' } : undefined}
      >
        {following ? '已关注' : '关注'}
      </Button>
      <Button ghost size="small" icon={<MessageOutlined />} onClick={() => navigate(`/messages?peerId=${userId}`)}>
        发私信
      </Button>
      <Popconfirm
        title={blockedByMe ? '解除拉黑该用户？' : '拉黑该用户？'}
        description={blockedByMe ? undefined : '拉黑后对方无法私信或关注你，并解除你们的相互关注'}
        okText={blockedByMe ? '解除' : '拉黑'}
        okButtonProps={blockedByMe ? undefined : { danger: true }}
        onConfirm={toggleBlock}
      >
        <Button ghost size="small" icon={<StopOutlined />} style={{ opacity: blockedByMe ? 1 : 0.75 }}>
          {blockedByMe ? '已拉黑' : '拉黑'}
        </Button>
      </Popconfirm>
    </>
  ) : null

  return (
    <>
      {/* 渐变横幅：身份区。桌面按钮在右上角；移动端缩小尺寸、按钮挪到下方一行，避免挤在一起 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fa541c 0%, #ff7a45 55%, #ffa940 100%)',
          borderRadius: 12, padding: isMobile ? '20px 18px 36px' : '30px 30px 52px', color: '#fff', position: 'relative',
        }}
      >
        {!isMobile && actionBtns && (
          <Space style={{ position: 'absolute', top: 18, right: 20 }}>{actionBtns}</Space>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 20 }}>
          <Avatar
            size={isMobile ? 58 : 76}
            src={user.avatar || undefined}
            style={{ background: '#fff', color: '#fa541c', fontWeight: 800, fontSize: isMobile ? 26 : 32, flexShrink: 0 }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Space size={8} wrap align="center">
              <span style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700 }}>{displayName}</span>
              {role && <Tag color={role.color}>{role.label}</Tag>}
              {verified && user.playerId && (
                <Tag color="gold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/players/${user.playerId}`)}>
                  <TrophyFilled /> 认证球员{user.playerName ? ` · ${user.playerName}` : ''}
                </Tag>
              )}
              <UserTitles titles={user.titles} />
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
            <div style={{ opacity: 0.9, marginTop: 6, fontSize: isMobile ? 13 : 14 }}>@{user.userName}</div>
            <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
              加入于 {fmtDate(user.registTime)} · 最近活跃 {fmtDate(user.lastLoginTime)}
              {verified && user.checkTime ? ` · 认证于 ${fmtDate(user.checkTime)}` : ''}
            </div>
          </div>
        </div>
        {isMobile && actionBtns && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>{actionBtns}</div>
        )}
      </div>

      {/* 悬浮统计条 */}
      <Card style={{ margin: isMobile ? '-24px 10px 14px' : '-34px 22px 16px', borderRadius: 12 }} styles={{ body: { padding: isMobile ? '14px 12px' : '16px 24px' } }}>
        <Row gutter={16}>
          <Col xs={8} sm={4}><Statistic title="发帖" value={stats.posts ?? 0} /></Col>
          <Col xs={8} sm={4}><Statistic title="评论" value={stats.comments ?? 0} /></Col>
          <Col xs={8} sm={4}>
            <Statistic title="获赞" value={stats.likes ?? 0} valueStyle={{ color: '#fa541c' }} prefix={<LikeOutlined />} />
          </Col>
          <Col xs={8} sm={4}>
            <div onClick={() => setFollowTab('following')} style={{ cursor: 'pointer' }} title="查看关注列表">
              <Statistic title="关注" value={followingCount ?? 0} />
            </div>
          </Col>
          <Col xs={8} sm={4}>
            <div onClick={() => setFollowTab('followers')} style={{ cursor: 'pointer' }} title="查看粉丝列表">
              <Statistic title="粉丝" value={followerCount ?? 0} />
            </div>
          </Col>
          <Col xs={8} sm={4}><Statistic title="加入天数" value={daysSince(user.registTime)} /></Col>
        </Row>
      </Card>

      {/* 关注/粉丝列表 */}
      <FollowListModal userId={userId} tab={followTab} onClose={() => setFollowTab(null)} onTabChange={setFollowTab} />

      {/* 黑名单管理（仅本人） */}
      {isSelf && <BlocklistModal open={blocklistOpen} onClose={() => setBlocklistOpen(false)} />}

      {/* 内容区 */}
      <Card styles={{ body: { padding: '8px 20px 16px' } }}>
        {/* 本人：主页隐私开关（隐藏后他人看不到，自己仍可见） */}
        {isSelf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '6px 4px 12px', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>主页隐私</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Switch size="small" checked={!!user.hidePosts} onChange={(c) => togglePrivacy('hidePosts', c)} />
              <span style={{ fontSize: 13 }}>隐藏我的发帖</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Switch size="small" checked={!!user.hideComments} onChange={(c) => togglePrivacy('hideComments', c)} />
              <span style={{ fontSize: 13 }}>隐藏我的评论</span>
            </span>
            <span style={{ fontSize: 12, color: '#bbb' }}>仅对他人隐藏，你自己仍能看到</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#8c8c8c' }}>谁能私信我</span>
              <Select
                size="small"
                value={user.pmPolicy === 'following' ? 'following' : 'all'}
                style={{ width: 138 }}
                options={[{ value: 'all', label: '所有人' }, { value: 'following', label: '仅我关注的人' }]}
                onChange={async (v) => {
                  try { await userApi.setPmPolicy(v); message.success('已保存'); load() } catch { /* 已提示 */ }
                }}
              />
            </span>
            <a style={{ fontSize: 13 }} onClick={() => setBlocklistOpen(true)}>黑名单管理</a>
          </div>
        )}
        <Tabs
          defaultActiveKey="posts"
          items={[
            { key: 'posts', label: `${isSelf ? '我' : '他'}的帖子（${stats.posts ?? 0}）`, children: <PostList posts={posts} hidden={postsHidden} /> },
            { key: 'comments', label: `${isSelf ? '我' : '他'}的评论（${stats.comments ?? 0}）`, children: <CommentTrail comments={comments} hidden={commentsHidden} /> },
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
