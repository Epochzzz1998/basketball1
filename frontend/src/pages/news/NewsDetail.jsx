import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar, Button, Card, Col, Divider, Empty, Row, Skeleton, Tag, message } from 'antd'
import { ArrowLeftOutlined, DislikeOutlined, FireOutlined, LikeOutlined, PushpinFilled, RightOutlined, StarFilled, TagsOutlined, TrophyFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import DOMPurify from 'dompurify'
import { newsApi } from '../../api/news'
import { useAuth } from '../../auth/AuthContext'
import CommentSection from '../../components/CommentSection'
import { SuperAdminBadge, TopicOwnerBadge, OpBadge } from '../../components/RoleBadges'

/**
 * 资讯详情（公开，/news/:newsId，P5-2 文章页改版）。
 * 主栏：返回 + 标题 + 作者署名行（真实头像，无头像回退首字母彩底）+ 净化后的富文本 + 顶/踩 + 评论区；
 * 右栏：作者卡（进个人主页） + 同频道热门 Top5（sticky 跟随）。
 * 帖子点赞/点踩：登录才行；计数按后端返回的 delta 乐观更新。
 */

const fmt = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '')
const clamp = (n) => ({
  display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden',
})
const MEDAL = ['#f5222d', '#fa8c16', '#faad14']

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

/** 右栏：同频道热门 Top5（排除当前帖） */
function MorePosts({ channel, exceptId }) {
  const [rows, setRows] = useState(null)
  const official = channel === 'official'

  useEffect(() => {
    let alive = true
    setRows(null)
    newsApi.listNews({ page: 1, limit: 9999, newsChannel: official ? 'official' : 'forum' })
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [channel, official])

  const hot = useMemo(
    () =>
      (rows || [])
        .filter((p) => p.newsId !== exceptId)
        .map((p) => ({ ...p, hot: (p.goodNum ?? 0) * 2 + (p.commentNum ?? 0) * 3 }))
        .sort((a, b) => b.hot - a.hot || dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf())
        .slice(0, 5),
    [rows, exceptId],
  )

  return (
    <Card
      title={<span><FireOutlined style={{ color: '#f5222d', marginRight: 6 }} />{official ? '更多新闻' : '热门帖子'}</span>}
      extra={<Link to={official ? '/official' : '/news'} style={{ fontSize: 13, color: '#888' }}>更多 <RightOutlined style={{ fontSize: 10 }} /></Link>}
      loading={rows === null}
      style={{ borderRadius: 14 }}
      styles={{ body: { padding: '6px 18px 10px' } }}
    >
      {hot.length ? (
        hot.map((p, i) => (
          <Link
            key={p.newsId}
            to={`/news/${p.newsId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', color: 'inherit',
              borderBottom: i === hot.length - 1 ? 'none' : '1px solid #f5f5f5',
            }}
          >
            <span style={{ width: 18, textAlign: 'center', fontStyle: 'italic', fontWeight: 800, color: i < 3 ? MEDAL[i] : '#c8c8c8' }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: i < 3 ? 600 : 400, ...clamp(1) }}>{p.title || '(无标题)'}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                <LikeOutlined /> {p.goodNum ?? 0} · 💬 {p.commentNum ?? 0}
              </div>
            </div>
          </Link>
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
      )}
    </Card>
  )
}

export default function NewsDetail() {
  const { newsId } = useParams()
  const [searchParams] = useSearchParams()
  // 从"我的消息"深链进来时带 userInformationId，请求详情即顺便标记该消息已读
  const userInformationId = searchParams.get('userInformationId') || undefined
  const navigate = useNavigate()
  const { user } = useAuth()
  const [news, setNews] = useState(null)
  const [canManage, setCanManage] = useState(false) // 能否置顶/加精（owner/manager+）
  const [topicOwnerId, setTopicOwnerId] = useState(null) // 该帖所属专题的 owner（题主标识用）
  const [authorStats, setAuthorStats] = useState(null) // 作者数据小结（发帖/精华/置顶/获赞）
  const [loading, setLoading] = useState(true)

  // 帖子点赞/点踩：登录才行；计数经 RabbitMQ 异步更新，这里按 delta 乐观更新
  const likePost = async (type) => {
    if (!user) { message.info('请先登录'); navigate('/login'); return }
    const res = await (type === 'good' ? newsApi.goodPost(newsId) : newsApi.badPost(newsId))
    if (res?.result) {
      const d = res.delta || 0 // 后端给的计数增量（+1 点亮 / -1 取消）
      setNews((n) => (n ? {
        ...n,
        goodNum: (n.goodNum || 0) + (type === 'good' ? d : 0),
        badNum: (n.badNum || 0) + (type === 'bad' ? d : 0),
      } : n))
      message.success(res.msg)
    } else {
      message.error(res?.msg || '操作失败')
    }
  }

  useEffect(() => {
    let alive = true // 防止请求回来时组件已卸载还 setState
    setLoading(true)
    newsApi
      .getNews(newsId, userInformationId)
      .then((data) => { if (alive) { setNews(data?.news || null); setCanManage(!!data?.canManage); setTopicOwnerId(data?.topicOwnerId || null) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [newsId, userInformationId])

  // 作者数据小结（右栏卡片用）：随作者变化拉取
  useEffect(() => {
    const aid = news?.authorId
    if (!aid) { setAuthorStats(null); return }
    let alive = true
    newsApi.authorStats(aid).then((s) => { if (alive) setAuthorStats(s || null) }).catch(() => {})
    return () => { alive = false }
  }, [news?.authorId])

  // 置顶/精华（可并存）：调用后就地更新
  const toggleFlag = async (flag) => {
    const cur = news?.[flag] === '1'
    const res = await newsApi.setFlag(newsId, flag, cur ? '0' : '1')
    if (res?.result) {
      setNews((n) => (n ? { ...n, [flag]: cur ? '0' : '1' } : n))
      message.success(res.msg || '已更新')
    } else {
      message.error(res?.msg || '操作失败')
    }
  }

  // 管理小胶囊：点亮=已应用（实心彩色），再点取消
  const flagChip = (flag, active, icon, label, color) => (
    <span
      onClick={() => toggleFlag(flag)}
      title={active ? `已${label}，点击取消` : `设为${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none',
        padding: '3px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600,
        color: active ? '#fff' : '#8c8c8c',
        background: active ? color : '#fff',
        border: `1px solid ${active ? color : '#e0e0e0'}`,
        transition: 'all .15s',
      }}
    >
      {icon} {label}
    </span>
  )

  const official = news?.newsChannel === 'official'
  const tags = String(news?.tags || '').split(',').map((t) => t.trim()).filter(Boolean)

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={17}>
        <Card style={{ borderRadius: 16 }} styles={{ body: { padding: '24px 30px' } }}>
          <Skeleton loading={loading} active paragraph={{ rows: 8 }}>
            {news ? (
              <>
                <a onClick={() => navigate(-1)} style={{ color: '#888', fontSize: 13 }}>
                  <ArrowLeftOutlined /> 返回
                </a>
                <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.4, margin: '14px 0 18px' }}>
                  {news.title || '(无标题)'}
                </h1>

                {/* 作者署名行 */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 18,
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  {news.authorAvatar ? (
                    <Avatar size={44} src={news.authorAvatar} />
                  ) : (
                    <Avatar size={44} style={{ background: avatarColor(news.author), fontWeight: 700 }}>
                      {String(news.author || '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {news.authorId
                        ? <a onClick={() => navigate(`/users/${news.authorId}`)} style={{ fontWeight: 700, fontSize: 15, color: '#222' }}>{news.author}</a>
                        : <span style={{ fontWeight: 700, fontSize: 15 }}>{news.author || '匿名'}</span>}
                      <OpBadge />
                      {news.authorSuperManager && <SuperAdminBadge />}
                      {topicOwnerId && news.authorId === topicOwnerId && <TopicOwnerBadge />}
                      {news.authorVerifiedPlayerId && (
                        <Tag color="gold" style={{ marginInlineEnd: 0, cursor: 'pointer' }} onClick={() => navigate(`/players/${news.authorVerifiedPlayerId}`)}>
                          <TrophyFilled /> {news.authorVerifiedPlayerName || '认证球员'}
                        </Tag>
                      )}
                      {official && <Tag color="blue" style={{ marginInlineEnd: 0 }}>官方</Tag>}
                      {news.top === '1' && <Tag color="red" style={{ marginInlineEnd: 0 }}>置顶</Tag>}
                      {news.essence === '1' && <Tag color="volcano" style={{ marginInlineEnd: 0 }}>精华</Tag>}
                    </div>
                    <div style={{ color: '#999', fontSize: 12, marginTop: 3 }}>
                      发布于 {fmt(news.publishDate)} · 浏览 {news.viewCount ?? 0} · {news.viewerCount ?? 0} 人看过
                    </div>
                  </div>
                </div>

                {/* 管理工具条：owner / manager 可置顶、加精（可并存）；点亮=已应用，再点取消 */}
                {canManage && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '6px 10px 6px 12px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10 }}>
                    <span style={{ fontSize: 12, color: '#999' }}>管理</span>
                    {flagChip('top', news.top === '1', <PushpinFilled />, '置顶', '#f5222d')}
                    {flagChip('essence', news.essence === '1', <StarFilled />, '精华', '#fa8c16')}
                  </div>
                )}

                {/* 正文里的 @ 提及：wangeditor 存成 <span data-w-e-type="mention" data-info="{id}">，
                    这里描成橙色，点一下按 data-info 里的 id 跳该用户主页（事件委托，一个监听搞定） */}
                <style>{'.rich-content [data-w-e-type="mention"]{color:#fa541c;font-weight:600;cursor:pointer}'}</style>
                {/* 正文是用户发帖的 HTML：发帖已对所有登录用户开放（不可信），渲染前必须用 DOMPurify 净化，防存储型 XSS */}
                <div
                  className="rich-content"
                  style={{ fontSize: 15, lineHeight: 1.85, wordBreak: 'break-word', margin: '22px 0 8px' }}
                  onClick={(e) => {
                    const span = e.target.closest?.('[data-w-e-type="mention"]')
                    if (!span) return
                    try {
                      const info = JSON.parse(decodeURIComponent(span.getAttribute('data-info') || ''))
                      if (info?.id) navigate(`/users/${info.id}`)
                    } catch { /* 坏 data-info 忽略 */ }
                  }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(news.content || '') }}
                />

                {/* 标签：正文下方，# 号胶囊风格（带标签图标引导） */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 24 }}>
                    <TagsOutlined style={{ color: '#bfbfbf', fontSize: 14, marginRight: 2 }} />
                    {tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 13, color: '#fa541c', background: '#fff4ec',
                          border: '1px solid #ffd8bf', borderRadius: 999, padding: '3px 13px', lineHeight: 1.5,
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* 顶/踩 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, margin: '26px 0 8px' }}>
                  <Button shape="round" size="large" icon={<LikeOutlined />} onClick={() => likePost('good')}>
                    顶 {news.goodNum ?? 0}
                  </Button>
                  <Button shape="round" size="large" icon={<DislikeOutlined />} onClick={() => likePost('bad')}>
                    踩 {news.badNum ?? 0}
                  </Button>
                </div>

                <Divider style={{ margin: '18px 0 0' }} />
                <CommentSection newsId={newsId} authorId={news.authorId} authorName={news.author} topicOwnerId={topicOwnerId} />
              </>
            ) : (
              <Empty description="资讯不存在或已删除">
                <Button onClick={() => navigate(-1)}>返回</Button>
              </Empty>
            )}
          </Skeleton>
        </Card>
      </Col>

      {/* 右栏：作者卡 + 同频道热门 */}
      <Col xs={24} lg={7}>
        <div style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {news && (
            <Card style={{ borderRadius: 14 }} styles={{ body: { padding: '18px 20px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {news.authorAvatar ? (
                  <Avatar size={48} src={news.authorAvatar} />
                ) : (
                  <Avatar size={48} style={{ background: avatarColor(news.author), fontWeight: 700, fontSize: 18 }}>
                    {String(news.author || '?').slice(0, 1).toUpperCase()}
                  </Avatar>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{news.author || '匿名'}</span>
                    {news.authorSuperManager && <SuperAdminBadge />}
                    {news.authorVerifiedPlayerId && (
                      <Tag color="gold" style={{ marginInlineEnd: 0, cursor: 'pointer' }} onClick={() => navigate(`/players/${news.authorVerifiedPlayerId}`)}>
                        <TrophyFilled /> {news.authorVerifiedPlayerName || '认证球员'}
                      </Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{official ? '官方新闻作者' : '论坛作者'}</div>
                </div>
              </div>

              {/* 作者数据小结：发帖 / 精华 / 置顶 / 获赞 */}
              <div style={{ display: 'flex', marginTop: 14, textAlign: 'center' }}>
                {[['发帖', authorStats?.postCount], ['精华', authorStats?.essenceCount], ['置顶', authorStats?.topCount], ['获赞', authorStats?.likeCount]].map(([label, n]) => (
                  <div key={label} style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#333' }}>{n ?? 0}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>

              {news.authorId && (
                <Button block style={{ marginTop: 14 }} onClick={() => navigate(`/users/${news.authorId}`)}>
                  查看主页
                </Button>
              )}
            </Card>
          )}
          {news && <MorePosts channel={news.newsChannel} exceptId={newsId} />}
        </div>
      </Col>
    </Row>
  )
}
