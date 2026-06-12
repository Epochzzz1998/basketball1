import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext'

/**
 * 应用入口，自外向内包了三层"环境"：
 * - ConfigProvider：antd 主题/中文语言。
 * - BrowserRouter：前端路由（基于浏览器 History）。
 * - AuthProvider：全局登录态（启动即拉 /user/current）。
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>,
)
