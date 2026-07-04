import { CrownFilled } from '@ant-design/icons'

/**
 * 身份小徽标（用在评论者、帖子作者名旁）：
 * - 超管：皇冠 + 橙红渐变（全站超级管理员）
 * - 题主：蓝色实心（该专题的创建/负责人）
 * - 楼主：灰色描边（本帖发帖人；只在评论区标出，用来区分楼主的评论）
 * 三者可叠加，也可与金色的认证球员徽章共存。
 */

const base = {
  display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
  padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, lineHeight: '16px',
}

export function SuperAdminBadge({ style }) {
  return (
    <span title="超级管理员" style={{ ...base, color: '#fff', background: 'linear-gradient(135deg, #ff7a45, #d4380d)', boxShadow: '0 1px 3px rgba(212,56,13,.30)', ...style }}>
      <CrownFilled style={{ fontSize: 11 }} /> 超管
    </span>
  )
}

export function TopicOwnerBadge({ style }) {
  return (
    <span title="题主（本专题的创建/负责人）" style={{ ...base, color: '#fff', background: 'linear-gradient(135deg, #597ef7, #2f54eb)', boxShadow: '0 1px 3px rgba(47,84,235,.25)', ...style }}>
      题主
    </span>
  )
}

export function OpBadge({ style }) {
  return (
    <span title="楼主（本帖发帖人）" style={{ ...base, fontWeight: 600, color: '#8c8c8c', background: '#f5f5f5', border: '1px solid #e4e4e4', ...style }}>
      楼主
    </span>
  )
}
