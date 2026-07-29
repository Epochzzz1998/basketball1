import { useCallback, useEffect, useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, message } from 'antd'
import {
  BarChartOutlined, BellOutlined, DatabaseOutlined, DollarOutlined, FireOutlined,
  LogoutOutlined, NotificationOutlined, PushpinFilled, ReadOutlined, RightOutlined,
  TagsOutlined, TeamOutlined, UsergroupAddOutlined, UserOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { userInformationApi } from '../../api/userInformation'
import { topicApi } from '../../api/topic'
import PushToggle from '../../components/PushToggle'
import AnnouncementEditModal from '../../components/AnnouncementEditModal'

const BRAND = '#fa541c'

/**
 * 一行可点的条目：左图标 + 文字 + 右侧内容（角标/开关）+ 箭头。
 *
 * 定义在**模块作用域**而不是组件内部：写在组件里的话每次渲染都会产生一个新的
 * 组件类型，React 会把整棵子树卸载重建（输入框失焦、动画重来），
 * React Compiler 直接报 "Cannot create components during render"。
 */
function Row({ icon, label, extra, onClick, arrow = true, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
        cursor: onClick ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
        color: danger ? '#ff4d4f' : '#333',
      }}
    >
      <span style={{ fontSize: 17, color: danger ? '#ff4d4f' : BRAND, display: 'inline-flex' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{label}</span>
      {extra}
      {arrow && onClick && <RightOutlined style={{ fontSize: 11, color: '#ccc' }} />}
    </div>
  )
}

/** 一组条目合成一张卡片（同上，必须在模块作用域） */
function Group({ children }) {
  return (
    <Card style={{ borderRadius: 14, marginBottom: 12 }} styles={{ body: { padding: 0 } }}>
      {children}
    </Card>
  )
}

/** 条目之间的分隔线，左侧缩进对齐文字 */
function Divider() {
  return <div style={{ height: 1, background: '#f5f5f5', marginLeft: 44 }} />
}

/**
 * 「我」——移动端底部第四个 tab。
 *
 * 底部只放得下四个入口，其余功能总得有地方去。这一页就是那个地方：
 * **凡是跟"我这个人"有关的，都收在这里**——我的消息、推送开关、订阅的专题、
 * 按角色才有的模块（耿阿姨烤串）、超管的管理入口、登出。
 *
 * 和顶部汉堡抽屉的分工：这里是"我自己的东西"，抽屉是"去别的模块"。两者暂时有重叠，
 * 等用一阵子再决定要不要砍掉一边——现在就拍板容易砍错。
 *
 * 桌面端不会走到这一页（底部栏只在移动端出现），但直接输网址也能打开，
 * 所以布局用的是普通卡片流，宽屏下不会散架。
 */
export default function Mine() {
  const navigate = useNavigate()
  const { user, logout, canUse } = useAuth()
  const [unread, setUnread] = useState(0)
  const [subs, setSubs] = useState([])
  const [announceOpen, setAnnounceOpen] = useState(false)

  const load = useCallback(() => {
    if (!user) return
    userInformationApi.unreadCount().then((n) => setUnread(Number(n) || 0)).catch(() => {})
    topicApi.mySubscriptions().then((r) => setSubs(Array.isArray(r) ? r : [])).catch(() => {})
  }, [user])

  useEffect(() => { load() }, [load])

  if (!user) {
    return (
      <Card style={{ borderRadius: 14 }}>
        <Empty description="登录后这里是你的消息、订阅和设置">
          <Button type="primary" onClick={() => navigate('/login')}>去登录</Button>
        </Empty>
      </Card>
    )
  }

  const bbqManager = user.bbqRole === 'manager'
  const bbqStaff = user.bbqRole === 'staff'
  const hasModules = canUse('featNews') || bbqManager || bbqStaff

  return (
    <>
      {/* 身份卡：点进个人主页 */}
      <Card
        style={{ borderRadius: 14, marginBottom: 12, cursor: 'pointer' }}
        styles={{ body: { padding: 16 } }}
        onClick={() => navigate(`/users/${user.userId}`)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar size={56} src={user.avatar || undefined} icon={user.avatar ? undefined : <UserOutlined />} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.userNickname}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>
              {user.isSuperManager ? '超级管理员' : '查看我的主页'}
            </div>
          </div>
          <RightOutlined style={{ fontSize: 12, color: '#ccc' }} />
        </div>
      </Card>

      {/* 消息与通知 */}
      <Group>
        <Row
          icon={<BellOutlined />}
          label="我的消息"
          extra={unread > 0 ? <Badge count={unread} size="small" style={{ marginRight: 4 }} /> : null}
          onClick={() => navigate('/me')}
        />
        <Divider />
        {/* 推送开关就地放在这儿，不是跳走：它是个开关不是一个页面。
            浏览器不支持或服务端没配密钥时 PushToggle 自己返回 null，
            这一行就只剩标题，不会出现一个点不动的空开关 */}
        <Row icon={<NotificationOutlined />} label="手机推送" extra={<PushToggle compact />} arrow={false} />
      </Group>

      {/* 订阅的专题：原来在侧栏，搬到这里 */}
      <Group>
        <Row icon={<PushpinFilled />} label={`订阅的专题 (${subs.length})`} arrow={false} />
        {subs.length === 0 ? (
          <div style={{ padding: '0 16px 14px 44px', fontSize: 12, color: '#bbb', lineHeight: 1.6 }}>
            还没有订阅。进已加入的专题点「订阅」，就会常驻在这里
          </div>
        ) : (
          subs.map((t) => (
            <div key={t.topicId}>
              <Divider />
              <div
                onClick={() => navigate(`/news/topic/${t.topicId}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px 11px 44px',
                  cursor: 'pointer', fontSize: 14, WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t.pinned
                  ? <PushpinFilled style={{ fontSize: 11, color: BRAND, flexShrink: 0 }} />
                  : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fa8c16', flexShrink: 0 }} />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </span>
                {t.newCount > 0 && <Badge count={t.newCount} size="small" />}
                <RightOutlined style={{ fontSize: 11, color: '#ccc' }} />
              </div>
            </div>
          ))
        )}
      </Group>

      {/* 其它模块：底部栏放不下的都在这儿。一个都没有时整张卡不渲染，
          免得留一张空白卡片 */}
      {hasModules && (
        <Group>
          {canUse('featNews') && <Row icon={<ReadOutlined />} label="新闻" onClick={() => navigate('/official')} />}
          {canUse('featNews') && (bbqManager || bbqStaff) && <Divider />}
          {bbqManager && (
            <>
              <Row icon={<DollarOutlined />} label="薪资计算" onClick={() => navigate('/bbq/wage')} />
              <Divider />
              <Row icon={<BarChartOutlined />} label="经营台账" onClick={() => navigate('/bbq/ledger')} />
              <Divider />
              <Row icon={<FireOutlined />} label="Burning！" onClick={() => navigate('/bbq/burning')} />
              <Divider />
              <Row icon={<TeamOutlined />} label="成员管理" onClick={() => navigate('/bbq/members')} />
              <Divider />
              <Row icon={<TagsOutlined />} label="串价设置" onClick={() => navigate('/bbq/skewers')} />
            </>
          )}
          {bbqStaff && (
            <>
              <Row icon={<BarChartOutlined />} label="我的薪资" onClick={() => navigate('/bbq/ledger')} />
              <Divider />
              <Row icon={<FireOutlined />} label="Burning！" onClick={() => navigate('/bbq/burning')} />
            </>
          )}
        </Group>
      )}

      {/* 超管 */}
      {user.isSuperManager && (
        <Group>
          <Row icon={<DatabaseOutlined />} label="球员管理" onClick={() => navigate('/admin/players')} />
          <Divider />
          <Row icon={<UsergroupAddOutlined />} label="用户管理" onClick={() => navigate('/admin/users')} />
          <Divider />
          <Row icon={<NotificationOutlined />} label="全站公告" onClick={() => setAnnounceOpen(true)} />
        </Group>
      )}

      <Group>
        <Row
          icon={<LogoutOutlined />}
          label="登出"
          danger
          arrow={false}
          onClick={async () => { await logout(); message.success('已登出'); navigate('/login') }}
        />
      </Group>

      {user.isSuperManager && (
        <AnnouncementEditModal open={announceOpen} onClose={() => setAnnounceOpen(false)} />
      )}
    </>
  )
}
