import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Divider, Input, Popover, Spin, Switch, Tag, message } from 'antd'
import { ArrowLeftOutlined, CrownFilled, TrophyFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import { userApi } from '../../api/user'
import { useAuth } from '../../auth/AuthContext'
import { parseTitles, TITLE_PALETTE, TITLE_HEX } from '../../utils/titles'

/**
 * 用户管理详情页（超级管理员，/admin/users/:userId）。
 * 逐项管理一个用户：账号/动作权限/功能模块（开关，即改即存）+ **头衔**（可多个、可各自设颜色）。
 * 权限开关对超管和自己锁定；头衔是荣誉标签、非权限，可给任何人（含超管/自己）加。
 */

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—')
const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

/** 颜色小圆点选择板 */
function Swatches({ value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: 150 }}>
      {TITLE_PALETTE.map((c) => (
        <span
          key={c}
          title={c}
          onClick={() => onPick(c)}
          style={{
            width: 22, height: 22, borderRadius: '50%', background: TITLE_HEX[c], cursor: 'pointer',
            border: value === c ? '2px solid #333' : '2px solid #fff', boxShadow: '0 0 0 1px #eee',
          }}
        />
      ))}
    </div>
  )
}

export default function UserManageDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const [data, setData] = useState(null)
  const [titles, setTitles] = useState([]) // [{t,c}]
  const [newT, setNewT] = useState('')
  const [newC, setNewC] = useState('blue')

  const load = () => userApi.adminDetail(userId).then(setData).catch(() => setData(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [userId])
  useEffect(() => { setTitles(parseTitles(data?.titles)) }, [data?.titles])

  if (data === null) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />

  const locked = data.isSuperManager || data.userId === me?.userId // 权限开关：超管/自己不可改

  const setPerm = async (field, checked) => {
    setData((d) => ({ ...d, [field]: checked }))
    try {
      await userApi.setUserPerms({ userId, [field]: checked ? '1' : '0' })
      message.success('已保存')
    } catch {
      load()
    }
  }

  const commitTitles = async (arr) => {
    setTitles(arr) // 乐观（颜色来自色板、文字已限长去重，与后端规范化结果一致）
    try {
      await userApi.setUserTitles(userId, JSON.stringify(arr))
      message.success('头衔已更新')
    } catch {
      load()
    }
  }
  const addTitle = () => {
    const t = newT.trim()
    if (!t) return
    if (titles.some((x) => x.t === t)) { message.info('已有同名头衔'); return }
    if (titles.length >= 10) { message.info('最多 10 个头衔'); return }
    commitTitles([...titles, { t, c: newC }])
    setNewT('')
  }
  const removeTitle = (i) => commitTitles(titles.filter((_, idx) => idx !== i))
  const recolor = (i, c) => commitTitles(titles.map((x, idx) => (idx === i ? { ...x, c } : x)))

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
      {/* 身份卡（返回走外层布局的全局返回按钮） */}
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
      <Card title="头衔" style={{ borderRadius: 12, marginBottom: 16 }} extra={<span style={{ color: '#999', fontSize: 12 }}>可多个、可各自设颜色，与认证球员并存</span>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: 24 }}>
          {titles.length
            ? titles.map((item, i) => (
                <Popover key={item.t} trigger="click" title="改颜色" content={<Swatches value={item.c} onPick={(c) => recolor(i, c)} />}>
                  <Tag
                    color={TITLE_HEX[item.c] || '#1677ff'}
                    closable
                    onClose={(e) => { e.preventDefault(); removeTitle(i) }}
                    style={{ cursor: 'pointer', marginInlineEnd: 0, fontSize: 13, padding: '1px 8px' }}
                  >
                    {item.t}
                  </Tag>
                </Popover>
              ))
            : <span style={{ color: '#bbb' }}>暂无头衔</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input value={newT} onChange={(e) => setNewT(e.target.value)} onPressEnter={addTitle} placeholder="输入头衔文字" maxLength={20} style={{ width: 200 }} />
          <Popover trigger="click" title="选颜色" content={<Swatches value={newC} onPick={setNewC} />}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 10px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: TITLE_HEX[newC] }} /> 颜色
            </span>
          </Popover>
          <Button type="primary" ghost onClick={addTitle}>添加</Button>
        </div>
        <div style={{ color: '#bbb', fontSize: 12, marginTop: 8 }}>点头衔可改颜色，× 删除；最多 10 个。</div>
      </Card>

      {/* 账号与动作权限 */}
      <Card title="账号与权限" style={{ borderRadius: 12, marginBottom: 16 }}>
        {locked && <div style={{ color: '#faad14', fontSize: 12, marginBottom: 4 }}>超级管理员和你自己的权限不可修改</div>}
        {permRow('允许登录', 'enabled')}
        <Divider style={{ margin: '2px 0' }} />
        {permRow('浏览论坛 / 新闻', 'canBrowse')}
        {permRow('发言（评论）', 'canComment')}
        {permRow('发帖', 'canPost')}
        {permRow('创建专题', 'canCreateTopic', '默认允许，每人最多 5 个；创建后本人自动成为题主')}
      </Card>

      {/* 功能模块 */}
      <Card title="功能模块" style={{ borderRadius: 12 }} extra={<span style={{ color: '#999', fontSize: 12 }}>关掉则该用户导航里整块隐藏、深链也进不去</span>}>
        {permRow('数据分析', 'featData', 'Dream Union：数据概览 / 联盟排行 / 球员对比')}
        {permRow('新闻', 'featNews')}
        {permRow('百家说', 'featForum')}
        {permRow('私信', 'featPm')}
        {permRow('日程', 'featSchedule')}
      </Card>
    </>
  )
}
