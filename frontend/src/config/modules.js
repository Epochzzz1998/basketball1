/**
 * 全站级的模块开关（和「按用户放行」的 featXxx 是两回事）。
 *
 * featXxx 决定"这个人能不能用"，这里决定"这个功能整站还开不开"。
 * 关掉之后：导航里不出现、路由进不去、站内指向它的链接一并不渲染；
 * 后端也有一份同名开关（Constants.NEWS_MODULE_ENABLED）挡接口，两边要一起改。
 */

/** 官方新闻。暂时全站关闭——内容还没规划好，先不对外露出。 */
export const NEWS_MODULE_ENABLED = false

/**
 * 挂着 NBA 数据模块入口的专题（NBA🏀）。
 *
 * NBA 那一组页面原来在侧栏，现在入口只出现在这个专题的横幅上（NbaModuleEntry）。
 * 没有在 forum_topic 上加一列「这个专题挂了哪个模块」：全站就这一个，为它加列
 * 再加一套后台开关不划算，写成常量改起来也就一行。
 *
 * 真要换专题：改这里的 id 即可，路由和后端门禁都不用动。
 */
export const NBA_TOPIC_ID = 'd0e7cfae-d26b-42f2-9b32-09b90332ea3d'
