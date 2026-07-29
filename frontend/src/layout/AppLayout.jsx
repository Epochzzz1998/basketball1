import { useEffect, useMemo, useState } from 'react'
import { ProLayout } from '@ant-design/pro-components'
import { Avatar, Badge, Button, Dropdown } from 'antd'
import {
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CaretRightOutlined,
  DollarOutlined,
  FireOutlined,
  MessageOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  TagsOutlined,
  LogoutOutlined,
  NotificationOutlined,
  PushpinFilled,
  ReadOutlined,
  TeamOutlined,
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
import { setupNativePush, teardownNativePush } from '../realtime/nativePush'
import AnnouncementBar from '../components/AnnouncementBar'
import BackButton from '../components/BackButton'
import { NAV_ROOTS, hasOwnBack } from '../components/backNav'
import ErrorBoundary from '../components/ErrorBoundary'
import AnnouncementEditModal from '../components/AnnouncementEditModal'
import useIsMobile from '../hooks/useIsMobile'
import MobileTabBar, { TAB_BAR_HEIGHT, TOP_BAR_HEIGHT } from './MobileTabBar'
import { showTabBar, showTopBar } from './mobileNav'
import useNavigationPaint from './useNavigationPaint'
import useAppSwipe from './useAppSwipe'

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
  const { user, loading: authLoading, logout, canUse } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  // 换页后的滚动位置与重绘（见 useNavigationPaint 里的长注释：
  // 前进回顶部是修正，换页后的 1px 轻推是补丁）
  useNavigationPaint(isMobile)
  // 左右滑：Tab 首页之间切换，二级页面从左边缘滑回上一级（见 useAppSwipe 的说明）
  useAppSwipe(isMobile)
  const [unread, setUnread] = useState(0)
  const [pmUnread, setPmUnread] = useState(0)
  // 受控折叠：移动端默认收起（抽屉关闭）；点菜单项后主动收回抽屉（ProLayout 默认不收）
  const [collapsed, setCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  const [announceOpen, setAnnounceOpen] = useState(false) // 全站公告编辑（仅超管）
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

  /**
   * 套壳 App 的原生推送（FCM）也跟随登录态。网页端 `isNative` 为假，这两个函数直接返回。
   *
   * **必须等登录之后**：令牌是"这台设备"的，后端存的是"这个人的这台设备"，
   * 没登录就拿到令牌也不知道记给谁。
   *
   * **登出必须注销**：不然下一个在这台手机上登录的人会收到上一个人的通知。
   */
  useEffect(() => {
    if (user) setupNativePush()
    else teardownNativePush()
  }, [user])

  // 功能模块被禁用的用户，若深链进入该模块的页面（菜单已隐藏，这里兜底），重定向回首页。
  // 超管与未登录访客不受限（访客看公开站点）。按路径前缀判断，覆盖各子页。
  // NBA 不在这里——它一进页面就发请求，改由路由级的 FeatureRoute 在渲染前拦。
  useEffect(() => {
    if (authLoading || !user || user.isSuperManager) return
    const p = location.pathname
    const blocked =
      (!canUse('featNews') && p.startsWith('/official')) ||
      (user.featForum === false && p.startsWith('/news')) ||
      (user.featPm === false && p.startsWith('/messages')) ||
      (user.featSchedule === false && p.startsWith('/schedule'))
    if (blocked) navigate('/', { replace: true })
  }, [location.pathname, user, authLoading, canUse, navigate])

  // 耿阿姨烤串按店内角色（bbqRole）而非功能开关：台账店内成员皆可（店员只见自己的数据），
  // 其余页面店长专属。超管也不豁免——想看就到用户管理里任命自己当店长（后端逐接口校验，这里只是少一次白屏）。
  useEffect(() => {
    if (!user) return
    const p = location.pathname
    if (!p.startsWith('/bbq')) return
    const memberPage = p.startsWith('/bbq/ledger') || p.startsWith('/bbq/burning')
    const ok = memberPage ? !!user.bbqRole : user.bbqRole === 'manager'
    if (!ok) navigate('/', { replace: true })
  }, [location.pathname, user, navigate])

  // 功能模块可用性（按用户）的规则在 AuthContext.canUse 里，全站一份：
  // 百家说/新闻/私信/日程默认开放（游客可看）。NBA 已从侧栏移除，入口在 NBA 专题里。
  // 关掉的模块整块从导航隐藏。
  const route = useMemo(
    () => ({
      path: '/',
      routes: [
        // 百家说（论坛）是落地页与首要入口，放最前
        ...(canUse('featForum') ? [{ path: '/news', name: '百家说', icon: <ReadOutlined /> }] : []),
        // NBA 数据不再出现在侧栏：不是每个人都看球，一整组菜单挂在那儿对多数人是噪音。
        // 入口改在 NBA 专题的横幅上（components/NbaModuleEntry.jsx）——想看的人进那个专题就看得见。
        // 路由和后端门禁都没动，直连 /players 之类照样能进（登录且没被封禁的话）。
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
                { path: '/bbq/burning', name: 'Burning！', icon: <FireOutlined /> },
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
                { path: '/bbq/burning', name: 'Burning！', icon: <FireOutlined /> },
              ],
            }]
          : []),
        // 私信：侧栏一个入口（未读数在 menuItemRender 里挂角标），头像下拉里那个也保留——
        // 两个入口指同一页，习惯点哪个都行
        ...(user && canUse('featPm') ? [{ path: '/messages', name: '私信', icon: <MessageOutlined /> }] : []),
        ...(user?.isSuperManager
          ? [
              { path: '/admin/players', name: '球员管理', icon: <DatabaseOutlined /> },
              { path: '/admin/users', name: '用户管理', icon: <UsergroupAddOutlined /> },
            ]
          : []),
      ],
    }),
    // canUse 只依赖 user，所以 user 变了就够了；把它列进来会让每次渲染都重算菜单
    [user], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  // 移动端底部 Tab 栏：显示规则在 mobileNav.showTabBar（已按全部路由验证过）
  const tabBar = isMobile && showTabBar(location.pathname, location.search)
  // 顶栏：只有整页搜索那一页收起来（那页自己有一条等高的真搜索框）
  const topBar = isMobile && showTopBar(location.pathname)

  /**
   * 把两个固定栏的高度写成 CSS 变量，供样式表使用（如私信页的 .pm-body 要算 100dvh 减去它们）。
   *
   * **JS 常量是唯一来源。** 在 CSS 里再抄一份数字，改高度时必然漏掉一处——
   * 而且漏的那处只在特定页面的特定屏幕尺寸下才看得出来。
   * 没有 Tab 栏的页面把变量置 0，样式表那边就不用再判断一次。
   */
  useEffect(() => {
    const root = document.documentElement
    // 这个变量的含义是「顶部那条固定栏有多高」，不是「App 顶栏在不在」——
    // 搜索页把 App 顶栏换成了自己那条等高的，高度没变，所以按 isMobile 判断
    root.style.setProperty('--mobile-topbar-h', isMobile ? `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top))` : '0px')
    root.style.setProperty('--mobile-tabbar-h', tabBar ? `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))` : '0px')
  }, [isMobile, tabBar])

  // 全局返回按钮：一级页面（NAV_ROOTS，见 components/BackButton）不显示，其余页面统一在内容区左上角。
  // 有底部 Tab 栏的页面一律不给返回：那条栏本身就是导航，再加一个返回是重复的
  // 干扰，而且它占的那一行在手机上很值钱。没有 Tab 栏的页面（帖子详情、群聊…）
  // 才是真正需要返回的地方。
  // hasOwnBack 那批是专题页——返回画在横幅的背景图里，全局这个再出来就成了两个
  const showBack = !NAV_ROOTS.includes(location.pathname) && !tabBar && !hasOwnBack(location.pathname)

  return (
    <ProLayout
      layout="mix"
      fixedHeader
      fixSiderbar
      title="Epoch"
      logo={false}
      /* 移动端不用 ProLayout 那条顶栏（标题 + 刷新 + 搜索胶囊 + 头像下拉挤成一排），
         换成自己画的「☰ + 长条搜索框」。头像那一摊搬进了「我」页。
         关掉顶栏不影响抽屉：抽屉在 SiderMenu/index.js 里由 `!collapsed` 驱动，
         和 header 无关（源码确认，非推断）。 */
      headerRender={isMobile ? false : undefined}
      siderWidth={216}
      /* 移动端菜单是 antd Drawer，ProLayout 默认给它 getContainer={false}（就地渲染），
         于是抽屉和遮罩都是 position:absolute、高 100vh——遮罩只盖住打开那一刻的可视区，
         页面往下滚就滚出了遮罩，下半屏是亮的。挂到 body 上就变成 fixed 定位，
         遮罩恒等于视口，顺带拿到 antd 的滚动锁定。 */
      getContainer={() => document.body}
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
                        {/* 置顶的换成图钉，顺序由后端按各人的置顶时间排好，这里只是让人看懂为什么它在最上面 */}
                        {t.pinned
                          ? <PushpinFilled style={{ fontSize: 11, color: '#fa541c', flexShrink: 0 }} />
                          : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fa8c16', flexShrink: 0 }} />}
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
        // 私信项挂未读角标（与头像上的角标同一个数）
        const label = item.path === '/messages' && pmUnread > 0
          ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {dom}
              <Badge count={pmUnread} size="small" />
            </span>
          )
          : dom
        // 移动端：点完菜单项自动把抽屉收回去
        return <Link to={item.path} onClick={() => { if (isMobile) setCollapsed(true) }}>{label}</Link>
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
                      // 私信：头像下拉与侧栏各有一个入口，未读数实时角标
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
                      // 全站公告是全局的事，入口放在头像下拉而不是某个模块里
                      ...(user.isSuperManager
                        ? [{
                            key: 'announce',
                            icon: <NotificationOutlined />,
                            label: '全站公告',
                            onClick: () => setAnnounceOpen(true),
                          }]
                        : []),
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
      {/* ===== 移动端顶栏：搜索框 + 刷新 ===== */}
      {isMobile && (
        <>
          {topBar && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 150,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', paddingTop: 'calc(8px + env(safe-area-inset-top))',
              // 不透明白底，**不用 backdrop-filter**：毛玻璃在 96% 不透明度下本来就几乎看不出来，
              // 而 backdrop-filter 会把这条固定栏提成独立合成层、并且每帧都要采样它背后的内容。
              // iOS 上「换页之后大片内容不重绘、滑一下才出来」是这类属性的经典症状，
              // 为了一点看不见的效果冒这个险不划算（tab 栏、搜索页那条同理）
              background: '#fff',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {/* 汉堡菜单去掉了：它打开的抽屉里那些入口（新闻、耿阿姨烤串、球员/用户管理、
                订阅的专题）现在全在「我」页里，四个底部 Tab 覆盖其余部分。
                两个入口指同一批东西只会让人犹豫点哪个，而且顶栏这一行在手机上很值钱——
                去掉之后搜索框能占满整条。 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <GlobalSearch variant="bar" />
            </div>
            {/* 整页刷新。和列表页的下拉刷新不冲突：那个只重拉当前列表的数据，
                这个是整个应用重新加载——换了版本、或者页面状态乱了的时候用 */}
            <ReloadOutlined
              onClick={() => window.location.reload()}
              title="刷新页面"
              style={{ fontSize: 17, color: '#888', flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
            />
          </div>
          )}
          {/* 顶栏是 fixed 的，用一个等高的占位块把内容推下去。
              高度 = 8+34+8 内边距与搜索框，再加刘海。

              **占位块在搜索页也要留**：那一页把 App 顶栏换成了自己那条等高的固定栏，
              占位块要是跟着一起没了，公告条会被压在栏底下（它渲染在内容区最上面）。 */}
          <div style={{ height: `calc(${TOP_BAR_HEIGHT}px + env(safe-area-inset-top))` }} />
        </>
      )}

      {/* 内容区是 flex 列容器：flex 子项上 margin:auto 会把宽度压成"内容宽"再居中，
          必须显式 width:100% 才能占满（maxWidth 只在超宽屏才生效）。
          底部栏是 fixed 的，同样要留出等高的内边距，否则最后一条内容被永久盖住 */}
      <div
        className="app-content"
        style={{
          padding: isMobile ? '12px 12px 0' : 20,
          paddingBottom: tabBar ? `calc(${TAB_BAR_HEIGHT + 12}px + env(safe-area-inset-bottom))` : (isMobile ? 12 : 20),
          maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box',
        }}
      >
        {/* 全站公告：内容区最上面（顶栏是 fixed 的，摆到它上面会互相压）。
            游客也能看到——公告本来就是发给所有人的 */}
        <AnnouncementBar />
        {/* 手机上只留一个圆钮（那一行很值钱），桌面端把「返回」二字带上 */}
        {showBack && <BackButton label={isMobile ? undefined : '返回'} style={{ marginBottom: 10 }} />}
        {/* 自己的错误边界要比 ProLayout 内部那个更靠近页面，才会先捕获。
            它显示 error.stack，配合 source map 能反查到原始行号；ProLayout 自带的
            只显示一句 message，压缩后完全定位不到。

            用 resetKey 不用 key：key 会让整棵子树在每次路由变化时重建，
            而有些页面（NBA 分区）只想换内容区、不想被整个重来。见 ErrorBoundary 里的说明 */}
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
      {user?.isSuperManager && (
        <AnnouncementEditModal open={announceOpen} onClose={() => setAnnounceOpen(false)} />
      )}
      {/* 底部 Tab 栏。显示规则见 mobileNav.showTabBar —— 沉浸式页面（群聊、私信会话）、
          详情/编辑页、NBA 数据页都不出现 */}
      {tabBar && <MobileTabBar pmUnread={pmUnread} meUnread={unread} />}
    </ProLayout>
  )
}
