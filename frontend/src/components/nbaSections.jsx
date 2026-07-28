import {
  CommentOutlined, HistoryOutlined, HomeOutlined, ScheduleOutlined,
  SwapOutlined, TeamOutlined, TrophyOutlined,
} from '@ant-design/icons'
import Home from '../pages/Home'
import PlayersHome from '../pages/players/PlayersHome'
import LeagueRankings from '../pages/players/LeagueRankings'
import HistoryHome from '../pages/players/HistoryHome'
import PlayerCompare from '../pages/players/PlayerCompare'
import DailyGames from '../pages/games/DailyGames'

/**
 * NBA 专题里的分区注册表：标签条和内容区**共用这一份**。
 *
 * 分开写两份的话（一份给标签、一份给"哪个 key 渲染哪个组件"），加一个分区就要改两处，
 * 迟早对不上——多出来的标签点了是空白，或者反过来有组件但没入口。
 *
 * `key` 同时是 URL 里的路径段：`/news/topic/{topicId}/nba/{key}`。
 * 用路径段而不是查询参数，是因为 DailyGames 自己要用 `?date=`，
 * 而 `setSearchParams({date})` 会**整个替换**查询串，把分区参数一起抹掉。
 *
 * 第一项 `null` 是回到帖子流——没有它就只能靠浏览器返回键退出 NBA 分区。
 */
export const NBA_SECTIONS = [
  { key: null, label: '讨论区', icon: <CommentOutlined />, render: null },
  { key: 'league', label: '联盟概览', icon: <HomeOutlined />, render: () => <Home /> },
  { key: 'players', label: '数据概览', icon: <TeamOutlined />, render: () => <PlayersHome /> },
  { key: 'rankings', label: '联盟排行', icon: <TrophyOutlined />, render: () => <LeagueRankings /> },
  { key: 'games', label: '每日赛场', icon: <ScheduleOutlined />, render: () => <DailyGames /> },
  { key: 'history', label: '历史数据', icon: <HistoryOutlined />, render: () => <HistoryHome /> },
  { key: 'compare', label: '球员对比', icon: <SwapOutlined />, render: () => <PlayerCompare /> },
]

/**
 * 路径段 → 渲染函数；不认识的段（手打错、老链接）返回 null，调用方退回帖子流。
 *
 * 存渲染函数而不是组件引用：React Compiler 会把「render 期间取到一个大写变量再 <Var />」
 * 判定成"在渲染中创建组件"（它没法确定那个变量在多次渲染间是同一个）。
 * 返回 `() => <Home />` 之后，调用点只是一次普通函数调用，拿到的仍然是 type 为 Home 的元素，
 * Home 自己的 hooks 和状态照常。
 */
export const sectionRenderer = (key) =>
  NBA_SECTIONS.find((s) => s.key && s.key === key)?.render || null
