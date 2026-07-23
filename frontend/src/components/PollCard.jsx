import { Popconfirm, message } from 'antd'
import { BarChartOutlined, CheckCircleFilled, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 投票卡（蓝色系，与橙色打分卡区分）：主题 + 选项行（票数条 + 百分比），点选项即投/改票，
 * 我的选择高亮打勾。item = {itemId, subject, options[], count, counts{idx:票数}, myChoice}；
 * 数据由上层（NewsDetail）统一持有，onVote(itemId, idx) 投票；canDelete 出删除；disabled=帖已锁定。
 */
export default function PollCard({ item, onVote, onDelete, canDelete, disabled }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const count = item.count || 0
  const counts = item.counts || {}
  const my = item.myChoice

  const handleVote = (idx) => {
    if (!user) { message.info('请先登录'); navigate('/login'); return }
    if (disabled) { message.info('该帖已被锁定，暂不能投票'); return }
    if (my === idx) return // 点自己已选的不重复提交
    onVote?.(item.itemId, idx)
  }

  return (
    <div
      style={{
        background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 12,
        padding: isMobile ? '12px 14px' : '14px 18px', maxWidth: 520,
      }}
    >
      {/* 头行：主题 + 参与数 + 删除 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChartOutlined style={{ color: '#1677ff' }} />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          投票：{item.subject}
        </span>
        <span style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>{count} 人参与</span>
        {canDelete && (
          <Popconfirm title="删除该投票？投票记录一并清除" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => onDelete?.(item.itemId)}>
            <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} />
          </Popconfirm>
        )}
      </div>

      {/* 选项：点击即投/改票；条形显示占比 */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(item.options || []).map((opt, idx) => {
          const n = counts[idx] ?? counts[String(idx)] ?? 0
          const pct = count ? Math.round((n / count) * 100) : 0
          const mine = my === idx
          return (
            <div
              key={idx}
              onClick={() => handleVote(idx)}
              style={{
                position: 'relative', overflow: 'hidden', borderRadius: 8,
                border: `1px solid ${mine ? '#1677ff' : '#bae0ff'}`, background: '#fff',
                padding: '7px 12px', cursor: disabled ? 'default' : 'pointer', userSelect: 'none',
              }}
            >
              {/* 占比底条 */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: mine ? '#bae0ff' : '#e6f4ff', transition: 'width .25s' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                {mine && <CheckCircleFilled style={{ color: '#1677ff' }} />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: mine ? 700 : 400 }}>{opt}</span>
                <span style={{ color: '#8c8c8c', fontSize: 12, flexShrink: 0 }}>{n} 票 · {pct}%</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: '#69b1ff', marginTop: 8 }}>
        {disabled ? '帖子已锁定，投票只读' : my != null ? '已投票，点其他选项可改票' : '点击选项参与投票'}
      </div>
    </div>
  )
}
