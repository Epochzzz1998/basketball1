// React 19 兼容补丁：antd v5 的静态 message/notification/Modal 原本依赖 React 18 的
// ReactDOM.render（React 19 已移除），不打这个补丁这些静态提示会静默失效（toast 不弹）。
// 必须在任何 antd 静态方法被调用前最先导入。
import '@ant-design/v5-patch-for-react-19'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext'
import { themeConfig } from './theme'

/**
 * 应用入口，自外向内包了三层"环境"：
 * - ConfigProvider：antd 主题/中文语言。
 * - BrowserRouter：前端路由（基于浏览器 History）。
 * - AuthProvider：全局登录态（启动即拉 /user/current）。
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>,
)
