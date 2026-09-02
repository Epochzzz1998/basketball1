import { Segmented } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { bbqSections } from './bbqSections'

/**
 * 烤串各页顶上的「分区标签条」：点一下直接换页，不用退回上一级再进来。
 *
 * **为什么要有它**：这五个页面在侧栏里是一组，但移动端没有侧栏——只能从「我」页面
 * 一个个点进来，换一页就要退回「我」再点一次。桌面端有侧栏所以一直没暴露这个问题。
 * 专题里的 NBA 数据和开黑战绩早就是标签条了（`TopicSectionTabs`），这里是同一个东西。
 *
 * **和 TopicSectionTabs 的区别**：那个是在**一个专题页内部**换内容区，地址是
 * `/news/topic/{id}/{模块}/{分区}`，横幅留在原位不动。烤串这五个是**五条独立路由**，
 * 各有各的横幅，所以这里是真的 navigate 过去。没有把它们合并成一条路由 + 内容区切换，
 * 是因为那样要改五个页面的结构、动五条现有地址，而收益只是少一次整页渲染。
 *
 * 分区从 {@link bbqSections} 来，和侧栏菜单是**同一份**，不会出现"标签条有、侧栏没有"。
 * 非店内成员（`bbqRole` 为空）不渲染——他们根本进不到这些页面。
 *
 * 窄屏靠外层容器横向滚动，不换行：五个标签折成两行会看着像两组不相干的东西，
 * 而且会把下面的横幅顶下去一大截。
 */
export default function BbqTabs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const sections = bbqSections(user?.bbqRole)
  // 一个分区的时候不画——只有一个选项的标签条是纯噪音
  if (sections.length < 2) return null

  return (
    <div style={{ marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
      <Segmented
        value={pathname}
        onChange={(v) => navigate(v)}
        options={sections.map((s) => ({ value: s.path, label: s.label, icon: s.icon }))}
        style={{ display: 'inline-flex' }}
      />
    </div>
  )
}
