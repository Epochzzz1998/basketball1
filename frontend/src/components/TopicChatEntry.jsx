import { useEffect, useState } from 'react'
import { Badge, Button } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { chatApi } from '../api/chat'
import { subscribeRoom } from '../realtime/pmSocket'
import { useAuth } from '../auth/AuthContext'

/**
 * 帖子流工具栏上的群聊入口：一个带未读角标的按钮，点了跳群聊页。
 *
 * 角标要在人还在专题页时就会涨，所以这个组件**常驻订阅**着房间——
 * 订阅归它管，群聊页只管自己那一屏，两边互不干扰。
 *
 * 样式刻意和旁边的「最新/最热/精华/题主」不同：那四个是换一种看法，
 * 这个是进另一个地方，做成第五个 tab 会误导。
 */
const BRAND = '#fa541c'

export default function TopicChatEntry({ topic }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const topicId = topic?.topicId
  const canChat = !!topic?.canChat

  useEffect(() => {
    if (!topicId || !canChat) return
    chatApi.unread(topicId).then((n) => setUnread(Number(n) || 0)).catch(() => {})
  }, [topicId, canChat])

  useEffect(() => {
    if (!topicId || !canChat) return undefined
    return subscribeRoom(topicId, (frame) => {
      if (frame?.type === 'message' && frame.data?.senderId !== user?.userId) {
        setUnread((n) => n + 1)
      }
    })
  }, [topicId, canChat, user?.userId])

  if (!canChat) return null

  return (
    <Badge count={unread} size="small" offset={[-4, 2]}>
      <Button
        icon={<MessageOutlined />}
        onClick={() => navigate(`/news/topic/${topicId}/chat`)}
        style={{ fontWeight: 600, borderRadius: 999, color: BRAND, borderColor: '#ffbb96', background: '#fff7f0' }}
      >
        群聊
      </Button>
    </Badge>
  )
}
