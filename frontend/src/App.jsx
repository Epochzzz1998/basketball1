import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import { useAuth } from './auth/AuthContext'
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
import TopicsList from './pages/news/TopicsList'
import TopicPosts from './pages/news/TopicPosts'
import NewsDetail from './pages/news/NewsDetail'
import NewsEdit from './pages/news/NewsEdit'
import MyMessages from './pages/user/MyMessages'
import Messages from './pages/user/Messages'
import Schedule from './pages/schedule/Schedule'
import BbqWage from './pages/bbq/BbqWage'
import BbqLedger from './pages/bbq/BbqLedger'
import BbqBurning from './pages/bbq/BbqBurning'
import BbqMembers from './pages/bbq/BbqMembers'
import BbqSkewers from './pages/bbq/BbqSkewers'
import UserProfile from './pages/user/UserProfile'
import VerifyBindings from './pages/admin/VerifyBindings'
import UserManage from './pages/admin/UserManage'
import UserManageDetail from './pages/admin/UserManageDetail'

/**
 * 路由表（P5-1 骨架）。
 * - /login、/403 是独立页（不套外壳）。
 * - "/" 套 AppLayout 外壳，子页面渲染进它的 <Outlet/>。
 * - 公开页直接放；需登录的用 <ProtectedRoute>；需角色的用 <RoleRoute>。
 * 业务页现用 <Placeholder> 占位，P5-2 逐屏替换为真实页面。
 */
/** 落地页：默认进百家说；若该用户被禁用百家说，顺延到下一个可用模块，避免与守卫来回弹造成循环。 */
function HomeRedirect() {
  const { user } = useAuth()
  const canUse = (f) => !user || user.isSuperManager || user[f] !== false
  const to = canUse('featForum') ? '/news'
    : canUse('featData') ? '/league'
    : canUse('featNews') ? '/official'
    : user ? '/me' : '/login'
  return <Navigate to={to} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/403" element={<Forbidden />} />

      <Route path="/" element={<AppLayout />}>
        {/* 落地页=百家说（论坛）；旧的篮球看板挪到 /league（Dream Union 里的「联盟概览」） */}
        <Route index element={<HomeRedirect />} />
        <Route path="league" element={<Home />} />

        {/* 公开浏览 */}
        <Route path="players" element={<PlayersHome />} />
        <Route path="players/team/:teamCode" element={<TeamPlayers />} />
        <Route path="players/:playerId" element={<PlayerCareer />} />
        <Route path="compare" element={<PlayerCompare />} />
        <Route path="rankings" element={<LeagueRankings />} />
        <Route path="rankings/honors/:group" element={<HonorDetail />} />
        <Route path="rankings/:field" element={<RankingDetail />} />
        <Route path="official" element={<NewsList channel="official" />} />
        {/* 百家说：现在是专题列表；点进单个专题看帖流 */}
        <Route path="news" element={<TopicsList />} />
        <Route path="news/topic/:topicId" element={<TopicPosts />} />
        {/* 发帖/编辑：登录即可；论坛发帖须带 ?topicId（后端按专题权限校验） */}
        <Route path="news/new" element={<ProtectedRoute><NewsEdit /></ProtectedRoute>} />
        <Route path="news/edit/:newsId" element={<ProtectedRoute><NewsEdit /></ProtectedRoute>} />
        <Route path="news/:newsId" element={<NewsDetail />} />
        {/* 用户公开主页（他人视角） */}
        <Route path="users/:userId" element={<UserProfile />} />

        {/* 需登录 */}
        <Route path="me" element={<ProtectedRoute><MyMessages /></ProtectedRoute>} />
        <Route path="messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
        {/* 耿阿姨烤串（菜单按 bbqRole 显隐，后端逐接口校验）：台账店员可见（自己的数据），其余店长专属 */}
        <Route path="bbq/wage" element={<ProtectedRoute><BbqWage /></ProtectedRoute>} />
        <Route path="bbq/ledger" element={<ProtectedRoute><BbqLedger /></ProtectedRoute>} />
        <Route path="bbq/burning" element={<ProtectedRoute><BbqBurning /></ProtectedRoute>} />
        <Route path="bbq/members" element={<ProtectedRoute><BbqMembers /></ProtectedRoute>} />
        <Route path="bbq/skewers" element={<ProtectedRoute><BbqSkewers /></ProtectedRoute>} />

        {/* 需 superManager */}
        <Route path="admin/verify" element={<RoleRoute role="superManager"><VerifyBindings /></RoleRoute>} />
        <Route path="admin/users" element={<RoleRoute role="superManager"><UserManage /></RoleRoute>} />
        <Route path="admin/users/:userId" element={<RoleRoute role="superManager"><UserManageDetail /></RoleRoute>} />
        <Route path="admin/players" element={<RoleRoute role="superManager"><PlayerManage /></RoleRoute>} />
        <Route path="admin/players/:playerId/stats" element={<RoleRoute role="superManager"><PlayerStatsManage /></RoleRoute>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
