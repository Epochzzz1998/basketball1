import { useEffect, useMemo, useState } from 'react'
import { ProLayout } from '@ant-design/pro-components'
import { Avatar, Badge, Button, Dropdown } from 'antd'
import {
  BellOutlined,
  MessageOutlined,
  SwapOutlined,
  DatabaseOutlined,
  EditOutlined,
  HomeOutlined,
  LogoutOutlined,
  NotificationOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GlobalSearch from '../components/GlobalSearch'
import { userInformationApi } from '../api/userInformation'
import { pmApi } from '../api/pm'
import { connectPmSocket, disconnectPmSocket } from '../realtime/pmSocket'

/**
 * 整体外壳（P5-3 美化）：ProLayout 的 mix 布局 = 顶栏品牌 + 可折叠侧栏菜单，
 * 自带响应式/折叠/选中态，是 Ant Design Pro 的标准后台观感。
 * - 菜单按角色动态拼（数据来自 /user/current），带图标；
 * - 右上角：已登录=头像+昵称（下拉：个人主页/我的消息(未读红数)/登出，头像带未读角标），
 *   未登录=登录/注册按钮；
 * - 未读数在路由变化时轻量刷新，页面可派发 window 'unread-changed' 事件主动触发；
 * - 子页面渲染进 <Outlet/>，内容区灰底，各页的 Card/ProTable 自然浮成白卡片。
 */
export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [pmUnread, setPmUnread] = useState(0)

  // 未读数：登录后取一次，路由变化轻量刷新；'unread-changed' 事件（如一键已读后）立即刷新；
  // 私信未读另走一路：'pm-event'（WS 推送到达）和 'pm-unread-changed'（聊天页标已读后）触发
  useEffect(() => {
    if (!user) {
      setUnread(0)
      setPmUnread(0)
      return
    }
    let alive = true
    const fetchUnread = () => {
      userInformationApi.unreadCount()
        .then((n) => { if (alive) setUnread(Number(n) || 0) })
        .catch(() => {})
    }
    const fetchPmUnread = () => {
      pmApi.unreadCount()
        .then((n) => { if (alive) setPmUnread(Number(n) || 0) })
        .catch(() => {})
    }
    fetchUnread()
    fetchPmUnread()
    window.addEventListener('unread-changed', fetchUnread)
    window.addEventListener('pm-event', fetchPmUnread)
    window.addEventListener('pm-unread-changed', fetchPmUnread)
    return () => {
      alive = false
      window.removeEventListener('unread-changed', fetchUnread)
      window.removeEventListener('pm-event', fetchPmUnread)
      window.removeEventListener('pm-unread-changed', fetchPmUnread)
    }
  }, [user, location.pathname])

  // 私信 WebSocket 跟随登录态：登录建立连接，登出断开
  useEffect(() => {
    if (user) connectPmSocket()
    else disconnectPmSocket()
    return () => disconnectPmSocket()
  }, [user])

  const route = useMemo(
    () => ({
      path: '/',
      routes: [
        { path: '/', name: '首页', icon: <HomeOutlined /> },
        { path: '/players', name: '数据概览', icon: <TeamOutlined /> },
        { path: '/rankings', name: '联盟排行', icon: <TrophyOutlined /> },
        { path: '/compare', name: '球员对比', icon: <SwapOutlined /> },
        { path: '/official', name: '新闻', icon: <NotificationOutlined /> },
        { path: '/news', name: '资讯论坛', icon: <ReadOutlined /> },
        ...(user?.isManagerOrOver ? [{ path: '/admin/news', name: '资讯管理', icon: <EditOutlined /> }] : []),
        ...(user?.isSuperManager
          ? [
              { path: '/admin/players', name: '球员管理', icon: <DatabaseOutlined /> },
              { path: '/admin/verify', name: '认证审核', icon: <SafetyCertificateOutlined /> },
            ]
          : []),
      ],
    }),
    [user],
  )

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <ProLayout
      layout="mix"
      fixedHeader
      fixSiderbar
      title="Dream Unit"
      logo={<span style={{ fontSize: 26, lineHeight: 1 }}>🏀</span>}
      siderWidth={216}
      location={{ pathname: location.pathname }}
      route={route}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
      avatarProps={
        user
          ? {
              icon: user.avatar ? undefined : <UserOutlined />,
              src: user.avatar || undefined,
              size: 'small',
              title: user.userNickname,
              // 自绘头像+昵称：未读角标只包住头像，不压到昵称文字
              render: () => (
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'profile',
                        icon: <UserOutlined />,
                        label: '个人主页',
                        onClick: () => navigate(`/users/${user.userId}`),
                      },
                      {
                        key: 'pm',
                        icon: <MessageOutlined />,
                        label: (
                          <span>
                            私信
                            <Badge count={pmUnread} size="small" style={{ marginLeft: 8 }} />
                          </span>
                        ),
                        onClick: () => navigate('/messages'),
                      },
                      {
                        key: 'messages',
                        icon: <BellOutlined />,
                        label: (
                          <span>
                            我的消息
                            <Badge count={unread} size="small" style={{ marginLeft: 8 }} />
                          </span>
                        ),
                        onClick: () => navigate('/me'),
                      },
                      { type: 'divider' },
                      { key: 'logout', icon: <LogoutOutlined />, label: '登出', onClick: onLogout },
                    ],
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0 4px' }}>
                    <Badge count={unread + pmUnread} size="small" offset={[-2, 4]}>
                      <Avatar size={28} src={user.avatar || undefined} icon={user.avatar ? undefined : <UserOutlined />} />
                    </Badge>
                    <span style={{ fontSize: 14 }}>{user.userNickname}</span>
                  </span>
                </Dropdown>
              ),
            }
          : undefined
      }
      // 搜索框在动作区（紧贴头像）；动作项自带的 hover 灰底由 index.css 里
      // 的 [class*='actions-item']:has(.global-search) 规则压掉
      actionsRender={() => [
        <GlobalSearch key="global-search" />,
        ...(user
          ? []
          : [
              <Button key="login" type="primary" size="small" onClick={() => navigate('/login')}>登录</Button>,
              <Button key="reg" size="small" onClick={() => navigate('/register')}>注册</Button>,
            ]),
      ]}
      token={{
        bgLayout: '#f5f5f5',
        header: { colorBgHeader: '#ffffff' },
        sider: { colorMenuBackground: '#ffffff' },
      }}
      contentStyle={{ padding: 0 }}
    >
      {/* 内容区是 flex 列容器：flex 子项上 margin:auto 会把宽度压成"内容宽"再居中，
          必须显式 width:100% 才能占满（maxWidth 只在超宽屏才生效） */}
      <div style={{ padding: 20, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <Outlet />
      </div>
    </ProLayout>
  )
}
