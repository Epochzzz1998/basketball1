/**
 * 全站级的模块开关（和「按用户放行」的 featXxx 是两回事）。
 *
 * featXxx 决定"这个人能不能用"，这里决定"这个功能整站还开不开"。
 * 关掉之后：导航里不出现、路由进不去、站内指向它的链接一并不渲染；
 * 后端也有一份同名开关（Constants.NEWS_MODULE_ENABLED）挡接口，两边要一起改。
 */

/** 官方新闻。暂时全站关闭——内容还没规划好，先不对外露出。 */
export const NEWS_MODULE_ENABLED = false
