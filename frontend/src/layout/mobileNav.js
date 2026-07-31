import {
  CalendarOutlined, MessageOutlined, ReadOutlined, UserOutlined,
} from '@ant-design/icons'

/**
 * 移动端底部 Tab 的定义与「这一页要不要显示底部栏」的规则。
 *
 * 单独成文件是为了让规则能被独立验证——底部栏该不该出现，靠一页页手点是查不干净的
 * （路由有三十多条）。这里导出纯函数，可以直接拿路由表跑一遍。
 */

export const TABS = [
  { key: 'forum', path: '/news', label: '百家说', icon: ReadOutlined },
  { key: 'schedule', path: '/schedule', label: '日程', icon: CalendarOutlined },
  { key: 'pm', path: '/messages', label: '私信', icon: MessageOutlined },
  { key: 'mine', path: '/mine', label: '我', icon: UserOutlined },
]

/**
 * 不显示底部栏的页面。分三类，理由各不相同：
 *
 * 1. **沉浸式**（群聊、私信会话）——它们已经把自己钉死在视口上、内部自己滚，
 *    底部再压一条会盖住输入框，而且这些页面的目标就是"专心聊这一件事"。
 * 2. **详情/编辑页**（帖子详情、发帖、编辑）——进来是为了读完或写完，
 *    此时给四个跳走的入口是干扰；顶部本来就有返回。
 * 3. **NBA 数据**——整块是另一个应用，横向滚动的宽表配底部栏会很挤，
 *    而且它有自己的分区标签条导航。
 *
 * 反过来，**列表类和工作类页面都保留**（百家说、专题内、日程、私信列表、我、
 * 新闻、耿阿姨烤串、管理页、个人主页）：在这些页面之间横跳正是底部栏的用处。
 */
/**
 * NBA 数据页：整块是另一个应用，宽表为主，配底部栏会很挤，而且它有自己的分区标签条。
 *
 * 这份名单**只管底部栏藏不藏**了。早先手势也用它整类排除，理由是"横滑归表格"；
 * 现在改成按手势自己的条件判断（起手要在左边缘 30px 内，且表格按下时就停在最左端），
 * 那些页面照样能左滑返回——它们左上角有返回钮，就该能滑。
 * 详见 {@link ./useAppSwipe.js}。
 */
const NBA_PATTERNS = [
  /^\/news\/topic\/[^/]+\/nba\//,        // 专题里的 NBA 分区
  /^\/news\/topic\/[^/]+\/lol\//,        // 专题里的开黑战绩分区
  /^\/league$/,
  /^\/players(\/|$)/,
  /^\/rankings(\/|$)/,
  /^\/games(\/|$)/,
  /^\/history$/,
  /^\/compare$/,
]


const HIDE_PATTERNS = [
  /^\/search$/,                          // 整页搜索（自带返回，且键盘一起来底部栏就会被顶飞）
  /^\/news\/new$/,                       // 发帖
  /^\/news\/edit\//,                     // 编辑帖子
  /^\/news\/topic\/[^/]+\/chat$/,        // 专题群聊（沉浸式）
  /^\/news\/[^/]+$/,                     // 帖子详情。注意要排在 /news/topic/... 之后判断，
                                         // 但这里用的是"全部试一遍"，且 /news/topic/x 有两段
                                         // 不会被这条单段的规则命中
  ...NBA_PATTERNS,
]

/**
 * 这一页要不要显示底部 Tab 栏。
 *
 * @param pathname 当前路径
 * @param search   查询串。私信页要看它：不带 peerId 是会话列表（tab 本身，要显示），
 *                 带了就是聊天窗（沉浸式，要藏）。同一个路由两种形态，只看 pathname 判断不出来。
 */
export const showTabBar = (pathname, search = '') => {
  if (pathname === '/messages') {
    return !new URLSearchParams(search).get('peerId')
  }
  return !HIDE_PATTERNS.some((re) => re.test(pathname))
}

/**
 * 「现在正站在第几个 Tab 的首页上」——不是就返回 -1。
 *
 * **必须连查询串一起看**，这是唯一容易漏掉的地方：私信会话的地址是
 * `/messages?peerId=xxx`，`pathname` 仍然是 `/messages`。只比 pathname 的话，
 * 聊天页会被当成「私信 Tab 的首页」，在里面横滑就变成了切 Tab。
 *
 * 底部栏的显隐（`showTabBar`）早就正确处理了这一点，但左右滑手势当初是另写的一份判断，
 * 两处对「什么算 Tab 首页」的理解就此分叉。抽成这一个函数之后它们不可能再对不上。
 */
export const tabIndexOf = (pathname, search = '') => {
  if (!showTabBar(pathname, search)) {
    return -1
  }
  return TABS.findIndex((t) => t.path === pathname)
}

/**
 * 这一页要不要显示 App 顶栏（全局搜索框 + 刷新）。
 *
 * **只有四个 Tab 首页有。** 早先是"除了 /search 全都有"，结果是发帖器、帖子详情、
 * 专题内页、NBA 数据页顶上都顶着一条搜索框——那些页面里"搜全站"根本不是下一步动作，
 * 白占掉手机上最值钱的一行。搜索属于逛的时候，逛的入口就是这四个 Tab。
 *
 * 私信要连查询串一起看：带 peerId 是聊天窗（沉浸式），不是 Tab 首页。
 * 判据直接借 `tabIndexOf`，和底部栏、左右滑手势用的是同一份定义，不会各说各的。
 *
 * `/search` 自己顶上就是一条真的搜索框，也不需要这条（它和这条**等高**，
 * 所以 AppLayout 里那个占位块在那一页仍然要留，位置才接得上）。
 */
export const showTopBar = (pathname, search = '') => tabIndexOf(pathname, search) >= 0

/**
 * 当前该高亮哪个 tab；都不匹配返回 null（比如在耿阿姨烤串里，底部栏显示但没有一个是选中的）。
 *
 * 专题只认 `/news/topic/{id}` 本身，**不认它下面的 chat 和 nba 子路由**。
 * 那两页底部栏不显示、这个返回值当下用不到，但"返回了错的值只是碰巧没人读"
 * 正是以后加个抽屉高亮就会踩的坑。
 */
export const activeTab = (pathname) => {
  if (pathname === '/mine') return 'mine'
  if (pathname.startsWith('/messages')) return 'pm'
  if (pathname.startsWith('/schedule')) return 'schedule'
  if (pathname === '/news' || /^\/news\/topic\/[^/]+$/.test(pathname)) return 'forum'
  return null
}
