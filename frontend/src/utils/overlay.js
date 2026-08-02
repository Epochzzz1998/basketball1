/**
 * 这次触摸是不是落在浮层（抽屉/弹窗/图片预览）里。
 *
 * 全局手势（左右滑 useAppSwipe、下拉刷新 usePullToRefresh）都挂在 window 上，
 * 浮层开着的时候它们照样收到事件——而浮层把背景页滚动锁死后 `window.scrollY`
 * 恒为 0，下拉刷新会把抽屉里**每一次**往下的手指移动都当成「从顶部开始的下拉」
 * 并 preventDefault，表现就是抽屉里上下滑不动（2026-08-03 LoL 对局详情实况）。
 *
 * 判定必须放在**起手**那一刻：浮层可能在手势中途关掉，到 touchend 再查就找不到了。
 *
 * 两个手势共用这一份名单。各写各的迟早漂移——推送白名单那次就是注释声称的规则
 * 和表的实际内容对不上，没有报错，只能靠对照发现。
 */
export const inOverlay = (el) => !!(el && typeof el.closest === 'function'
  && el.closest('.ant-drawer, .ant-modal-wrap, .ant-modal-mask, .ant-image-preview-wrap, .ant-popover, .ant-select-dropdown'))
