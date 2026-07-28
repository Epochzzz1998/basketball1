import { Button, Dropdown } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  FundOutlined, HistoryOutlined, HomeOutlined,
  ScheduleOutlined, SwapOutlined, TeamOutlined, TrophyOutlined,
} from '@ant-design/icons'
import { NBA_TOPIC_ID } from '../config/modules'
import useIsMobile from '../hooks/useIsMobile'

/**
 * NBA 数据模块的入口，长在 NBA 专题的横幅上。
 *
 * 原来这是侧栏里一整组菜单（联盟概览/数据概览/…），但**不是每个人都看球**，
 * 挂在那儿对多数人是噪音。挪进专题之后，想看的人点进 NBA 专题就看得见，
 * 不想看的人整个不知道它存在。
 *
 * 做成下拉而不是一排按钮：横幅上已经有订阅、成员管理、群聊三个按钮了，
 * 再平铺六个会把横幅撑爆，手机上尤其。
 *
 * 只在 NBA 专题出现——靠 topicId 比对。把「哪个专题挂着这个模块」写成配置常量
 * （config/modules.js）而不是在 forum_topic 上加一列：全站就这一个，为它加列 +
 * 加后台开关不划算，写在配置里改起来也就一行。
 */
const ITEMS = [
  { key: '/league', icon: <HomeOutlined />, label: '联盟概览' },
  { key: '/players', icon: <TeamOutlined />, label: '数据概览' },
  { key: '/rankings', icon: <TrophyOutlined />, label: '联盟排行' },
  { key: '/games', icon: <ScheduleOutlined />, label: '每日赛场' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史数据' },
  { key: '/compare', icon: <SwapOutlined />, label: '球员对比' },
]

export default function NbaModuleEntry({ topic }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  if (!topic || topic.topicId !== NBA_TOPIC_ID) return null

  return (
    <Dropdown
      trigger={['click']}
      menu={{ items: ITEMS, onClick: ({ key }) => navigate(key) }}
    >
      <Button
        className="banner-btn"
        size={isMobile ? 'small' : 'middle'}
        icon={<FundOutlined />}
        style={{ flexShrink: 0 }}
      >
        NBA 数据
      </Button>
    </Dropdown>
  )
}
