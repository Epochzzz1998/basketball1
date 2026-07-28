import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../auth/AuthContext'

/**
 * 功能模块路由：包住「整块可以被超管按用户关掉」的页面（目前是 NBA 数据）。
 * 可以当布局路由用（不传 children 就渲染 <Outlet/>），一次罩住一整组页面。
 *
 * - 登录态还在确认中 → 转圈，别把已登录的人误判成游客；
 * - 未登录 → 去登录页并记住来路，登录后跳回；
 * - 登录了但没被放行 → 回首页。不是跳 /403：那页写的是"权限不足"，
 *   而这里只是超管没给他开这个模块，两回事。
 *
 * 为什么要挡在渲染之前、而不是在 AppLayout 的副作用里跳：这些页一挂载就发好几个
 * 数据请求，等副作用跑到时请求早发出去了，后端 401 会让 http 拦截器硬跳登录页，
 * 来路也一并丢掉。
 */
export default function FeatureRoute({ feature, children }) {
  const { user, loading, canUse } = useAuth()
  const location = useLocation()
  if (loading) return <Spin style={{ display: 'block', marginTop: 120 }} />
  if (canUse(feature)) return children ?? <Outlet />
  return <Navigate to={user ? '/' : '/login'} state={user ? undefined : { from: location.pathname }} replace />
}
