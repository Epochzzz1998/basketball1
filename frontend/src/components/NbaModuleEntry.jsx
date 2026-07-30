import { NBA_TOPIC_ID } from '../config/modules'
import { NBA_SECTIONS } from './nbaSections'
import TopicSectionTabs from './TopicSectionTabs'

/**
 * NBA 专题里的分区标签条。
 *
 * 只剩一层包装：标签条的长相和行为是通用的（见 {@link TopicSectionTabs}），
 * 这里只提供两样东西——挂在哪个专题、有哪些分区。开黑战绩那边是同样的一层
 * （LolModuleEntry），两者共用同一份渲染逻辑，所以不会各自跑偏。
 *
 * 这一组页面原来是侧栏里一整组菜单，但**不是每个人都看球**，挂在那儿对多数人是噪音。
 * 挪进专题之后，想看的人点进 NBA 专题就看得见，不想看的人整个不知道它存在。
 *
 * 「哪个专题挂着这个模块」写成配置常量（config/modules.js），没在 forum_topic 上加列：
 * 为它加列再加一套后台开关不划算，写在配置里换专题也就改一行。
 */
export default function NbaModuleEntry({ topic, section }) {
  return (
    <TopicSectionTabs
      topic={topic}
      section={section}
      topicId={NBA_TOPIC_ID}
      moduleKey="nba"
      sections={NBA_SECTIONS}
    />
  )
}
