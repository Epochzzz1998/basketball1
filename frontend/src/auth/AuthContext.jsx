import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'

/**
 * 全局登录态：用 React 自带的 Context 在整棵组件树里共享"当前用户"，
 * 任何组件 const { user, login, logout } = useAuth() 即可取用，无需第三方状态库。
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)     // 当前登录用户(含 isSuperManager 等)，未登录为 null
  const [loading, setLoading] = useState(true) // 首次确认登录态期间为 true（避免闪烁/误跳转）

  // 应用启动时问后端"我登录了吗"（靠浏览器已存的 Session Cookie）
  useEffect(() => {
    authApi
      .current()
      .then((u) => setUser(u))
      .catch(() => setUser(null)) // 401 → 视为未登录
      .finally(() => setLoading(false))
  }, [])

  const login = async (values) => {
    await authApi.login(values)        // 通过则后端在 session 里记录登录
    const u = await authApi.current()  // 再拉一次拿到昵称/角色
    setUser(u)
    return u
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** 自定义 Hook：组件里 const { user } = useAuth() */
export function useAuth() {
  return useContext(AuthContext)
}
