import { Tooltip } from 'antd'
import {
  EyeInvisibleOutlined, LockOutlined, StopOutlined, TagOutlined, UnlockOutlined,
} from '@ant-design/icons'

/**
 * 专题的状态标记：私密/公开、无浏览权、未公开、所属类别。
 *
 * ## 为什么从 Tag 换成裸图标
 *
 * 原来每一项都是一枚 antd `Tag`——彩色底、描边、内边距、图标加文字。四五个排下来
 * 要占两行，一张卡片里最抢眼的东西成了这排彩色小方块，而它们说的都是**次要属性**
 * （这个专题公开不公开），真正要看的标题和简介反而被挤到后面。
 *
 * 卡片右上角的置顶/编辑/删除一直是裸图标，看着就清爽。这里统一成同一套：
 * 一行、无底色、12px、灰调，鼠标悬停才出文字说明。
 *
 * ## 类别为什么还留着文字
 *
 * 其余几项的取值是**有限且固定**的（私密/公开、有没有权限、列不列出），
 * 一个图标就能一一对应。类别不是——它是用户自己建的名字，换成图标就等于把
 * 这条信息藏进了 tooltip 里。所以它保留文字，但去掉 Tag 的外壳，
 * 只留一个小图标 + 名字，视觉重量和旁边几个图标一致。
 *
 * ## 置顶不在这里
 *
 * 它本来也有一枚 Tag，但右上角那个图钉图标已经用实心/空心表达了同一件事。
 * 一个状态在同一张卡上说两遍，删掉重复的那个。
 *
 * @param topic 专题对象（visibility / locked / listed / categoryName）
 * @param light 是否压在深色背景上（有背景图的卡片、专题横幅）——那时要翻成浅色
 */
export default function TopicBadges({ topic, light = false, style }) {
  if (!topic) return null
  const priv = topic.visibility === 'private'
  const color = light ? 'rgba(255,255,255,.85)' : '#bbb'
  const shadow = light ? '0 1px 4px rgba(0,0,0,.5)' : undefined

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        fontSize: 12, color, textShadow: shadow, ...style,
      }}
    >
      <Tooltip title={priv ? '私密专题，需要加入才能看' : '公开专题'}>
        {priv ? <LockOutlined /> : <UnlockOutlined />}
      </Tooltip>

      {/* 无浏览权是唯一一个「拦住你」的状态，给它红色——其余几项只是陈述事实 */}
      {topic.locked && (
        <Tooltip title="你没有这个专题的浏览权限">
          <StopOutlined style={{ color: light ? '#ffa39e' : '#ff7875' }} />
        </Tooltip>
      )}

      {topic.listed === false && (
        <Tooltip title="不在专题列表里公开，只能通过链接进入">
          <EyeInvisibleOutlined />
        </Tooltip>
      )}

      {topic.categoryName && (
        <Tooltip title="所属类别">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: 110 }}>
            <TagOutlined />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {topic.categoryName}
            </span>
          </span>
        </Tooltip>
      )}
    </span>
  )
}
