import { Routes, Route } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import ProtectedRoute from './router/ProtectedRoute'
import RoleRoute from './router/RoleRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Forbidden from './pages/Forbidden'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import PlayersHome from './pages/players/PlayersHome'
import TeamPlayers from './pages/players/TeamPlayers'
import LeagueRankings from './pages/players/LeagueRankings'
import RankingDetail from './pages/players/RankingDetail'
import HonorDetail from './pages/players/HonorDetail'
import PlayerCareer from './pages/players/PlayerCareer'
import PlayerCompare from './pages/players/PlayerCompare'
import PlayerManage from './pages/players/PlayerManage'
import PlayerStatsManage from './pages/players/PlayerStatsManage'
import NewsList from './pages/news/NewsList'
import NewsDetail from './pages/news/NewsDetail'
import NewsManage from './pages/news/NewsManage'
import NewsEdit from './pages/news/NewsEdit'
import MyMessages from './pages/user/MyMessages'
import Messages from './pages/user/Messages'
import UserProfile from './pages/user/UserProfile'
import VerifyBindings from './pages/admin/VerifyBindings'

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
        <Route path="players" element={<PlayersHome />} />
        <Route path="players/team/:teamCode" element={<TeamPlayers />} />
        <Route path="players/:playerId" element={<PlayerCareer />} />
        <Route path="compare" element={<PlayerCompare />} />
        <Route path="rankings" element={<LeagueRankings />} />
        <Route path="rankings/honors/:group" element={<HonorDetail />} />
        <Route path="rankings/:field" element={<RankingDetail />} />
        <Route path="official" element={<NewsList channel="official" />} />
        <Route path="news" element={<NewsList channel="forum" />} />
        {/* 发帖/编辑：登录即可（恢复原论坛发帖；后端 /news/save 限制作者本人或 manager） */}
        <Route path="news/new" element={<ProtectedRoute><NewsEdit /></ProtectedRoute>} />
        <Route path="news/edit/:newsId" element={<ProtectedRoute><NewsEdit /></ProtectedRoute>} />
        <Route path="news/:newsId" element={<NewsDetail />} />
        {/* 用户公开主页（他人视角） */}
        <Route path="users/:userId" element={<UserProfile />} />

        {/* 需登录 */}
        <Route path="me" element={<ProtectedRoute><MyMessages /></ProtectedRoute>} />
        <Route path="messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

        {/* 需 manager 及以上 */}
        <Route path="admin/news" element={<RoleRoute role="manager"><NewsManage /></RoleRoute>} />

        {/* 需 superManager */}
        {/* 原“用户管理”下架：老 user-list.ftl 名不副实，实为资讯管理（已由 /admin/news 覆盖），
            后端本就没有用户账号管理接口 */}
        <Route path="admin/verify" element={<RoleRoute role="superManager"><VerifyBindings /></RoleRoute>} />
        <Route path="admin/players" element={<RoleRoute role="superManager"><PlayerManage /></RoleRoute>} />
        <Route path="admin/players/:playerId/stats" element={<RoleRoute role="superManager"><PlayerStatsManage /></RoleRoute>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
