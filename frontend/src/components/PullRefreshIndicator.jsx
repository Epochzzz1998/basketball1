import { LoadingOutlined, ArrowDownOutlined } from '@ant-design/icons'

/**
 * 下拉刷新的指示器。跟着手指走的那一小条。
 *
 * 用 height 而不是 transform 把它撑开：内容要被真的往下推，而不是被它盖住——
 * 盖住的话第一条帖子会在下拉时被遮掉一半。
 */
export default function PullRefreshIndicator({ pull, refreshing, threshold }) {
  if (pull <= 0 && !refreshing) return null
  const ready = pull >= threshold
  return (
    <div
      style={{
        height: pull,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontSize: 12, color: '#999',
        // 松手回弹要有过渡，跟手拖动时不能有（否则会滞后于手指）
        transition: refreshing || pull === 0 ? 'height .2s' : 'none',
      }}
    >
      {refreshing
        ? <><LoadingOutlined /> 正在刷新</>
        : <><ArrowDownOutlined style={{ transform: ready ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          {ready ? '松开刷新' : '下拉刷新'}</>}
    </div>
  )
}
