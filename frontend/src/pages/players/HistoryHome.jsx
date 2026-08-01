import { HistoryOutlined, SolutionOutlined, TrophyOutlined } from '@ant-design/icons'
import PillTabs from '../../components/PillTabs'
import useUrlState from '../../hooks/useUrlState'
import AllTimeTab from './AllTimeTab'
import AwardHistory from './AwardHistory'
import DraftHistory from './DraftHistory'

/**
 * 历史数据（/history）：生涯总榜 + 历史荣誉。
 *
 * 这两块原来挂在联盟排行下面，但那一页的每个 tab 都绑着"某一个赛季"——顶部有赛季选择器和
 * 常规赛/季后赛切换，而这两块是跨越 1946-47 至今全部 80 季的累计视角，选赛季对它们不起作用。
 * 摆在一起会让人以为切赛季能改变它们，所以单独成一个菜单。
 */
export default function HistoryHome() {
  // tab 写进 URL：从总榜点进某个球员再返回时，回到的是同一个 tab；
  // 球员身份头上那枚选秀标签也是靠 ?tab=draft 直接落到选秀那一块的。
  // 第三个参数（按数字解析）不能给：tab 的值是 'alltime'/'draft' 这类字符串，
  // 传 true 会让读回来的值恒为 NaN，于是永远退回默认页签
  const [tab, setTab] = useUrlState('tab', 'alltime')

  return (
    <>
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'alltime', icon: <HistoryOutlined />, label: '历史总榜' },
          { value: 'awards', icon: <TrophyOutlined />, label: '历史荣誉' },
          { value: 'draft', icon: <SolutionOutlined />, label: '历史选秀' },
        ]}
      />
      {tab === 'alltime' && <AllTimeTab />}
      {tab === 'awards' && <AwardHistory />}
      {tab === 'draft' && <DraftHistory />}
    </>
  )
}
