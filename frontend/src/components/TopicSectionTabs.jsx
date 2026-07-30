import { Segmented } from 'antd'
import { useNavigate } from 'react-router-dom'

/**
 * 专题里的「分区标签条」：横幅下面单独一行，点了下面的内容整块换掉，
 * 横幅和标签条本身留在原位不动。
 *
 * **不是跳到独立页面，而是换专题页的内容区。** 差别在于横幅（专题名、订阅、成员管理、
 * 群聊入口）和标签条一直在，来回切分区不用退出去再进来。地址是
 * `/news/topic/{topicId}/{moduleKey}/{section}`，所以浏览器前进/后退照常、链接也分享得走。
 *
 * ## 为什么做成通用组件
 *
 * 这条标签条对 NBA 数据和开黑战绩是**同一个东西**，只差两样：挂在哪个专题（一个常量）、
 * 有哪些分区（一份注册表）。当初只有 NBA 时它写在 NbaModuleEntry 里没问题；
 * 加第二个模块的时候如果照抄一份，两份 40 行的 JSX 就开始各自演化——
 * 而它们本该永远长得一样。所以抽出来，两个模块各留一个几行的包装。
 *
 * 窄屏靠外层容器横向滚动，不换行——换行会把内容区顶下去一大截，而且七八个标签
 * 折成两行看着像两组不相干的东西。
 *
 * @param topic      当前专题（可能为 null）
 * @param section    当前分区的路径段；null / 空 = 回到帖子流
 * @param topicId    这个模块挂在哪个专题上，对不上就整个不渲染
 * @param moduleKey  URL 里的模块段，如 `nba` / `lol`
 * @param sections   分区注册表 `[{ key, label, icon }]`，第一项的 key 为 null 代表帖子流
 */
export default function TopicSectionTabs({ topic, section, topicId, moduleKey, sections }) {
  const navigate = useNavigate()
  if (!topic || topic.topicId !== topicId) return null

  const base = `/news/topic/${topic.topicId}`
  return (
    <div className="nba-tabs" style={{ marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
      <Segmented
        // 空串代表「讨论区」（帖子流）。Segmented 的 value 不能是 null，
        // 否则它会当成"未选中"，切回讨论区时高亮不会跟过来
        value={section || ''}
        onChange={(v) => navigate(v ? `${base}/${moduleKey}/${v}` : base)}
        options={sections.map((s) => ({ value: s.key || '', label: s.label, icon: s.icon }))}
        style={{ display: 'inline-flex' }}
      />
    </div>
  )
}
