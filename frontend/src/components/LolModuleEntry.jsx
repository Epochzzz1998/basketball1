import { LOL_TOPIC_ID } from '../config/modules'
import { LOL_SECTIONS } from './lolSections'
import TopicSectionTabs from './TopicSectionTabs'

/**
 * 开黑战绩专题里的分区标签条。
 *
 * 和 {@link NbaModuleEntry} 一样只是一层包装——标签条本身是通用的
 * （{@link TopicSectionTabs}），这里只提供「挂在哪个专题」和「有哪些分区」。
 *
 * 挂在五条悟专题而不是英雄联盟专题：那个专题是私密的，成员判定现成，
 * 战绩只有圈内人看得到——而这正是这个模块需要的门禁，一行代码都不用写。
 */
export default function LolModuleEntry({ topic, section }) {
  return (
    <TopicSectionTabs
      topic={topic}
      section={section}
      topicId={LOL_TOPIC_ID}
      moduleKey="lol"
      sections={LOL_SECTIONS}
    />
  )
}
