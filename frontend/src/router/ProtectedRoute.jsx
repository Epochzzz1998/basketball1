import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../auth/AuthContext'

/**
 * 受保护路由：包住"必须登录才能看"的页面。
 * - 登录态还在确认中 → 转圈，避免误判未登录而跳走；
 * - 未登录 → 重定向到 /login（并记住来源，登录后可跳回）。
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spin style={{ display: 'block', marginTop: 120 }} />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}
