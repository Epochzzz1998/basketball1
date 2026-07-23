import { useEffect, useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Col, Empty, Input, Pagination, Row, Segmented, Tag } from 'antd'
import {
  ClockCircleOutlined, CrownOutlined, EditOutlined, EyeInvisibleOutlined, FireOutlined, LikeOutlined, LockOutlined,
  MessageOutlined, RightOutlined, SearchOutlined, SettingOutlined, StarOutlined, TrophyFilled, UnlockOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'
import { useAuth } from '../../auth/AuthContext'
import TopicMemberModal from '../../components/TopicMemberModal'
import TopicApplyButton from '../../components/TopicApplyButton'
import { SuperAdminBadge, TopicOwnerBadge } from '../../components/RoleBadges'
import UserTitles from '../../components/UserTitles'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 帖子列表（公开，P5-2 内容流改版），按频道复用：
 * - channel="forum"（默认）：百家说（品牌橙横幅），登录用户皆可发帖；
 * - channel="official"：官方新闻（权威蓝横幅），只有 manager+ 能发布。
 * 布局：频道横幅 + 搜索/最新最热工具栏 + 帖子卡片流（字母头像/摘要/首图缩略图/互动数）
 *      + 右栏热榜与发帖引导。
 * 后端列表接口是 ES 全量返回（page/limit 不生效），故一次拉全，前端自己搜索/排序/分页。
 */

const BRAND = '#fa541c'
const MEDAL = ['#f5222d', '#fa8c16', '#faad14']
const PAGE_SIZE = 8

const coverOf = (html) => /<img[^>]+src=["']([^"']+)["']/i.exec(html || '')?.[1] || null
const textOf = (html) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
const clamp = (n) => ({
  display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden',
})

const timeAgo = (v) => {
  if (!v) return ''
  const d = dayjs(v)
  const mins = dayjs().diff(d, 'minute')
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hrs = dayjs().diff(d, 'hour')
  if (hrs < 24) return `${hrs} 小时前`
  const days = dayjs().diff(d, 'day')
  if (days < 30) return `${days} 天前`
  return d.format('YYYY-MM-DD')
}

// 作者名 → 稳定的头像底色（列表行没有头像字段，用首字母彩底代替）
const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

const hotOf = (p) => (p.goodNum ?? 0) * 2 + (p.commentNum ?? 0) * 3

/** 单条帖子卡：头像 + 标题/摘要/元信息 + 首图缩略图 */
function PostCard({ post, topicOwnerIds }) {
  const cover = coverOf(post.content)
  const excerpt = textOf(post.content)
  return (
    <Link
      to={`/news/${post.newsId}`}
      className="post-card"
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start', color: 'inherit',
        background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '16px 18px',
        transition: 'all .2s',
      }}
    >
      {post.authorAvatar ? (
        <Avatar size={42} src={post.authorAvatar} style={{ flexShrink: 0 }} />
      ) : (
        <Avatar size={42} style={{ background: avatarColor(post.author), fontWeight: 700, flexShrink: 0 }}>
          {String(post.author || '?').slice(0, 1).toUpperCase()}
        </Avatar>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 作者行：头像旁对齐——名字 + 身份标识（超管/题主/认证）+ 头衔 + 时间 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#999', flexWrap: 'wrap' }}>
          <span style={{ color: '#333', fontWeight: 600, fontSize: 13 }}>{post.author || '匿名'}</span>
          {post.authorSuperManager && <SuperAdminBadge />}
          {topicOwnerIds?.includes(post.authorId) && <TopicOwnerBadge />}
          {post.authorVerifiedPlayerId && (
            <Tag color="gold" style={{ marginInlineEnd: 0 }}><TrophyFilled /> {post.authorVerifiedPlayerName || '认证球员'}</Tag>
          )}
          <UserTitles titles={post.authorTitles} size="sm" />
          <span style={{ color: '#bbb' }}>{timeAgo(post.publishDate)}</span>
        </div>
        {/* 标题（含置顶/精华/锁定/隐藏标） */}
        <div className="post-title" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4, marginTop: 6, transition: 'color .2s', ...clamp(1) }}>
          {post.top === '1' && <Tag color="red" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>置顶</Tag>}
          {post.essence === '1' && <Tag color="volcano" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>精华</Tag>}
          {post.locked === '1' && <Tag icon={<LockOutlined />} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>锁定</Tag>}
          {post.hidden === '1' && <Tag icon={<EyeInvisibleOutlined />} color="purple" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>已隐藏</Tag>}
          {post.title || '(无标题)'}
        </div>
        {excerpt && (
          <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 5, lineHeight: 1.65, ...clamp(2) }}>
            {excerpt}
          </div>
        )}
        {/* 底部：标签 + 点赞/评论 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 12, color: '#999', flexWrap: 'wrap' }}>
          {String(post.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4).map((t) => (
            <Tag key={t} style={{ marginInlineEnd: 0 }} bordered={false}>{t}</Tag>
          ))}
          <span style={{ flex: 1, minWidth: 8 }} />
          <span><LikeOutlined /> {post.goodNum ?? 0}</span>
          <span><MessageOutlined /> {post.commentNum ?? 0}</span>
          <span><StarOutlined /> {post.favoriteCount ?? 0}</span>
        </div>
      </div>
      {cover && (
        <img
          src={cover}
          alt=""
          style={{ width: 128, height: 88, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#f5f5f5' }}
        />
      )}
    </Link>
  )
}

/** 右栏热榜：热度 Top5 */
function HotRail({ rows, official }) {
  const hot = useMemo(
    () =>
      (rows || [])
        .map((p) => ({ ...p, hot: hotOf(p) }))
        .sort((a, b) => b.hot - a.hot || dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf())
        .slice(0, 5),
    [rows],
  )
  return (
    <Card
      title={<span><FireOutlined style={{ color: '#f5222d', marginRight: 6 }} />{official ? '热门新闻' : '热帖榜'}</span>}
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
                <LikeOutlined /> {p.goodNum ?? 0} · <MessageOutlined /> {p.commentNum ?? 0}
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

/**
 * 帖子流。三种用法：
 * - channel="official"：官方新闻（蓝横幅，manager+ 可发）；
 * - topic={...}：某个专题的帖子流（专题横幅，发帖/发言/管理按该专题权限）；
 * 均复用同一套卡片流 + 热榜。列表接口 ES 全量返回，前端搜索/排序/分页。
 */
export default function NewsList({ channel = 'forum', topic = null, onApplied }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const isTopic = !!topic
  const official = !isTopic && channel === 'official'

  const [rows, setRows] = useState(null)
  const [kw, setKw] = useState('')
  // 视图：最新 / 最热 / 精华 / 只看题主（后两个是过滤，题主仅专题模式有）
  const [view, setView] = useState('最新')
  const [page, setPage] = useState(1)
  const [memberOpen, setMemberOpen] = useState(false)

  const topicId = topic?.topicId

  useEffect(() => {
    let alive = true
    setRows(null); setKw(''); setView('最新'); setPage(1)
    const params = isTopic
      ? { page: 1, limit: 9999, newsChannel: 'forum', topicId }
      : { page: 1, limit: 9999, newsChannel: channel }
    newsApi.listNews(params)
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [channel, isTopic, topicId])

  const filtered = useMemo(() => {
    if (rows === null) return null
    const k = kw.trim().toLowerCase()
    let hit = k
      ? rows.filter((p) => `${p.title || ''}${p.author || ''}`.toLowerCase().includes(k))
      : rows
    // 精华：只看加精帖；只看题主：前端按专题 owner 的 authorId 过滤（列表已全量在手）
    if (view === '精华') hit = hit.filter((p) => p.essence === '1')
    if (view === '只看题主' && topic?.ownerIds?.length) hit = hit.filter((p) => topic.ownerIds.includes(p.authorId))
    const sorted = view === '最热'
      ? [...hit].sort((a, b) => hotOf(b) - hotOf(a) || dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf())
      : hit // 后端已按（置顶优先 + 发布时间倒序）排好
    // 置顶帖始终浮到最前（不论哪个视图）
    return [...sorted.filter((p) => p.top === '1'), ...sorted.filter((p) => p.top !== '1')]
  }, [rows, kw, view, isTopic, topic])

  const paged = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const canPost = isTopic ? !!topic.canPost : official ? user?.isManagerOrOver : true
  const goPost = () => {
    if (!user) return navigate('/login')
    navigate(isTopic ? `/news/new?topicId=${topicId}` : official ? '/news/new?channel=official' : '/news/new')
  }

  const ring = (size, pos) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,.16)', ...pos,
  })

  return (
    <>
      <style>{`
        .post-card:hover { border-color: #ffbb96; box-shadow: 0 6px 18px rgba(250,84,28,.10); transform: translateY(-2px); }
        .post-card:hover .post-title { color: ${BRAND}; }
      `}</style>

      {/* 横幅：官方新闻=权威蓝；专题=品牌橙 + 名称/简介/可见性 + 返回专题列表 + 成员管理 */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '24px 28px', marginBottom: 16,
          background: official
            ? 'linear-gradient(120deg, #1d39c4 0%, #2f54eb 60%, #597ef7 100%)'
            : 'linear-gradient(120deg, #fa541c 0%, #d4380d 60%, #ad2102 100%)',
        }}
      >
        <div style={ring(190, { top: -80, right: 120 })} />
        <div style={ring(120, { bottom: -50, right: 300 })} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isTopic && (
              <Link to="/news" style={{ color: 'rgba(255,255,255,.85)', fontSize: 12 }}>‹ 全部专题</Link>
            )}
            <div style={{ fontSize: isMobile ? 18 : 23, fontWeight: 800, marginTop: isTopic ? 4 : 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {isTopic ? topic.name : official ? '官方新闻' : '百家说'}
              {isTopic && (topic.visibility === 'private'
                ? <Tag icon={<LockOutlined />} style={{ marginInlineEnd: 0 }}>私密</Tag>
                : <Tag icon={<UnlockOutlined />} color="green" style={{ marginInlineEnd: 0 }}>公开</Tag>)}
            </div>
            <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13, maxWidth: 620 }}>
              {isTopic ? (topic.description || '按专题组织的讨论区') : official ? '权威发布 · 人人可评' : '见你所见，想你所想'}
            </div>
          </div>
          {isTopic && (topic.canManage ? (
            <Badge count={topic.pendingCount || 0} size="small" offset={[-4, 2]}>
              <Button icon={<SettingOutlined />} onClick={() => setMemberOpen(true)} style={{ fontWeight: 600, flexShrink: 0 }}>
                成员管理
              </Button>
            </Badge>
          ) : (
            <TopicApplyButton topic={topic} onApplied={onApplied} banner />
          ))}
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={17}>
          {/* 工具栏：搜索 + 最新/最热 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="搜索标题 / 作者"
              value={kw}
              onChange={(e) => { setKw(e.target.value); setPage(1) }}
              style={{ maxWidth: 260, borderRadius: 10 }}
            />
            <Segmented
              value={view}
              onChange={(v) => { setView(v); setPage(1) }}
              options={[
                { label: '最新', value: '最新', icon: <ClockCircleOutlined /> },
                { label: '最热', value: '最热', icon: <FireOutlined /> },
                { label: '精华', value: '精华', icon: <StarOutlined /> },
                ...(isTopic && topic?.ownerIds?.length ? [{ label: '题主', value: '只看题主', icon: <CrownOutlined /> }] : []),
              ]}
            />
            <span style={{ flex: 1 }} />
            {filtered != null && <span style={{ fontSize: 13, color: '#999' }}>{filtered.length} 篇</span>}
          </div>

          {/* 帖子流 */}
          {paged == null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => <Card key={i} loading style={{ borderRadius: 14 }} />)}
            </div>
          ) : paged.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paged.map((p) => <PostCard key={p.newsId} post={p} topicOwnerIds={isTopic ? topic?.ownerIds : null} />)}
            </div>
          ) : (
            <Card style={{ borderRadius: 14 }}>
              {/* 发布入口只留右栏卡片那个，空状态不再重复放按钮 */}
              <Empty description={kw ? '没有匹配的内容' : official ? '还没有新闻' : '还没有帖子，来发第一帖'} />
            </Card>
          )}

          {(filtered?.length ?? 0) > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </Col>

        {/* 右栏：热榜 + 发帖引导 */}
        <Col xs={24} lg={7}>
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HotRail rows={rows} official={official} />
            {/* 发帖引导卡只在桌面右栏出现；移动端有固定底部按钮，避免页尾再重复一个 */}
            {canPost && !isMobile && (
              <Card style={{ borderRadius: 14 }} styles={{ body: { padding: '18px 20px' } }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{official ? '发布新闻' : '有想说的？'}</div>
                <div style={{ fontSize: 13, color: '#8c8c8c', margin: '6px 0 14px' }}>
                  {official ? '面向全站的权威发布（管理员）' : '畅聊一切，发一帖让大家看到你的想法！'}
                </div>
                <Button
                  type="primary"
                  block
                  icon={<EditOutlined />}
                  onClick={goPost}
                  style={official ? { background: '#2f54eb', borderColor: '#2f54eb' } : undefined}
                >
                  {official ? '发布新闻' : user ? '发帖' : '登录后发帖'}
                </Button>
              </Card>
            )}
            {isTopic && !canPost && !topic.canManage && (
              <Card style={{ borderRadius: 14 }} styles={{ body: { padding: '16px 20px' } }}>
                <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 12 }}>
                  {topic.canComment ? '你还没有发帖权限，可申请开通。' : '你还没有发帖/发言权限，可向 owner 申请开通。'}
                </div>
                <TopicApplyButton topic={topic} onApplied={onApplied} block />
              </Card>
            )}
            <Link to={official ? '/news' : '/official'} style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
              去{official ? '百家说' : '官方新闻'}逛逛 <RightOutlined style={{ fontSize: 10 }} />
            </Link>
          </div>
        </Col>
      </Row>

      {/* 移动端：发帖按钮固定在屏幕底部（新用户不用翻到页尾找入口）；占位块防止最后的内容被盖住。PC 端不变 */}
      {isMobile && canPost && (
        <>
          <div style={{ height: 68 }} />
          <div
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
              padding: '10px 16px calc(10px + env(safe-area-inset-bottom))',
              background: 'linear-gradient(transparent, rgba(255,255,255,.94) 45%)',
              pointerEvents: 'none',
            }}
          >
            <Button
              type="primary"
              block
              size="large"
              icon={<EditOutlined />}
              onClick={goPost}
              style={{
                pointerEvents: 'auto', borderRadius: 999, fontWeight: 600, height: 44,
                boxShadow: official ? '0 4px 16px rgba(47,84,235,.35)' : '0 4px 16px rgba(250,84,28,.35)',
                ...(official ? { background: '#2f54eb', borderColor: '#2f54eb' } : {}),
              }}
            >
              {official ? '发布新闻' : user ? '发帖' : '登录后发帖'}
            </Button>
          </div>
        </>
      )}

      {isTopic && topic.canManage && (
        <TopicMemberModal topicId={topicId} open={memberOpen} onClose={() => setMemberOpen(false)} onChange={onApplied} />
      )}
    </>
  )
}
