import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Card, Col, Empty, Input, Pagination, Row, Segmented, Tag } from 'antd'
import {
  EditOutlined, FireOutlined, LikeOutlined, MessageOutlined, RightOutlined, SearchOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { newsApi } from '../../api/news'
import { useAuth } from '../../auth/AuthContext'

/**
 * 帖子列表（公开，P5-2 内容流改版），按频道复用：
 * - channel="forum"（默认）：资讯论坛（品牌橙横幅），登录用户皆可发帖；
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
function PostCard({ post }) {
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
        <div className="post-title" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4, transition: 'color .2s', ...clamp(1) }}>
          {post.title || '(无标题)'}
        </div>
        {excerpt && (
          <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 5, lineHeight: 1.65, ...clamp(2) }}>
            {excerpt}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, fontSize: 12, color: '#999' }}>
          <span style={{ color: '#595959', fontWeight: 500 }}>{post.author || '匿名'}</span>
          <span>{timeAgo(post.publishDate)}</span>
          {post.team && <Tag style={{ marginInlineEnd: 0 }} bordered={false}>{post.team}</Tag>}
          {post.newsType && <Tag style={{ marginInlineEnd: 0 }} bordered={false}>{post.newsType}</Tag>}
          <span style={{ flex: 1 }} />
          <span><LikeOutlined /> {post.goodNum ?? 0}</span>
          <span><MessageOutlined /> {post.commentNum ?? 0}</span>
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

export default function NewsList({ channel = 'forum' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const official = channel === 'official'

  const [rows, setRows] = useState(null)
  const [kw, setKw] = useState('')
  const [sort, setSort] = useState('最新')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let alive = true
    setRows(null); setKw(''); setSort('最新'); setPage(1)
    newsApi.listNews({ page: 1, limit: 9999, newsChannel: channel })
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [channel])

  const filtered = useMemo(() => {
    if (rows === null) return null
    const k = kw.trim().toLowerCase()
    const hit = k
      ? rows.filter((p) => `${p.title || ''}${p.author || ''}`.toLowerCase().includes(k))
      : rows
    return sort === '最热'
      ? [...hit].sort((a, b) => hotOf(b) - hotOf(a) || dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf())
      : hit // 后端已按发布时间倒序
  }, [rows, kw, sort])

  const paged = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const canPost = official ? user?.isManagerOrOver : true
  const postLabel = official ? '发布新闻' : '发帖'
  const goPost = () => {
    if (!user) return navigate('/login')
    navigate(official ? '/news/new?channel=official' : '/news/new')
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

      {/* 频道横幅：论坛=品牌橙，官方新闻=权威蓝 */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: '24px 28px', marginBottom: 16,
          background: official
            ? 'linear-gradient(120deg, #1d39c4 0%, #2f54eb 60%, #597ef7 100%)'
            : 'linear-gradient(120deg, #fa541c 0%, #d4380d 60%, #ad2102 100%)',
        }}
      >
        <div style={ring(190, { top: -80, right: 120 })} />
        <div style={ring(120, { bottom: -50, right: 300 })} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 23, fontWeight: 800 }}>{official ? '官方新闻' : '资讯论坛'}</div>
          <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
            {official ? '权威发布 · 人人可评' : '看帖 · 发帖 · 评论 · 点赞'}
          </div>
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
            <Segmented options={['最新', '最热']} value={sort} onChange={(v) => { setSort(v); setPage(1) }} />
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
              {paged.map((p) => <PostCard key={p.newsId} post={p} />)}
            </div>
          ) : (
            <Card style={{ borderRadius: 14 }}>
              <Empty
                description={kw ? '没有匹配的内容' : official ? '还没有新闻' : '还没有帖子，来发第一帖'}
              >
                {!kw && canPost && <Button type="primary" onClick={goPost}>{postLabel}</Button>}
              </Empty>
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
          <div style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HotRail rows={rows} official={official} />
            {(official ? user?.isManagerOrOver : true) && (
              <Card style={{ borderRadius: 14 }} styles={{ body: { padding: '18px 20px' } }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{official ? '发布新闻' : '有想说的？'}</div>
                <div style={{ fontSize: 13, color: '#8c8c8c', margin: '6px 0 14px' }}>
                  {official ? '面向全站的权威发布（管理员）' : '聊比赛、聊球员、聊数据，发一帖和大家讨论'}
                </div>
                <Button type="primary" block icon={<EditOutlined />} onClick={goPost}>
                  {official ? '发布新闻' : user ? '发帖' : '登录后发帖'}
                </Button>
              </Card>
            )}
            <Link to={official ? '/news' : '/official'} style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
              去{official ? '资讯论坛' : '官方新闻'}逛逛 <RightOutlined style={{ fontSize: 10 }} />
            </Link>
          </div>
        </Col>
      </Row>
    </>
  )
}
