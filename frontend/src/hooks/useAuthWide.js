import { Grid } from 'antd'

/**
 * 登录 / 注册页的「算不算宽屏」。
 *
 * 和全站的 `useIsMobile` 差一点，而这一点是故意的：**首帧**断点还没算出来时
 * （`screens.md` 是 undefined），这里判成宽屏，`useIsMobile` 判成移动端。
 * 登录页左边那块品牌面板只在宽屏显示，按 `useIsMobile` 的话每次进页面它都会
 * 先不见、再闪出来。
 *
 * 单独一个文件而不是挂在 AuthShell 上：组件文件里再导出一个非组件的东西，
 * Fast Refresh 就整个文件失效（`react-refresh/only-export-components`）。
 * 而且外壳和用它的两个页面要读同一个判断——放在中立的地方，谁都不必依赖谁。
 */
export default function useAuthWide() {
  return Grid.useBreakpoint().md !== false
}
