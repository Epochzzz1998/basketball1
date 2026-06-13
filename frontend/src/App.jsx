import { Routes, Route } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import ProtectedRoute from './router/ProtectedRoute'
import RoleRoute from './router/RoleRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Forbidden from './pages/Forbidden'
import NotFound from './pages/NotFound'
import Placeholder from './pages/Placeholder'
import Register from './pages/Register'
import AllPlayerSeasonStats from './pages/players/AllPlayerSeasonStats'
import PlayerCareer from './pages/players/PlayerCareer'
import PlayerManage from './pages/players/PlayerManage'
import PlayerStatsManage from './pages/players/PlayerStatsManage'
import NewsList from './pages/news/NewsList'
import NewsDetail from './pages/news/NewsDetail'
import NewsManage from './pages/news/NewsManage'
import NewsEdit from './pages/news/NewsEdit'

/**
 * 路由表（P5-1 骨架）。
 * - /login、/403 是独立页（不套外壳）。
 * - "/" 套 AppLayout 外壳，子页面渲染进它的 <Outlet/>。
 * - 公开页直接放；需登录的用 <ProtectedRoute>；需角色的用 <RoleRoute>。
 * 业务页现用 <Placeholder> 占位，P5-2 逐屏替换为真实页面。
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/403" element={<Forbidden />} />

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Home />} />

        {/* 公开浏览 */}
        <Route path="players" element={<AllPlayerSeasonStats />} />
        <Route path="players/:playerId" element={<PlayerCareer />} />
        <Route path="news" element={<NewsList />} />
        {/* 发帖/编辑：登录即可（恢复原论坛发帖；后端 /news/save 限制作者本人或 manager） */}
        <Route path="news/new" element={<ProtectedRoute><NewsEdit /></ProtectedRoute>} />
        <Route path="news/edit/:newsId" element={<ProtectedRoute><NewsEdit /></ProtectedRoute>} />
        <Route path="news/:newsId" element={<NewsDetail />} />

        {/* 需登录 */}
        <Route path="me" element={<ProtectedRoute><Placeholder title="我的消息" /></ProtectedRoute>} />

        {/* 需 manager 及以上 */}
        <Route path="admin/news" element={<RoleRoute role="manager"><NewsManage /></RoleRoute>} />

        {/* 需 superManager */}
        <Route path="admin/players" element={<RoleRoute role="superManager"><PlayerManage /></RoleRoute>} />
        <Route path="admin/players/:playerId/stats" element={<RoleRoute role="superManager"><PlayerStatsManage /></RoleRoute>} />
        <Route path="admin/users" element={<RoleRoute role="superManager"><Placeholder title="用户管理" /></RoleRoute>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
