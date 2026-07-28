import { useRef } from 'react'
import { ProList } from '@ant-design/pro-components'
import { Badge, Button, Tag, message } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { userInformationApi } from '../../api/userInformation'
import { useAuth } from '../../auth/AuthContext'
import { actionTextOf, detailOf, linkOf } from '../../utils/notification'
import PushToggle from '../../components/PushToggle'

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')

// 文案与跳转规则搬到了 utils/notification.js —— service worker 弹的那条系统通知
// 必须和这里说的是同一件事，所以两边共用一份，见那个文件顶部的说明

/**
 * 我的消息（登录用户，/me）。替代 user-information.ftl。
 * 点击一条消息 → 跳原帖详情，URL 带 userInformationId——详情页请求 /news/newsShow
 * 时把它传给后端即标记已读（复用老逻辑，无需单独的已读接口）。
 */
export default function MyMessages() {
  const navigate = useNavigate()
  const { dn } = useAuth() // 备注名：我给谁备注过，这里也要显示备注名
  const actionRef = useRef()

  const readAll = async () => {
    try {
      const res = await userInformationApi.readAll()
      message.success(res?.msg || '已全部标记为已读')
      actionRef.current?.reload()
      window.dispatchEvent(new Event('unread-changed')) // 顶栏红点同步归零
    } catch (e) {
      message.error(e?.msg || '操作失败')
    }
  }

  return (
    <ProList
      actionRef={actionRef}
      rowKey="userInformationId"
      headerTitle="我的消息"
      toolBarRender={() => [
        // 推送开关放这儿：这一页就是「我的通知」，想开关通知的人自然会来这儿找，
        // 埋进设置页反而没人找得到
        <PushToggle key="push" />,
        <Button key="readall" icon={<CheckOutlined />} onClick={readAll}>一键已读</Button>,
      ]}
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
              <a onClick={() => navigate(linkOf(m))}>
                {unread && <Badge status="processing" style={{ marginRight: 6 }} />}
                <span style={{ fontWeight: unread ? 600 : 400 }}>
                  {dn(m.operatorId, m.operatorName) || '有人'} {actionTextOf(m)}
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
