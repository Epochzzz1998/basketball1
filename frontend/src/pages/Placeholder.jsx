import { Result } from 'antd'

/**
 * 占位页：P5-1 只搭骨架，真实业务页在 P5-2 逐屏实现。
 * 路由/权限/菜单已经能跑通——用它先把"路由表"占住。
 */
export default function Placeholder({ title }) {
  return <Result status="info" title={title} subTitle="该页面将在 P5-2 用 React 实现。" />
}
