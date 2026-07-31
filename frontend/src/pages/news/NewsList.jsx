import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Col, Empty, Input, Pagination, Row, Segmented, Tag, Tooltip } from 'antd'
import {
  ClockCircleOutlined, CrownOutlined, EditOutlined, EyeInvisibleOutlined, FireOutlined, LikeOutlined, LockOutlined,
  MessageOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SearchOutlined, SettingOutlined,
  StarFilled, StarOutlined,
} from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'
import BackButton from '../../components/BackButton'
import { assetUrl } from '../../config/origin'
import usePullToRefresh from '../../hooks/usePullToRefresh'
import PullRefreshIndicator from '../../components/PullRefreshIndicator'
import TopicMemberModal from '../../components/TopicMemberModal'
import TopicEditModal from '../../components/TopicEditModal'
import TopicApplyButton from '../../components/TopicApplyButton'
import CategoryFilter from '../../components/CategoryFilter'
import TopicBadges from '../../components/TopicBadges'
import { SuperAdminBadge, TopicOwnerBadge } from '../../components/RoleBadges'
import UserTitles from '../../components/UserTitles'
import useIsMobile from '../../hooks/useIsMobile'
import { TAB_BAR_HEIGHT } from '../../layout/MobileTabBar'
import { showTopBar } from '../../layout/mobileNav'
import { NEWS_MODULE_ENABLED } from '../../config/modules'
import TopicChatEntry from '../../components/TopicChatEntry'
import NbaModuleEntry from '../../components/NbaModuleEntry'
import { sectionRenderer } from '../../components/nbaSections'
import { lolSectionRenderer } from '../../components/lolSections'
import LolModuleEntry from '../../components/LolModuleEntry'

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
// 移动端每次「上拉」多放出来的条数。比桌面翻页多给一些：手机上滑一屏很快，
// 给 8 条会一直在加载
const MOBILE_PAGE = 12

// 封面图是从正文 HTML 里抠出来的第一张图，抠出来的是相对路径 —— 套壳后要补全
// （assetUrl 在网页端是恒等函数）
const coverOf = (html) => assetUrl(/<img[^>]+src=["']([^"']+)["']/i.exec(html || '')?.[1] || null)
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
        // 手机上左右内边距和间距都收紧：正文区实测只有 116px 宽（屏 390 减掉
        // 页面内边距、栅格间距、卡片内边距、头像、封面图），两行摘要放不下几个字，
        // 卡片因此又窄又矮。竖直方向反而加大，让卡片本身更"有分量"
        display: 'flex', gap: isMobile ? 10 : 14, alignItems: 'flex-start', color: 'inherit',
        background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14,
        padding: isMobile ? '18px 14px' : '16px 18px',
        transition: 'all .2s',
      }}
    >
      <span onClick={toProfile} style={{ cursor: toProfile ? 'pointer' : undefined, flexShrink: 0 }}>
        {post.authorAvatar ? (
          <Avatar size={isMobile ? 38 : 42} src={post.authorAvatar} />
        ) : (
          <Avatar size={isMobile ? 38 : 42} style={{ background: avatarColor(post.author), fontWeight: 700 }}>
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
          <div style={{ fontSize: 13.5, color: '#8c8c8c', marginTop: 6, lineHeight: 1.7, ...clamp(isMobile ? 3 : 2) }}>
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
          style={{ width: isMobile ? 100 : 128, height: isMobile ? 92 : 88, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#f5f5f5' }}
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
export default function NewsList({ channel = 'forum', topic = null, onApplied, nbaSection = null, lolSection = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, dn } = useAuth()
  const isMobile = useIsMobile()
  // 顶栏（带刷新）只在四个 Tab 首页有；没有顶栏的页面把刷新挂到右下角的悬浮钮上
  const showRefreshFab = isMobile && !showTopBar(location.pathname, location.search)
  const isTopic = !!topic
  const official = !isTopic && channel === 'official'

  const [rows, setRows] = useState(null)
  const [kw, setKw] = useState('')
  // 视图：最新 / 最热 / 精华 / 只看题主（后两个是过滤，题主仅专题模式有）
  const [view, setView] = useState('最新')
  const [page, setPage] = useState(1)
  const [shown, setShown] = useState(MOBILE_PAGE) // 移动端已展开的条数（上拉加载）
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

  // 拉列表。后端是 ES 全量返回（page/limit 不生效），所以这一次请求就是全部数据，
  // 之后的搜索/排序/分页都在前端做——移动端的「上拉加载更多」因此不发请求，只是把切片放大
  const fetchRows = useCallback(() => {
    const params = isTopic
      ? { page: 1, limit: 9999, newsChannel: 'forum', topicId }
      : { page: 1, limit: 9999, newsChannel: channel }
    return newsApi.listNews(params)
      .then((r) => setRows(r.records || []))
      .catch(() => setRows([]))
  }, [channel, isTopic, topicId])

  useEffect(() => {
    setRows(null); setKw(''); setView('最新'); setPage(1); setCat('all'); setShown(MOBILE_PAGE)
    fetchRows()
  }, [fetchRows])

  // 下拉刷新（仅移动端）：重新拉一次列表，并把已展开的条数收回第一屏
  const onRefresh = useCallback(async () => {
    await fetchRows()
    setShown(MOBILE_PAGE)
  }, [fetchRows])
  const { pull, refreshing, threshold } = usePullToRefresh(onRefresh, isMobile)

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

  // 桌面端翻页器；移动端换成"越滑越多"的切片，两者取的是同一份 filtered
  const paged = isMobile ? filtered?.slice(0, shown) : filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasMore = isMobile && (filtered?.length ?? 0) > shown

  // 上拉加载更多：数据本来就全在内存里（见 fetchRows 的说明），所以这里不发请求，
  // 只是把切片放大。用 IntersectionObserver 而不是监听 scroll —— 后者要自己算
  // 元素位置、还会在每一帧触发；前者由浏览器在元素真的进入视口时才回调一次。
  const sentinelRef = useRef(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setShown((n) => n + MOBILE_PAGE)
    }, { rootMargin: '200px' })   // 提前 200px 就开始加载，滑到底时内容已经在了
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore])

  const canPost = isTopic ? !!topic.canPost : official ? user?.isManagerOrOver : true
  const goPost = () => {
    if (!user) return navigate('/login')
    navigate(isTopic ? `/news/new?topicId=${topicId}` : official ? '/news/new?channel=official' : '/news/new')
  }

  const ring = (size, pos) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,.16)', ...pos,
  })

  // 专题背景图（题主在专题设置里传）。官方新闻没有这一说，永远走蓝色渐变
  const bannerUrl = isTopic ? topic.banner : null

  // 认不出来的分区（手打错、老链接）当作没选，退回帖子流。
  // 两个模块各有一份注册表，但同一时刻只可能命中一个——路由决定了传进来的是哪个。
  //
  // **只导出 renderSection 这一个结果**，不留 renderNbaSection / renderLolSection
  // 给别处直接用：加 LoL 模块时，发帖悬浮钮那一处还在判 `!renderNbaSection`，
  // 于是在五条悟专题的战绩/榜单/绑定三个 tab 上都冒出了发帖按钮。
  // 少一个能被误用的变量，就少一次这种漏改。
  const renderSection = nbaSection
    ? sectionRenderer(nbaSection)
    : (lolSection ? lolSectionRenderer(lolSection) : null)

  return (
    <>
      <style>{`
        .post-card:hover { border-color: #ffbb96; box-shadow: 0 6px 18px rgba(250,84,28,.10); transform: translateY(-2px); }
        .post-card:hover .post-title { color: ${BRAND}; }
      `}</style>

      {/* 下拉刷新的指示条。放在最上面、横幅之前——它要把整页往下推，
          压在横幅上的话就成了"盖住"而不是"下拉" */}
      <PullRefreshIndicator pull={pull} refreshing={refreshing} threshold={threshold} />

      {/* 横幅：官方新闻=权威蓝；专题=题主设的背景图，没设就退回品牌橙渐变。
          + 名称/简介/可见性 + 返回 + 成员管理 */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '24px 28px', marginBottom: 16,
          // 有背景图时给一个下限高度。第一版给的 132/178 太矮，用户反馈「有点小」——
          // 一张 3:1 的横图在那个高度下只看得见中间一条，认不出画的是什么
          minHeight: bannerUrl ? (isMobile ? 176 : 240) : undefined,
          // 有背景图时整块做成"返回在最上、标题贴底"的布局（参照贴吧那种吧头）：
          // 列方向 + justify-content:flex-end 把内容压到底，返回钮再用 margin-bottom:auto
          // 把自己顶回最上面（auto 外边距吃掉全部剩余空间，优先级高于 justify-content）。
          // gap 保证内容超过 minHeight 时两者也不会贴在一起
          display: bannerUrl ? 'flex' : undefined,
          flexDirection: bannerUrl ? 'column' : undefined,
          justifyContent: bannerUrl ? 'flex-end' : undefined,
          gap: bannerUrl ? 10 : undefined,
          background: official
            ? 'linear-gradient(120deg, #1d39c4 0%, #2f54eb 60%, #597ef7 100%)'
            : 'linear-gradient(120deg, #fa541c 0%, #d4380d 60%, #ad2102 100%)',
        }}
      >
        {bannerUrl && (
          <>
            {/* 背景图单独一层，而不是写成容器的 background：这样上面还能再叠一层压暗的渐变。
                照片的亮度完全不可控，白字直接压上去有一半概率读不出来。
                用 `<img decoding="async">` 而不是 CSS background——解码能离开主线程，
                不会因为一张图没解完就把整层的绘制拖住（见 TopicsList 里的同款注释） */}
            <img
              src={bannerUrl}
              alt=""
              aria-hidden
              decoding="async"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,.34) 0%, rgba(0,0,0,.12) 42%, rgba(0,0,0,.62) 100%)',
              }}
            />
          </>
        )}
        {/* 装饰圆环只在纯色渐变上出现——压在照片上就是两道莫名其妙的白圈 */}
        {!bannerUrl && <div style={ring(190, { top: -80, right: 120 })} />}
        {!bannerUrl && <div style={ring(120, { bottom: -50, right: 300 })} />}
        {/* 返回：贴在横幅左上角。有背景图时它是唯一能落脚的地方，
            所以用 overlay 皮肤（半透明黑底 + 白描边），亮图暗图上都看得见。

            **直接回百家说，不走浏览器历史。** 专题里可以在讨论区和几个 NBA 分区之间来回点，
            每一次都是一条历史；照 -1 退的话要一步步倒回去才出得来。
            这一格的语义是"离开这个专题"，那就应该一步到位。 */}
        {isTopic && (
          <BackButton
            variant="overlay"
            onClick={() => navigate('/news')}
            style={{
              position: 'relative', alignSelf: 'flex-start',
              marginBottom: bannerUrl ? 'auto' : 10,
            }}
          />
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 18 : 23, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, textShadow: bannerUrl ? '0 1px 6px rgba(0,0,0,.45)' : undefined }}>
              {isTopic ? topic.name : official ? '官方新闻' : '百家说'}
              {/* 和专题列表卡片同一个组件：状态标记是一排裸图标，不是彩色 Tag。
                  横幅压在背景图上，所以走 light */}
              {isTopic && <TopicBadges topic={topic} light style={{ fontSize: 13 }} />}
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
            <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13, maxWidth: 620, textShadow: bannerUrl ? '0 1px 6px rgba(0,0,0,.45)' : undefined }}>
              {isTopic ? (topic.description || '按专题组织的讨论区') : official ? '权威发布 · 人人可评' : '见你所见，想你所想'}
            </div>
          </div>
          {/* 订阅和成员管理收成图标，和标题旁的编辑图标同一套：横幅上原来并排两个
              带文字的玻璃按钮，占掉一整块宽度，而它们都是**偶尔点一次**的动作。
              状态仍然分得出来——订阅了是实心星星加品牌色，没订是空心白色。
              申请加入（TopicApplyButton）保留按钮样子：那是**没进来的人唯一的入口**，
              缩成图标就找不到了 */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexShrink: 0, marginTop: 2 }}>
            {isTopic && topic.joined && (
              <Tooltip title={topic.subscribed ? '已订阅，点一下取消' : '订阅后进侧栏「订阅的专题」'}>
                <span
                  onClick={async () => {
                    try {
                      await topicApi.subscribe(topic.topicId)
                      window.dispatchEvent(new Event('subs-changed'))
                      onApplied?.()
                    } catch { /* 拦截器已提示 */ }
                  }}
                  style={{ cursor: 'pointer', fontSize: 17, lineHeight: 1, color: topic.subscribed ? '#ffd591' : 'rgba(255,255,255,.85)' }}
                >
                  {topic.subscribed ? <StarFilled /> : <StarOutlined />}
                </span>
              </Tooltip>
            )}
            {isTopic && topic.canManage && (
              <Tooltip title="成员管理">
                <Badge count={topic.pendingCount || 0} size="small" offset={[-2, 2]}>
                  <span
                    onClick={() => setMemberOpen(true)}
                    style={{ cursor: 'pointer', fontSize: 17, lineHeight: 1, color: 'rgba(255,255,255,.85)' }}
                  >
                    <SettingOutlined />
                  </span>
                </Badge>
              </Tooltip>
            )}
          </span>
          {isTopic && !topic.canManage && (
            <TopicApplyButton topic={topic} onApplied={onApplied} banner />
          )}
        </div>
      </div>

      {/* NBA 分区标签条：放在 Row 外面，所以切分区时它和上面的横幅都不动，
          只有下面的内容整块换。只在 NBA 专题渲染（组件内部按 topicId 判断） */}
      {isTopic && <NbaModuleEntry topic={topic} section={nbaSection} />}
      {isTopic && <LolModuleEntry topic={topic} section={lolSection} />}

      {renderSection ? (
        /* 选中了某个模块分区：整块换成那一页，且不分左右栏——
           右栏那些「发帖 / 热帖」对着一张联盟看板或战绩榜毫无意义，
           而这些页面本身要宽度 */
        renderSection()
      ) : (
      /* 手机是单列，栅格的水平间距（每列左右各 8px）纯属浪费，只保留竖直间距。
         注意这里是表达式位置，只能用 JS 块注释——写成 {/* *\/} 会被当成对象字面量，
         构建直接报 "`,` or `)` expected" */
      <Row gutter={isMobile ? [0, 16] : [16, 16]}>
        <Col xs={24} lg={17}>
          {/* 第一层：搜索 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {/* 圆角/高度/底色与顶栏的全局搜索框一致（34 / 17 / #f5f5f5），见 TopicsList 同款 */}
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#aaa' }} />}
              placeholder="搜索标题 / 作者 / 标签"
              value={kw}
              onChange={(e) => { setKw(e.target.value); setPage(1) }}
              style={{ maxWidth: 260, height: 34, borderRadius: 17, background: '#f5f5f5' }}
            />
            {/* 篇数紧跟搜索框：它说明的是"搜出来多少"，离搜索框越近越好读（与百家说首页一致） */}
            {filtered != null && <span style={{ fontSize: 13, color: '#999', whiteSpace: 'nowrap' }}>{filtered.length} 篇</span>}
          </div>

          {/* 第二层：帖子类别筛选（题主配的那份），类别多了会自己换行 */}
          <CategoryFilter options={catOptions} value={cat} onChange={(v) => { setCat(v); setPage(1) }} />

          {/* 第三层：排序/视图 + 群聊。
              放在类别下面是因为它作用在"已经筛出来的这批"上——从上到下正好是
              搜索 → 分类 → 排序，一层层收窄。
              群聊挨着它们但样式刻意不同：它不是第四个"看法"，点下去是进另一个空间 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
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
            {isTopic && <TopicChatEntry topic={topic} />}
            <span style={{ flex: 1 }} />
          </div>

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

          {/* 移动端：上拉加载。哨兵进视口就多放一批（数据已在内存，不发请求）。
              到底了给一句话收尾——没有的话人会一直往下拽，以为还在加载 */}
          {isMobile ? (
            paged?.length ? (
              <div ref={sentinelRef} style={{ padding: '18px 0 4px', textAlign: 'center', fontSize: 12, color: '#bbb' }}>
                {hasMore ? '加载中…' : `没有更多了 · 共 ${filtered.length} 篇`}
              </div>
            ) : null
          ) : (filtered?.length ?? 0) > PAGE_SIZE && (
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
      )}

      {/* 移动端发帖：右下角悬浮圆钮。
          原来是一条通栏按钮压在屏幕最底下，现在那个位置归底部 Tab 栏了，两条叠着会互相盖。
          改成悬浮钮之后占地小得多，滑动时也不挡内容。

          bottom 留出 Tab 栏的高度再加一截（TAB_BAR_HEIGHT + 20），所以它落在 Tab 栏**上方**，
          不贴屏幕底边——贴底的话拇指去够 Tab 栏很容易误触到它。
          任何模块分区（NBA 数据、开黑战绩）这个钮都不出：那几页是数据看板，
          没有"发到哪儿"可言。判据用 renderSection，它对两个模块一视同仁。 */}
      {isMobile && !renderSection && (canPost || showRefreshFab) && (
        <div
          style={{
            position: 'fixed', right: 18, zIndex: 190,
            bottom: `calc(${TAB_BAR_HEIGHT + 20}px + env(safe-area-inset-bottom))`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}
        >
          {canPost && (
            <div
              onClick={goPost}
              title={official ? '发布新闻' : user ? '发帖' : '登录后发帖'}
              style={{
                width: 52, height: 52, borderRadius: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: official ? '#2f54eb' : BRAND, color: '#fff', fontSize: 22,
                boxShadow: official ? '0 6px 18px rgba(47,84,235,.4)' : '0 6px 18px rgba(250,84,28,.4)',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <PlusOutlined />
            </div>
          )}
          {/* 整页刷新。**只在没有顶栏的页面出现**（专题内、官方新闻…）——
              顶栏上本来就有一个同样的刷新，那些页面上再挂一个是重复的。
              和下拉刷新也不是一回事：那个只重拉当前列表，这个是整个应用重新加载，
              换了版本或者页面状态乱了的时候用。
              **和发帖钮同样大小**：两个圆钮上下叠在一起，直径不一样看着就是没对齐。
              主次靠颜色分（发帖是品牌色实心，刷新是白底灰图标），不靠尺寸 */}
          {showRefreshFab && (
            <div
              onClick={() => window.location.reload()}
              title="刷新页面"
              style={{
                width: 52, height: 52, borderRadius: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', color: '#8c8c8c', fontSize: 20,
                border: '1px solid #f0f0f0', boxShadow: '0 4px 14px rgba(0,0,0,.12)',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <ReloadOutlined />
            </div>
          )}
        </div>
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
