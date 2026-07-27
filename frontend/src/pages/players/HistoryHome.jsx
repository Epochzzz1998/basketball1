import { HistoryOutlined, TrophyOutlined } from '@ant-design/icons'
import PillTabs from '../../components/PillTabs'
import useUrlState from '../../hooks/useUrlState'
import AllTimeTab from './AllTimeTab'
import AwardHistory from './AwardHistory'

/**
 * 历史数据（/history）：生涯总榜 + 历史荣誉。
 *
 * 这两块原来挂在联盟排行下面，但那一页的每个 tab 都绑着"某一个赛季"——顶部有赛季选择器和
 * 常规赛/季后赛切换，而这两块是跨越 1946-47 至今全部 80 季的累计视角，选赛季对它们不起作用。
 * 摆在一起会让人以为切赛季能改变它们，所以单独成一个菜单。
 */
export default function HistoryHome() {
  // tab 写进 URL：从总榜点进某个球员再返回时，回到的是同一个 tab
  const [tab, setTab] = useUrlState('tab', 'alltime', true)

  return (
    <>
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'alltime', icon: <HistoryOutlined />, label: '历史总榜' },
          { value: 'awards', icon: <TrophyOutlined />, label: '历史荣誉' },
        ]}
      />
      {tab === 'alltime' && <AllTimeTab />}
      {tab === 'awards' && <AwardHistory />}
    </>
  )
}
