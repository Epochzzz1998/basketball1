import { ProList } from '@ant-design/pro-components'
import { Badge, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { userInformationApi } from '../../api/userInformation'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')
// 原帖摘要是富文本 HTML 截断，剥掉标签只展示纯文本
const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '')

// 点赞/点踩帖子类消息 msgId=帖子 id；评论类消息 msgId=评论 id、msgIdSecond=帖子 id
const COMMENT_TYPES = ['goodComment', 'badComment', 'commentComment']
const newsIdOf = (m) => (COMMENT_TYPES.includes(m.msgType) ? m.msgIdSecond : m.msgId)

// 动作短语按 msgType 在前端固定构造（库里 commentNews/commentComment 的 contentMsg 存的是评论原文，
// 不是短语——直接显示会变成「xxx "评论内容"」，很怪；这里统一映射，老消息也能正确显示）。
// 帖子类：动作对象就是帖子 → 「xxx 点赞了您的帖子《标题》」；
// 评论类：动作对象是评论、标题只是位置 → 「xxx 点赞了您在《标题》下的评论」（标题缺失=原帖已删，退回短句）。
const actionTextOf = (m) => {
  const t = m.newsTitle ? `「${m.newsTitle}」` : ''
  switch (m.msgType) {
    case 'goodNews': return `点赞了您的帖子${t}`
    case 'badNews': return `点踩了您的帖子${t}`
    case 'commentNews': return `评论了您的帖子${t}`
    case 'goodComment': return t ? `点赞了您在${t}下的评论` : '点赞了您的评论'
    case 'badComment': return t ? `点踩了您在${t}下的评论` : '点踩了您的评论'
    case 'commentComment': return t ? `回复了您在${t}下的评论` : '回复了您的评论'
    default: return m.contentMsg || ''
  }
}

// 第二行明细：评论类展示评论/回复原文（存在 contentMsg 里），点赞类展示原帖/原评论摘要（存在 content 里）
const detailOf = (m) => {
  const s = (v) => stripHtml(v) || '(无内容)'
  switch (m.msgType) {
    case 'commentNews': return `评论内容：${s(m.contentMsg)}`
    case 'commentComment': return `回复内容：${s(m.contentMsg)} ｜ 您的评论：${s(m.content)}`
    case 'goodComment':
    case 'badComment': return `您的评论：${s(m.content)}`
    default: return `原帖：${s(m.content)}` // goodNews / badNews
  }
}

/**
 * 我的消息（登录用户，/me）。替代 user-information.ftl。
 * 点击一条消息 → 跳原帖详情，URL 带 userInformationId——详情页请求 /news/newsShow
 * 时把它传给后端即标记已读（复用老逻辑，无需单独的已读接口）。
 */
export default function MyMessages() {
  const navigate = useNavigate()

  return (
    <ProList
      rowKey="userInformationId"
      headerTitle="我的消息"
      pagination={{ pageSize: 10 }}
      request={async (params) => {
        const res = await userInformationApi.listMyMessages({ page: params.current, limit: params.pageSize })
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
      metas={{
        title: {
          render: (_, m) => {
            const unread = m.whetherRead === 'toRead'
            return (
              <a onClick={() => navigate(`/news/${newsIdOf(m)}?userInformationId=${m.userInformationId}`)}>
                {unread && <Badge status="processing" style={{ marginRight: 6 }} />}
                <span style={{ fontWeight: unread ? 600 : 400 }}>
                  {m.operatorName || '有人'} {actionTextOf(m)}
                </span>
              </a>
            )
          },
        },
        description: {
          render: (_, m) => detailOf(m),
        },
        actions: {
          render: (_, m) => [
            m.whetherRead === 'toRead' ? <Tag key="s" color="blue">未读</Tag> : <Tag key="s">已读</Tag>,
            <span key="t" style={{ color: '#aaa' }}>{fmt(m.msgDate)}</span>,
          ],
        },
      }}
    />
  )
}
