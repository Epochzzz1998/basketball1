import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Divider, Select, Spin, Switch, Tag, message } from 'antd'
import { ArrowLeftOutlined, CrownFilled, TrophyFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import { userApi } from '../../api/user'
import { useAuth } from '../../auth/AuthContext'

/**
 * 用户管理详情页（超级管理员，/admin/users/:userId）。
 * 从用户列表点进来，逐项管理一个用户：账号/动作权限/功能模块（开关，即改即存），以及**头衔**（可多个，honorific）。
 * 权限开关对超管和自己锁定；头衔是荣誉标签、非权限，可给任何人（含超管/自己）加。
 */

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—')
const titleList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)
const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

export default function UserManageDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => userApi.adminDetail(userId).then(setData).catch(() => setData(null))
  useEffect(() => { load() /* eslint-disable-next-line */ }, [userId])

  if (data === null) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />

  const locked = data.isSuperManager || data.userId === me?.userId // 权限开关：超管/自己不可改

  const setPerm = async (field, checked) => {
    setData((d) => ({ ...d, [field]: checked })) // 乐观
    try {
      await userApi.setUserPerms({ userId, [field]: checked ? '1' : '0' })
      message.success('已保存')
    } catch {
      load() // 失败回滚
    }
  }

  const saveTitles = async (arr) => {
    setData((d) => ({ ...d, titles: arr.join(',') })) // 乐观
    setSaving(true)
    try {
      await userApi.setUserTitles(userId, arr.join(','))
      message.success('头衔已更新')
    } catch {
      load()
    } finally {
      setSaving(false)
    }
  }

  const permRow = (label, field, desc) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {desc && <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{desc}</span>}
      </div>
      <Switch checked={!!data[field]} disabled={locked} onChange={(c) => setPerm(field, c)} />
    </div>
  )

  return (
    <>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/users')} style={{ paddingLeft: 0, marginBottom: 8 }}>
        返回用户列表
      </Button>

      {/* 身份卡 */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {data.avatar
            ? <Avatar size={64} src={data.avatar} />
            : <Avatar size={64} style={{ background: avatarColor(data.userNickname), fontWeight: 800, fontSize: 26 }}>{String(data.userNickname || '?')[0].toUpperCase()}</Avatar>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {data.userNickname}
              {data.isSuperManager && <Tag color="red"><CrownFilled /> 超管</Tag>}
              {data.verified && (
                <Tag color="gold" style={{ cursor: data.playerId ? 'pointer' : 'default' }} onClick={() => data.playerId && navigate(`/players/${data.playerId}`)}>
                  <TrophyFilled /> 认证球员
                </Tag>
              )}
              {data.userId === me?.userId && <Tag>我</Tag>}
            </div>
            <div style={{ color: '#999', fontSize: 13, marginTop: 6 }}>
              登录名 {data.loginName || '—'} · 注册 {fmt(data.registTime)} · 最近登录 {fmt(data.lastLoginTime)}
            </div>
          </div>
        </div>
      </Card>

      {/* 头衔 */}
      <Card
        title="头衔"
        style={{ borderRadius: 12, marginBottom: 16 }}
        extra={<span style={{ color: '#999', fontSize: 12 }}>可多个，展示在用户名旁（与认证球员并存）</span>}
      >
        <Select
          mode="tags"
          style={{ width: '100%' }}
          value={titleList(data.titles)}
          onChange={saveTitles}
          loading={saving}
          placeholder="输入头衔后回车添加，如：元老、技术大牛、活跃之星"
          tokenSeparators={[',', '，']}
          maxTagCount={10}
        />
      </Card>

      {/* 账号与动作权限 */}
      <Card title="账号与权限" style={{ borderRadius: 12, marginBottom: 16 }}>
        {locked && <div style={{ color: '#faad14', fontSize: 12, marginBottom: 4 }}>超级管理员和你自己的权限不可修改</div>}
        {permRow('允许登录', 'enabled')}
        <Divider style={{ margin: '2px 0' }} />
        {permRow('浏览论坛 / 新闻', 'canBrowse')}
        {permRow('发言（评论）', 'canComment')}
        {permRow('发帖', 'canPost')}
      </Card>

      {/* 功能模块 */}
      <Card title="功能模块" style={{ borderRadius: 12 }} extra={<span style={{ color: '#999', fontSize: 12 }}>关掉则该用户导航里整块隐藏、深链也进不去</span>}>
        {permRow('数据分析', 'featData', 'Dream Union：数据概览 / 联盟排行 / 球员对比')}
        {permRow('新闻', 'featNews')}
        {permRow('百家说', 'featForum')}
        {permRow('私信', 'featPm')}
      </Card>
    </>
  )
}
