import { Segmented } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  HistoryOutlined, HomeOutlined, ScheduleOutlined,
  SwapOutlined, TeamOutlined, TrophyOutlined,
} from '@ant-design/icons'
import { NBA_TOPIC_ID } from '../config/modules'

/**
 * NBA 数据模块的入口：NBA 专题内容区最上面**单独一行**的横向标签条。
 *
 * 原来这是侧栏里一整组菜单（联盟概览/数据概览/…），但**不是每个人都看球**，
 * 挂在那儿对多数人是噪音。挪进专题之后，想看的人点进 NBA 专题就看得见，
 * 不想看的人整个不知道它存在。
 *
 * 做成一行标签而不是下拉按钮：六个页面是**并列的入口**，摊开来一眼看全比藏进
 * 下拉里好；单独占一行且放最上面，是因为它属于「模块导航」，和下面那些
 * 「怎么筛帖子」（搜索、类别、最新/最热）根本不是一类东西。
 *
 * 窄屏靠外层容器横向滚动，不换行——换行会把内容区顶下去一大截，而且六个标签
 * 折成两行看着像两组不相干的东西。
 *
 * 只在 NBA 专题出现，靠 topicId 比对。「哪个专题挂着这个模块」写成配置常量
 * （config/modules.js），没在 forum_topic 上加一列：全站就这一个，为它加列 +
 * 加一套后台开关不划算，写在配置里改起来也就一行。
 */
const ITEMS = [
  { value: '/league', icon: <HomeOutlined />, label: '联盟概览' },
  { value: '/players', icon: <TeamOutlined />, label: '数据概览' },
  { value: '/rankings', icon: <TrophyOutlined />, label: '联盟排行' },
  { value: '/games', icon: <ScheduleOutlined />, label: '每日赛场' },
  { value: '/history', icon: <HistoryOutlined />, label: '历史数据' },
  { value: '/compare', icon: <SwapOutlined />, label: '球员对比' },
]

export default function NbaModuleEntry({ topic }) {
  const navigate = useNavigate()
  if (!topic || topic.topicId !== NBA_TOPIC_ID) return null

  return (
    <div className="nba-tabs" style={{ marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
      <Segmented
        // 不给选中值：这六个都是「跳走」，专题页本身不属于其中任何一个，
        // 硬选一个会让人以为当前就在那一页
        value=""
        onChange={(v) => v && navigate(v)}
        options={ITEMS}
        style={{ display: 'inline-flex' }}
      />
    </div>
  )
}
