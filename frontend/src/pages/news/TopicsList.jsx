import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Empty, Popconfirm, Row, Spin, Tag, message } from 'antd'
import {
  DeleteOutlined, EditOutlined, EyeInvisibleOutlined, LockOutlined, PlusOutlined, RightOutlined, TeamOutlined, UnlockOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'
import TopicEditModal from '../../components/TopicEditModal'
import TopicApplyButton from '../../components/TopicApplyButton'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 专题列表（百家说首页）：论坛内容按专题组织。
 * - 公开/可浏览的专题点进去看帖流；私密无权的专题带锁展示（看得到名字/简介，进不去）；
 * - 超管可「新建专题」（指定 owner）+ 删除；admin/owner 可编辑设置；
 * - owner 的成员权限管理在专题内页操作。
 */

const BRAND = '#fa541c'
const clamp = (n) => ({ display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden' })

export default function TopicsList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [topics, setTopics] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTopic, setEditTopic] = useState(null)

  const load = useCallback(() => {
    setTopics(null)
    topicApi.list()
      .then((r) => setTopics(Array.isArray(r) ? r : []))
      .catch(() => setTopics([]))
  }, [])
  useEffect(() => { load() }, [load])

  const enter = (t) => {
    if (t.locked) return message.info('该专题为私密专题，你没有浏览权限')
    navigate(`/news/topic/${t.topicId}`)
  }

  const del = async (t) => {
    try { await topicApi.remove(t.topicId); message.success('已删除'); load() } catch { /* 已提示 */ }
  }

  const ring = (size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.16)', ...pos })

  return (
    <>
      <style>{'.topic-card-badge{display:block;width:100%;height:100%} .topic-card{transition:all .2s} .topic-card:hover{border-color:#ffbb96;box-shadow:0 6px 18px rgba(250,84,28,.1);transform:translateY(-2px)}'}</style>

      {/* 横幅 */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff', padding: isMobile ? '16px 14px' : '24px 28px', marginBottom: 18, background: 'linear-gradient(120deg, #fa541c 0%, #d4380d 60%, #ad2102 100%)' }}>
        <div style={ring(190, { top: -80, right: 120 })} />
        <div style={ring(120, { bottom: -50, right: 300 })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 18 : 23, fontWeight: 800 }}>百家说</div>
            <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>见你所见，想你所想</div>
          </div>
          {/* 人人可建（默认允许，超管可按用户关闭；每人限 5 个，后端校验） */}
          {user && (
            <Button size="large" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} style={{ fontWeight: 600 }}>
              新建专题
            </Button>
          )}
        </div>
      </div>

      {topics === null ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : topics.length ? (
        <Row gutter={[16, 16]}>
          {topics.map((t) => {
            const priv = t.visibility === 'private'
            return (
              <Col key={t.topicId} xs={24} sm={12} lg={8}>
                {/* 新活动红点（公开或已订阅的专题）：自绘角标压在卡片左上角边缘 */}
                <div className="topic-card-badge" style={{ position: 'relative' }}>
                {t.newCount > 0 && (
                  <span
                    style={{
                      position: 'absolute', top: -9, left: -7, zIndex: 2,
                      minWidth: 24, height: 24, lineHeight: '24px', padding: '0 8px', boxSizing: 'border-box',
                      borderRadius: 12, background: '#ff4d4f', color: '#fff',
                      fontSize: 13, fontWeight: 700, textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(255,77,79,.45)', border: '2px solid #fff',
                    }}
                  >
                    {t.newCount > 99 ? '99+' : t.newCount}
                  </span>
                )}
                <Card
                  className="topic-card"
                  style={{ borderRadius: 14, height: '100%', cursor: t.locked ? 'default' : 'pointer', opacity: t.locked ? 0.85 : 1 }}
                  styles={{ body: { padding: '18px 20px', display: 'flex', flexDirection: 'column', height: '100%' } }}
                  onClick={() => enter(t)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, ...clamp(1) }}>{t.name}</div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {priv
                          ? <Tag icon={<LockOutlined />} color="default" style={{ marginInlineEnd: 0 }}>私密</Tag>
                          : <Tag icon={<UnlockOutlined />} color="green" style={{ marginInlineEnd: 0 }}>公开</Tag>}
                        {t.locked && <Tag color="red" style={{ marginInlineEnd: 0 }}>无浏览权</Tag>}
                        {t.listed === false && <Tag icon={<EyeInvisibleOutlined />} color="orange" style={{ marginInlineEnd: 0 }}>未公开</Tag>}
                      </div>
                    </div>
                    {/* admin/owner 的编辑、admin 的删除 */}
                    {t.canManage && (
                      <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                        <EditOutlined style={{ color: '#999', cursor: 'pointer' }} onClick={() => setEditTopic(t)} />
                        {user?.isSuperManager && (
                          <Popconfirm title="删除该专题？" description="专题下有帖子时无法删除" onConfirm={() => del(t)} okText="删除" cancelText="取消">
                            <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} />
                          </Popconfirm>
                        )}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: '#8c8c8c', margin: '10px 0 14px', minHeight: 38, lineHeight: 1.6, ...clamp(2) }}>
                    {t.description || '暂无简介'}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', fontSize: 12, color: '#999', minHeight: 32 }}>
                    <TeamOutlined style={{ marginRight: 5 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ownerName || '未知'}</span>
                    <span style={{ margin: '0 8px', color: '#ddd' }}>·</span>
                    <span>{t.postCount ?? 0} 帖</span>
                    <span style={{ flex: 1 }} />
                    {/* 无浏览权（不是成员）→ 卡片上直接给申请按钮；否则显示"进入" */}
                    {t.locked ? (
                      <span onClick={(e) => e.stopPropagation()}>
                        <TopicApplyButton topic={t} onApplied={load} size="small" />
                      </span>
                    ) : (
                      <span style={{ color: BRAND, fontWeight: 600 }}>进入 <RightOutlined style={{ fontSize: 10 }} /></span>
                    )}
                  </div>
                </Card>
                </div>
              </Col>
            )
          })}
        </Row>
      ) : (
        <Card style={{ borderRadius: 14 }}>
          <Empty description="还没有专题">
            {user && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建专题</Button>}
          </Empty>
        </Card>
      )}

      <TopicEditModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />
      <TopicEditModal open={!!editTopic} topic={editTopic} onClose={() => setEditTopic(null)} onSaved={load} />
    </>
  )
}
