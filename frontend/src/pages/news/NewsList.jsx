import { useEffect, useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Col, Empty, Input, Pagination, Row, Segmented, Tag } from 'antd'
import {
  ClockCircleOutlined, CrownOutlined, EditOutlined, EyeInvisibleOutlined, FireOutlined, LikeOutlined, LockOutlined,
  MessageOutlined, RightOutlined, SearchOutlined, SettingOutlined, StarFilled,
  StarOutlined, UnlockOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'
import TopicMemberModal from '../../components/TopicMemberModal'
import TopicEditModal from '../../components/TopicEditModal'
import TopicApplyButton from '../../components/TopicApplyButton'
import CategoryFilter from '../../components/CategoryFilter'
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
function PostCard({ post, topicOwnerIds, categoryName }) {
  const { dn } = useAuth() // 备注名：我给谁备注过，全站看到的就是备注名
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const cover = coverOf(post.content)
  const excerpt = textOf(post.content)
  // 整卡是跳帖子的 Link；点头像/名字改跳作者主页（拦掉卡片默认跳转）
  const toProfile = post.authorId
    ? (e) => { e.preventDefault(); e.stopPropagation(); navigate(`/users/${post.authorId}`) }
    : undefined
  return (
    <Link
      // 草稿点进去直接是编辑器：继续写、或者在那儿点「发布」
      to={post.draft === '1' ? `/news/edit/${post.newsId}` : `/news/${post.newsId}`}
      className="post-card"
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start', color: 'inherit',
        background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '16px 18px',
        transition: 'all .2s',
      }}
    >
      <span onClick={toProfile} style={{ cursor: toProfile ? 'pointer' : undefined, flexShrink: 0 }}>
        {post.authorAvatar ? (
          <Avatar size={42} src={post.authorAvatar} />
        ) : (
          <Avatar size={42} style={{ background: avatarColor(post.author), fontWeight: 700 }}>
            {String(post.author || '?').slice(0, 1).toUpperCase()}
          </Avatar>
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 作者行：头像旁对齐——名字 + 身份标识（超管/题主）+ 头衔 + 时间 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#999', flexWrap: 'wrap' }}>
          <span onClick={toProfile} style={{ color: '#333', fontWeight: 600, fontSize: 13, cursor: toProfile ? 'pointer' : undefined }}>{dn(post.authorId, post.author) || '匿名'}</span>
          {post.authorSuperManager && <SuperAdminBadge />}
          {topicOwnerIds?.includes(post.authorId) && <TopicOwnerBadge />}
          <UserTitles titles={post.authorTitles} size="sm" />
          <span style={{ color: '#bbb' }}>{timeAgo(post.publishDate)}</span>
        </div>
        {/* 标题（含置顶/精华/锁定/隐藏标） */}
        <div className="post-title" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4, marginTop: 6, transition: 'color .2s', ...clamp(1) }}>
          {post.top === '1' && <Tag color="red" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>置顶</Tag>}
          {post.essence === '1' && <Tag color="volcano" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>精华</Tag>}
          {post.locked === '1' && <Tag icon={<LockOutlined />} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>锁定</Tag>}
          {post.hidden === '1' && <Tag icon={<EyeInvisibleOutlined />} color="purple" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>已隐藏</Tag>}
          {/* 草稿只会出现在作者自己的列表里（后端过滤），所以这里不用再判断身份 */}
          {post.draft === '1' && <Tag icon={<EditOutlined />} color="gold" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>草稿</Tag>}
          {categoryName && <Tag color="volcano" style={{ marginInlineEnd: 6, verticalAlign: 'middle' }}>{categoryName}</Tag>}
          {post.title || '(无标题)'}
        </div>
        {excerpt && (
          <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 5, lineHeight: 1.65, ...clamp(2) }}>
            {excerpt}
          </div>
        )}
        {/* 底部：点赞/评论/收藏（标签在列表卡片不再展示——移动端排版反复折腾，进详情页看） */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10, fontSize: 12, color: '#999' }}>
          <span style={{ flexShrink: 0, display: 'inline-flex', gap: 10, whiteSpace: 'nowrap' }}>
            <span><LikeOutlined /> {post.goodNum ?? 0}</span>
            <span><MessageOutlined /> {post.commentNum ?? 0}</span>
            <span><StarOutlined /> {post.favoriteCount ?? 0}</span>
          </span>
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
  const { user, dn } = useAuth()
  const isMobile = useIsMobile()
  const isTopic = !!topic
  const official = !isTopic && channel === 'official'

  const [rows, setRows] = useState(null)
  const [kw, setKw] = useState('')
  // 视图：最新 / 最热 / 精华 / 只看题主（后两个是过滤，题主仅专题模式有）
  const [view, setView] = useState('最新')
  const [page, setPage] = useState(1)
  const [memberOpen, setMemberOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false) // 专题设置弹窗（横幅上那个小铅笔）
  const [cats, setCats] = useState([])            // 全站专题类别，供弹窗里的下拉用
  const [cat, setCat] = useState('all') // 帖子类别筛选：all / 类别 id / '' = 未分类

  const topicId = topic?.topicId
  // 本专题配的帖子类别（题主在专题设置里维护）；id -> 名字，卡片上要显示
  const postCats = topic?.postCategories || []
  const catName = useMemo(
    () => Object.fromEntries(postCats.map((c) => [c.id, c.name])),
    [postCats],
  )

  useEffect(() => {
    let alive = true
    setRows(null); setKw(''); setView('最新'); setPage(1); setCat('all')
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
      // 作者既按真名也按备注名匹配：页面上显示的是备注名，搜不到会很困惑。
      // 标签也一起匹配——按球队标签找帖子是最常见的用法
      ? rows.filter((p) => `${p.title || ''}${p.author || ''}${dn(p.authorId, '') || ''}${p.tags || ''}`.toLowerCase().includes(k))
      : rows
    // 类别：题主配的那几项，帖子记的是 id（列表已全量在手，纯前端筛）
    if (cat !== 'all') hit = hit.filter((p) => (p.categoryId || '') === cat)
    // 精华：只看加精帖；只看题主：前端按专题 owner 的 authorId 过滤（列表已全量在手）
    if (view === '精华') hit = hit.filter((p) => p.essence === '1')
    if (view === '只看题主' && topic?.ownerIds?.length) hit = hit.filter((p) => topic.ownerIds.includes(p.authorId))
    const sorted = view === '最热'
      ? [...hit].sort((a, b) => hotOf(b) - hotOf(a) || dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf())
      : hit // 后端已按（置顶优先 + 发布时间倒序）排好
    // 置顶帖始终浮到最前（不论哪个视图）
    return [...sorted.filter((p) => p.top === '1'), ...sorted.filter((p) => p.top !== '1')]
  }, [rows, kw, view, cat, isTopic, topic, dn])

  // 类别筛选条：只列真的有帖子的类别（配了没人用的先不占地方）
  const catOptions = useMemo(() => {
    if (!isTopic || !postCats.length || !rows?.length) return []
    const count = (id) => rows.filter((p) => (p.categoryId || '') === id).length
    const used = postCats.filter((c) => count(c.id) > 0)
    if (!used.length) return []
    const none = count('')
    return [
      { value: 'all', label: '全部', count: rows.length },
      ...used.map((c) => ({ value: c.id, label: c.name, count: count(c.id) })),
      ...(none ? [{ value: '', label: '未分类', count: none }] : []),
    ]
  }, [isTopic, postCats, rows])

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
              {/* 改专题设置的第二个入口：原来只有专题列表页的编辑图标，进来之后想改还得退出去。
                  类别列表点开才拉——弹窗里的「专题类别」下拉要用，但普通访客用不上 */}
              {isTopic && topic.canManage && (
                <EditOutlined
                  title="编辑专题"
                  onClick={() => {
                    setEditOpen(true)
                    topicApi.categoryList().then((r) => setCats(Array.isArray(r) ? r : [])).catch(() => setCats([]))
                  }}
                  style={{ fontSize: 15, color: 'rgba(255,255,255,.8)', cursor: 'pointer' }}
                />
              )}
            </div>
            <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13, maxWidth: 620 }}>
              {isTopic ? (topic.description || '按专题组织的讨论区') : official ? '权威发布 · 人人可评' : '见你所见，想你所想'}
            </div>
          </div>
          {/* 订阅（已加入的成员/管理者可见）：入侧栏"订阅的专题"折叠区 */}
          {isTopic && topic.joined && (
            <Button
              /* 订阅是个开关：没订=空心玻璃，订了=实心白底品牌色字，形状变化比文字变化显眼 */
              className={`banner-btn${topic.subscribed ? ' banner-btn-on' : ''}`}
              size={isMobile ? 'small' : 'middle'}
              icon={topic.subscribed ? <StarFilled /> : <StarOutlined />}
              onClick={async () => {
                try {
                  await topicApi.subscribe(topic.topicId)
                  window.dispatchEvent(new Event('subs-changed'))
                  onApplied?.()
                } catch { /* 拦截器已提示 */ }
              }}
              style={{ flexShrink: 0 }}
            >
              {topic.subscribed ? '已订阅' : '订阅'}
            </Button>
          )}
          {isTopic && (topic.canManage ? (
            <Badge count={topic.pendingCount || 0} size="small" offset={[-4, 2]}>
              <Button className="banner-btn" size={isMobile ? 'small' : 'middle'} icon={<SettingOutlined />} onClick={() => setMemberOpen(true)} style={{ flexShrink: 0 }}>
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
              placeholder="搜索标题 / 作者 / 标签"
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

          {/* 帖子类别筛选（题主配的那份）：搜索/排序那条下面单独一行，类别多了会自己换行 */}
          <CategoryFilter options={catOptions} value={cat} onChange={(v) => { setCat(v); setPage(1) }} />

          {/* 帖子流 */}
          {paged == null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((i) => <Card key={i} loading style={{ borderRadius: 14 }} />)}
            </div>
          ) : paged.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paged.map((p) => (
                <PostCard key={p.newsId} post={p} topicOwnerIds={isTopic ? topic?.ownerIds : null} categoryName={catName[p.categoryId]} />
              ))}
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
            {/* 官方新闻整站关掉时，这条互指的链接也别渲染，免得点进去被弹回来 */}
            {(official || NEWS_MODULE_ENABLED) && (
              <Link to={official ? '/news' : '/official'} style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
                去{official ? '百家说' : '官方新闻'}逛逛 <RightOutlined style={{ fontSize: 10 }} />
              </Link>
            )}
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
        <>
          <TopicMemberModal topicId={topicId} open={memberOpen} onClose={() => setMemberOpen(false)} onChange={onApplied} />
          {/* 保存后走 onApplied 重新拉专题：横幅名字、类别、帖子类别都跟着更新 */}
          <TopicEditModal
            open={editOpen}
            topic={topic}
            categories={cats}
            onClose={() => setEditOpen(false)}
            onSaved={onApplied}
          />
        </>
      )}
    </>
  )
}
