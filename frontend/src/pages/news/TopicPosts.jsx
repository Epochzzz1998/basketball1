import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Empty, Space, Spin } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { topicApi } from '../../api/topic'
import TopicApplyButton from '../../components/TopicApplyButton'
import NewsList from './NewsList'

/**
 * 单个专题页：先取专题 + 我的权限。
 * - 无浏览权（私密专题）：上锁提示，不拉帖；
 * - 有浏览权：渲染 NewsList 的专题模式（发帖/发言/管理按该专题权限）。
 */
export default function TopicPosts() {
  const { topicId } = useParams()
  const [searchParams] = useSearchParams()
  // 从"我的消息"点专题通知进来时带 userInformationId，请求详情即标记该消息已读
  const userInformationId = searchParams.get('userInformationId') || undefined
  const navigate = useNavigate()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback((silent) => {
    if (!silent) setLoading(true)
    topicApi.get(topicId, silent ? undefined : userInformationId)
      .then((t) => setTopic(t || null))
      .catch(() => setTopic(null))
      .finally(() => setLoading(false))
  }, [topicId, userInformationId])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  if (!topic) {
    return (
      <Card style={{ borderRadius: 14 }}>
        <Empty description="专题不存在或已删除">
          <Button onClick={() => navigate('/news')}>返回专题列表</Button>
        </Empty>
      </Card>
    )
  }

  // 私密专题、无浏览权 → 上锁
  if (topic.locked) {
    return (
      <Card style={{ borderRadius: 16 }} styles={{ body: { padding: '60px 20px', textAlign: 'center' } }}>
        <LockOutlined style={{ fontSize: 46, color: '#d0d0d0' }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>{topic.name}</div>
        <div style={{ color: '#8c8c8c', margin: '8px 0 20px' }}>
          {topic.description || '这是一个私密专题'}
          <br />你没有浏览该专题的权限，可向专题 owner（{topic.ownerName || '未知'}）申请加入。
        </div>
        <Space>
          <Button onClick={() => navigate('/news')}>返回专题列表</Button>
          <TopicApplyButton topic={topic} onApplied={() => load(true)} />
        </Space>
      </Card>
    )
  }

  return <NewsList topic={topic} onApplied={() => load(true)} />
}
