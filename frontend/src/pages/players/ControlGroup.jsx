import useIsMobile from '../../hooks/useIsMobile'

/**
 * 筛选控件的外框：一条浅边 + 一个小字标签，把一组选项圈成一个整体。
 *
 * 两个分段器并排放（数据口径、位置）时，不圈起来看着就是一长条挤在一起的胶囊，
 * 分不清哪几个是一组、各自管什么。标签比纯边框有用——「基础/高阶」和
 * 「全部/后卫/前锋/中锋」本身不说明自己在筛什么。
 */
export default function ControlGroup({ label, children, style }) {
  // 手机上两组控件要挤进一行：标签（含间距）每个约 32px，两个就是 64px，
  // 正是放不下的主因，窄屏直接不显示——选项文字本身已经够自解释
  const isMobile = useIsMobile()
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        border: '1px solid #f0f0f0', borderRadius: 10,
        padding: isMobile ? '3px 6px' : '4px 10px', background: '#fff',
        ...style,
      }}
    >
      {label && !isMobile && <span style={{ fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>{label}</span>}
      {children}
    </div>
  )
}
