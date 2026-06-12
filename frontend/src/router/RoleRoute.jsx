import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../auth/AuthContext'

/**
 * 角色路由：在"已登录"之上再要求某角色。role = 'superManager' | 'manager'。
 * 角色标识来自后端 /user/current（isSuperManager / isManagerOrOver），与后端
 * @RequiresRole 同源（前端只控制"看得见/进得去"，后端接口仍强制校验，双保险）。
 */
export default function RoleRoute({ role, children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spin style={{ display: 'block', marginTop: 120 }} />
  if (!user) return <Navigate to="/login" replace />
  const allowed =
    role === 'superManager' ? user.isSuperManager
      : role === 'manager' ? user.isManagerOrOver
        : true
  if (!allowed) return <Navigate to="/403" replace />
  return children
}
