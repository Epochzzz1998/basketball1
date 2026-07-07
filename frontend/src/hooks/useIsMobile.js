import { Grid } from 'antd'

/**
 * 全站统一的移动端判断：屏宽 < 768px（antd 的 md 断点）视为移动端。
 * 用法：const isMobile = useIsMobile()
 *
 * 注意：必须在组件顶层调用（它内部是 Grid.useBreakpoint 这个 Hook），
 * 不能放在条件分支或提前 return 之后。
 */
export default function useIsMobile() {
  const screens = Grid.useBreakpoint()
  return !screens.md
}
