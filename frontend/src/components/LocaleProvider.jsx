import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { useTranslation } from 'react-i18next'
import { themeConfig } from '../theme'

/**
 * antd 自己的文案（日历的「确定」、表格的「暂无数据」、分页……）跟着语言切。
 *
 * useTranslation 订阅了 languageChanged：切换时这里重渲染，ConfigProvider 拿到新的 locale。
 * antd 自带 73 个语言包，这一块是整个英文化里唯一"免费"的部分。
 *
 * 单独成文件不放在 main.jsx 里：Vite 的 Fast Refresh 要求一个文件要么只导出组件、
 * 要么不导出组件，入口文件里夹一个组件会让整棵树失去热更新。
 */
export default function LocaleProvider({ children }) {
  const { i18n } = useTranslation()
  return (
    <ConfigProvider locale={i18n.language === 'en' ? enUS : zhCN} theme={themeConfig}>
      {children}
    </ConfigProvider>
  )
}
