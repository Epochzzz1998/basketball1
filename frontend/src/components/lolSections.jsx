import { CommentOutlined, LinkOutlined, TrophyOutlined, UnorderedListOutlined } from '@ant-design/icons'
import LolFeed from '../pages/lol/LolFeed'
import LolBoard from '../pages/lol/LolBoard'
import LolBind from '../pages/lol/LolBind'

/**
 * 开黑战绩的分区注册表：标签条和内容区**共用这一份**。
 *
 * 分成两份的话（一份给标签、一份给"哪个 key 渲染哪个组件"），加一个分区就要改两处，
 * 迟早对不上——多出来的标签点了是空白，或者反过来有组件但没入口。
 * NBA 那份（nbaSections）是同样的结构，改法也一样。
 *
 * `key` 同时是 URL 里的路径段：`/news/topic/{topicId}/lol/{key}`。
 * 第一项 `null` 是回到帖子流，没有它就只能靠浏览器返回键退出这个模块。
 *
 * 顺序有讲究：**战绩流在最前**。它是每天会看一眼的东西，而榜单是隔几天看一次的，
 * 绑定是一辈子点一次的——把一次性的功能放在第一个会让人每次进来都先看见它。
 */
export const LOL_SECTIONS = [
  { key: null, label: '讨论区', icon: <CommentOutlined />, render: null },
  { key: 'feed', label: '战绩流', icon: <UnorderedListOutlined />, render: () => <LolFeed /> },
  { key: 'board', label: '榜单', icon: <TrophyOutlined />, render: () => <LolBoard /> },
  { key: 'bind', label: '绑定账号', icon: <LinkOutlined />, render: () => <LolBind /> },
]

/**
 * 路径段 → 渲染函数；不认识的段（手打错、老链接）返回 null，调用方退回帖子流。
 *
 * 存渲染函数而不是组件引用：React Compiler 会把「render 期间取到一个大写变量再 `<Var />`」
 * 判定成"在渲染中创建组件"（它没法确定那个变量在多次渲染间是同一个）。
 * 返回 `() => <LolFeed />` 之后，调用点只是一次普通函数调用，
 * 拿到的仍然是 type 为 LolFeed 的元素，组件自己的 hooks 和状态照常。
 */
export const lolSectionRenderer = (key) =>
  LOL_SECTIONS.find((s) => s.key && s.key === key)?.render || null
