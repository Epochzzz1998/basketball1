import { useMemo } from 'react'
import { ProLayout } from '@ant-design/pro-components'
import { Button, Dropdown } from 'antd'
import {
  BellOutlined,
  DatabaseOutlined,
  EditOutlined,
  HomeOutlined,
  LogoutOutlined,
  NotificationOutlined,
  ReadOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * 整体外壳（P5-3 美化）：ProLayout 的 mix 布局 = 顶栏品牌 + 可折叠侧栏菜单，
 * 自带响应式/折叠/选中态，是 Ant Design Pro 的标准后台观感。
 * - 菜单仍按角色动态拼（数据来自 /user/current），带图标；
 * - 右上角：已登录=头像+昵称（下拉登出），未登录=登录/注册按钮；
 * - 子页面渲染进 <Outlet/>，内容区灰底，各页的 Card/ProTable 自然浮成白卡片。
 */
export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const route = useMemo(
    () => ({
      path: '/',
      routes: [
        { path: '/', name: '首页', icon: <HomeOutlined /> },
        { path: '/players', name: '球员数据', icon: <TeamOutlined /> },
        { path: '/rankings', name: '联盟排行', icon: <TrophyOutlined /> },
        { path: '/official', name: '新闻', icon: <NotificationOutlined /> },
        { path: '/news', name: '资讯论坛', icon: <ReadOutlined /> },
        ...(user ? [{ path: '/me', name: '我的消息', icon: <BellOutlined /> }] : []),
        ...(user?.isManagerOrOver ? [{ path: '/admin/news', name: '资讯管理', icon: <EditOutlined /> }] : []),
        ...(user?.isSuperManager ? [{ path: '/admin/players', name: '球员管理', icon: <DatabaseOutlined /> }] : []),
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
      title="Dream 篮球"
      logo={<span style={{ fontSize: 26, lineHeight: 1 }}>🏀</span>}
      siderWidth={216}
      location={{ pathname: location.pathname }}
      route={route}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
      avatarProps={
        user
          ? {
              icon: <UserOutlined />,
              size: 'small',
              title: user.userNickname,
              render: (_props, dom) => (
                <Dropdown
                  menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '登出', onClick: onLogout }] }}
                >
                  {dom}
                </Dropdown>
              ),
            }
          : undefined
      }
      actionsRender={() =>
        user
          ? []
          : [
              <Button key="login" type="primary" size="small" onClick={() => navigate('/login')}>登录</Button>,
              <Button key="reg" size="small" onClick={() => navigate('/register')}>注册</Button>,
            ]
      }
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
