import { useEffect, useMemo, useState } from 'react'
import { ProLayout } from '@ant-design/pro-components'
import { Avatar, Badge, Button, Dropdown } from 'antd'
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CaretRightOutlined,
  DollarOutlined,
  FireOutlined,
  MessageOutlined,
  ReloadOutlined,
  SwapOutlined,
  DatabaseOutlined,
  FundOutlined,
  TagsOutlined,
  HomeOutlined,
  LogoutOutlined,
  NotificationOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  TrophyOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import GlobalSearch from '../components/GlobalSearch'
import { userInformationApi } from '../api/userInformation'
import { pmApi } from '../api/pm'
import { topicApi } from '../api/topic'
import { connectPmSocket, disconnectPmSocket } from '../realtime/pmSocket'
import useIsMobile from '../hooks/useIsMobile'

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
  const isMobile = useIsMobile()
  const [unread, setUnread] = useState(0)
  const [pmUnread, setPmUnread] = useState(0)
  // 受控折叠：移动端默认收起（抽屉关闭）；点菜单项后主动收回抽屉（ProLayout 默认不收）
  const [collapsed, setCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  // 订阅的专题（侧栏独立折叠区，默认展开）
  const [subs, setSubs] = useState([])
  const [subsOpen, setSubsOpen] = useState(true)

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

  // 订阅的专题：登录拉一次；订阅/取消订阅后各页派发 'subs-changed' 事件刷新
  useEffect(() => {
    if (!user) {
      setSubs([])
      return
    }
    let alive = true
    const fetchSubs = () => {
      topicApi.mySubscriptions().then((r) => { if (alive) setSubs(Array.isArray(r) ? r : []) }).catch(() => {})
    }
    fetchSubs()
    window.addEventListener('subs-changed', fetchSubs)
    return () => {
      alive = false
      window.removeEventListener('subs-changed', fetchSubs)
    }
  }, [user, location.pathname])

  // 私信 WebSocket 跟随登录态：登录建立连接，登出断开
  useEffect(() => {
    if (user) connectPmSocket()
    else disconnectPmSocket()
    return () => disconnectPmSocket()
  }, [user])

  // 功能模块被禁用的用户，若深链进入该模块的页面（菜单已隐藏，这里兜底），重定向回首页。
  // 超管与未登录访客不受限（访客看公开站点）。按路径前缀判断，覆盖各子页。
  useEffect(() => {
    if (!user || user.isSuperManager) return
    const p = location.pathname
    const blocked =
      (user.featData === false && (p.startsWith('/players') || p.startsWith('/rankings') || p.startsWith('/compare') || p.startsWith('/league'))) ||
      (user.featNews === false && p.startsWith('/official')) ||
      (user.featForum === false && p.startsWith('/news')) ||
      (user.featPm === false && p.startsWith('/messages')) ||
      (user.featSchedule === false && p.startsWith('/schedule'))
    if (blocked) navigate('/', { replace: true })
  }, [location.pathname, user, navigate])

  // 耿阿姨烤串按店内角色（bbqRole）而非功能开关：台账店内成员皆可（店员只见自己的数据），
  // 其余页面店长专属。超管也不豁免——想看就到用户管理里任命自己当店长（后端逐接口校验，这里只是少一次白屏）。
  useEffect(() => {
    if (!user) return
    const p = location.pathname
    if (!p.startsWith('/bbq')) return
    const ok = p.startsWith('/bbq/ledger') ? !!user.bbqRole : user.bbqRole === 'manager'
    if (!ok) navigate('/', { replace: true })
  }, [location.pathname, user, navigate])

  // 功能模块可用性（按用户）：超管始终可见（便于管理）；未登录按公开可见；
  // flag 未定义（后端还没下发/老数据）时默认显示，保证前后兼容。关掉的模块整块从导航隐藏。
  const canUse = (flag) => !user || user.isSuperManager || user[flag] !== false
  const route = useMemo(
    () => ({
      path: '/',
      routes: [
        // 百家说（论坛）是落地页与首要入口，放最前
        ...(canUse('featForum') ? [{ path: '/news', name: '百家说', icon: <ReadOutlined /> }] : []),
        // Dream Union：篮球数据分析模块（可扩展），「联盟概览」(旧首页看板) 打头，与百家说/新闻同级
        ...(canUse('featData')
          ? [{
              path: '/dream-union',
              name: 'Dream Union',
              icon: <FundOutlined />,
              routes: [
                { path: '/league', name: '联盟概览', icon: <HomeOutlined /> },
                { path: '/players', name: '数据概览', icon: <TeamOutlined /> },
                { path: '/rankings', name: '联盟排行', icon: <TrophyOutlined /> },
                { path: '/compare', name: '球员对比', icon: <SwapOutlined /> },
              ],
            }]
          : []),
        ...(canUse('featNews') ? [{ path: '/official', name: '新闻', icon: <NotificationOutlined /> }] : []),
        // 日程（登录用户；按用户可关）
        ...(user && canUse('featSchedule') ? [{ path: '/schedule', name: '日程', icon: <CalendarOutlined /> }] : []),
        // 耿阿姨烤串（单店薪资管理）：店长=全部四项；店员=只有台账（看自己的薪资，只读）
        ...(user?.bbqRole === 'manager'
          ? [{
              path: '/bbq',
              name: '耿阿姨烤串',
              icon: <FireOutlined />,
              routes: [
                { path: '/bbq/wage', name: '薪资计算', icon: <DollarOutlined /> },
                { path: '/bbq/ledger', name: '经营台账', icon: <BarChartOutlined /> },
                { path: '/bbq/members', name: '成员管理', icon: <TeamOutlined /> },
                { path: '/bbq/skewers', name: '串价设置', icon: <TagsOutlined /> },
              ],
            }]
          : []),
        ...(user?.bbqRole === 'staff'
          ? [{
              path: '/bbq',
              name: '耿阿姨烤串',
              icon: <FireOutlined />,
              routes: [
                { path: '/bbq/ledger', name: '我的薪资', icon: <BarChartOutlined /> },
              ],
            }]
          : []),
        // 私信入口在右上角头像下拉里（不占侧栏）
        ...(user?.isSuperManager
          ? [
              { path: '/admin/players', name: '球员管理', icon: <DatabaseOutlined /> },
              { path: '/admin/users', name: '用户管理', icon: <UsergroupAddOutlined /> },
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

  // 全局返回按钮：一级页面（侧栏导航直达的根路径）不显示，其余页面统一在内容区左上角。
  // 优先走站内历史（-1 即"上一级"）；直链进入无历史时，剥路径段回落到最近的已知上级。
  const NAV_ROOTS = ['/', '/news', '/league', '/players', '/rankings', '/compare', '/official', '/messages', '/schedule', '/bbq/wage', '/bbq/ledger', '/bbq/members', '/bbq/skewers', '/login', '/register', '/403', '/admin/players', '/admin/users', '/admin/verify']
  const showBack = !NAV_ROOTS.includes(location.pathname)
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
      return
    }
    let p = location.pathname
    while (p.length > 1) {
      p = p.replace(/\/[^/]*$/, '') || '/'
      if (NAV_ROOTS.includes(p)) break
    }
    navigate(p || '/', { replace: true })
  }

  return (
    <ProLayout
      layout="mix"
      fixedHeader
      fixSiderbar
      title="Dream Everything"
      logo={false}
      siderWidth={216}
      location={{ pathname: location.pathname }}
      route={route}
      collapsed={collapsed}
      onCollapse={setCollapsed}
      // 常规菜单下方追加"订阅的专题"折叠区：橙色主题卡片，与功能菜单明显区分；侧栏收起时隐藏
      menuContentRender={(menuProps, defaultDom) => (
        <>
          {defaultDom}
          {user && !collapsed && (
            <div style={{ margin: '6px 12px 14px', paddingTop: 10, borderTop: '1px dashed #f0f0f0' }}>
              <div
                onClick={() => setSubsOpen((o) => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', padding: '2px 6px', fontSize: 12, fontWeight: 700, color: '#d46b08' }}
              >
                <CaretRightOutlined style={{ transform: subsOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', fontSize: 10 }} />
                订阅的专题
                <span style={{ color: '#d9a05f', fontWeight: 400 }}>({subs.length})</span>
              </div>
              {subsOpen && subs.length === 0 && (
                <div style={{ marginTop: 4, background: '#fffaf3', border: '1px dashed #ffe7ba', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#d9a05f', lineHeight: 1.6 }}>
                  还没有订阅。到已加入的专题页点「订阅」，就会常驻在这里
                </div>
              )}
              {subsOpen && subs.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, background: '#fffaf3', border: '1px solid #ffe7ba', borderRadius: 10, padding: '6px 4px' }}>
                  {subs.map((t) => {
                    const active = location.pathname === `/news/topic/${t.topicId}`
                    return (
                      <div
                        key={t.topicId}
                        onClick={() => { navigate(`/news/topic/${t.topicId}`); if (isMobile) setCollapsed(true) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8,
                          cursor: 'pointer', fontSize: 13,
                          color: active ? '#d4380d' : '#595959',
                          background: active ? '#fff1e6' : 'transparent',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fa8c16', flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                        {t.newCount > 0 && <Badge count={t.newCount} size="small" style={{ flexShrink: 0 }} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
      menuItemRender={(item, dom) => {
        if (!item.path) return dom
        // 移动端：点完菜单项自动把抽屉收回去
        return <Link to={item.path} onClick={() => { if (isMobile) setCollapsed(true) }}>{dom}</Link>
      }}
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
                      // 私信：从侧栏挪回头像下拉，未读数实时角标
                      ...(canUse('featPm')
                        ? [{
                            key: 'pm',
                            icon: <MessageOutlined />,
                            label: (
                              <span>
                                私信
                                <Badge count={pmUnread} size="small" style={{ marginLeft: 8 }} />
                              </span>
                            ),
                            onClick: () => navigate('/messages'),
                          }]
                        : []),
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: isMobile ? 6 : 8, cursor: 'pointer', padding: isMobile ? '0 2px 0 8px' : '0 4px' }}>
                    {/* 头像角标 = 消息未读 + 私信未读（两个入口都收进下拉了）；移动端头像加大到 32 */}
                    <Badge count={unread + pmUnread} size="small" offset={[-2, 4]}>
                      <Avatar size={isMobile ? 32 : 28} src={user.avatar || undefined} icon={user.avatar ? undefined : <UserOutlined />} />
                    </Badge>
                    {/* 昵称两端都显示；移动端限宽出省略号，防止把左边的刷新/搜索挤出屏（上次的病根） */}
                    <span style={{ fontSize: isMobile ? 13 : 14, maxWidth: isMobile ? 72 : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.userNickname}
                    </span>
                  </span>
                </Dropdown>
              ),
            }
          : undefined
      }
      // 搜索框在动作区（紧贴头像）；动作项自带的 hover 灰底由 index.css 里
      // 的 [class*='actions-item']:has(.global-search) 规则压掉
      actionsRender={() => [
        // 常驻页面刷新（搜索左边）：与搜索触发器同款 32px 胶囊，flexShrink 0 防止窄屏被挤没；
        // marginRight 拉开与搜索图标的间距
        <span
          key="reload"
          onClick={() => window.location.reload()}
          title="刷新页面"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, flexShrink: 0, borderRadius: 16,
            border: '1px solid #e8e8e8', background: '#fff', color: '#aaa',
            cursor: 'pointer', fontSize: 14, marginRight: isMobile ? 8 : 4,
          }}
        >
          <ReloadOutlined />
        </span>,
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
      <div className="app-content" style={{ padding: 20, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {showBack && (
          <a
            onClick={goBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#666', fontSize: 13, marginBottom: 10, cursor: 'pointer', userSelect: 'none' }}
          >
            <ArrowLeftOutlined /> 返回
          </a>
        )}
        <Outlet />
      </div>
    </ProLayout>
  )
}
