import { Segmented } from 'antd'
import { GlossaryButton } from './statGlossary'

/**
 * 「基础数据 / 高阶数据」开关，放在表格外面而不是 ProTable 的工具条里。
 *
 * 塞进 toolBarRender 的代价是表格再也不可能是纯表格——工具条一出现就多一条带内外
 * 边距的横条，球队页那种"无标题无搜索、只要一张表"的嵌入就做不成了。放到外面之后
 * 表格可以整体关掉工具条（toolBarRender={false}），跟逐季/逐场那个开关同一个位置、
 * 同一种视觉层级。
 */
export default function StatViewSwitch({ value, onChange, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, ...style }}>
      <Segmented
        size="small"
        value={value}
        onChange={onChange}
        options={[{ label: '基础数据', value: 'basic' }, { label: '高阶数据', value: 'adv' }]}
      />
      {/* 高阶列的释义只在悬停时出现，手机没有悬停，这里是唯一的入口 */}
      {value === 'adv' && <GlossaryButton />}
    </div>
  )
}
