import { Layout, Menu, Button, Space } from 'antd'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Header, Sider, Content } = Layout

/**
 * 整体外壳：顶部栏（站名 + 登录态）+ 左侧菜单 + 内容区。
 * <Outlet/> 是 react-router 的"占位坑"，子路由页面会渲染到这里。
 * 菜单项按角色动态拼装——这就是"权限渲染交给前端"的落地（数据来自 /user/current）。
 */
export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = [
    { key: '/', label: <Link to="/">首页</Link> },
    { key: '/players', label: <Link to="/players">球员</Link> },
    { key: '/news', label: <Link to="/news">资讯</Link> },
  ]
  if (user) {
    items.push({ key: '/me', label: <Link to="/me">我的消息</Link> })
  }
  if (user?.isManagerOrOver) {
    items.push({ key: '/admin/news', label: <Link to="/admin/news">资讯管理</Link> })
  }
  if (user?.isSuperManager) {
    items.push({ key: '/admin/players', label: <Link to="/admin/players">球员管理</Link> })
    items.push({ key: '/admin/users', label: <Link to="/admin/users">用户管理</Link> })
  }

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Dream 篮球</div>
        <Space>
          {user ? (
            <>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{user.userNickname}</span>
              <Button size="small" onClick={onLogout}>登出</Button>
            </>
          ) : (
            <Button size="small" type="primary" onClick={() => navigate('/login')}>登录</Button>
          )}
        </Space>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu mode="inline" selectedKeys={[location.pathname]} items={items} style={{ height: '100%', borderRight: 0 }} />
        </Sider>
        <Content style={{ padding: 24, background: '#fff' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
