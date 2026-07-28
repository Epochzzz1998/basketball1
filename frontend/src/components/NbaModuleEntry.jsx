import { Segmented } from 'antd'
import { useNavigate } from 'react-router-dom'
import { NBA_TOPIC_ID } from '../config/modules'
import { NBA_SECTIONS } from './nbaSections'

/**
 * NBA 专题里的分区标签条：横幅下面**单独一行**，点了下面的内容整块换掉，
 * 横幅和标签条本身留在原位不动。
 *
 * 原来这六项是侧栏里一整组菜单，但**不是每个人都看球**，挂在那儿对多数人是噪音。
 * 挪进专题之后，想看的人点进 NBA 专题就看得见，不想看的人整个不知道它存在。
 *
 * **不是跳到独立页面，而是换专题页的内容区。** 差别在于横幅（专题名、订阅、成员管理、
 * 群聊入口）和标签条一直在，来回切分区不用退出去再进来。地址是
 * `/news/topic/{topicId}/nba/{key}`，所以浏览器前进/后退照常、链接也分享得走。
 *
 * 窄屏靠外层容器横向滚动，不换行——换行会把内容区顶下去一大截，而且七个标签
 * 折成两行看着像两组不相干的东西。
 *
 * 只在 NBA 专题出现，靠 topicId 比对。「哪个专题挂着这个模块」写成配置常量
 * （config/modules.js），没在 forum_topic 上加一列：全站就这一个，为它加列 +
 * 加一套后台开关不划算，写在配置里改起来也就一行。
 */
export default function NbaModuleEntry({ topic, section }) {
  const navigate = useNavigate()
  if (!topic || topic.topicId !== NBA_TOPIC_ID) return null

  const base = `/news/topic/${topic.topicId}`
  return (
    <div className="nba-tabs" style={{ marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
      <Segmented
        // 空串代表「讨论区」（帖子流）。Segmented 的 value 不能是 null，
        // 否则它会当成"未选中"，切回讨论区时高亮不会跟过来
        value={section || ''}
        onChange={(v) => navigate(v ? `${base}/nba/${v}` : base)}
        options={NBA_SECTIONS.map((s) => ({ value: s.key || '', label: s.label, icon: s.icon }))}
        style={{ display: 'inline-flex' }}
      />
    </div>
  )
}
