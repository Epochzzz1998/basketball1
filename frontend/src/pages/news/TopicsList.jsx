import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Col, Empty, Input, Popconfirm, Row, Spin, message } from 'antd'
import {
  AppstoreOutlined, DatabaseOutlined, DeleteOutlined, EditOutlined, MessageOutlined,
  PlusOutlined, PushpinFilled, PushpinOutlined, RightOutlined, SearchOutlined, TeamOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { topicApi } from '../../api/topic'
import { useAuth } from '../../auth/AuthContext'
import TopicEditModal from '../../components/TopicEditModal'
import TopicApplyButton from '../../components/TopicApplyButton'
import TopicBadges from '../../components/TopicBadges'
import CategoryManageModal from '../../components/CategoryManageModal'
import ChatUsageModal from '../../components/ChatUsageModal'
import CategoryFilter from '../../components/CategoryFilter'
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
  const [cats, setCats] = useState([])       // 全站专题类别（超管配）
  const [catOpen, setCatOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)  // 群聊占用（仅超管）
  // 默认停在「已收藏」；等专题拉回来发现一个收藏都没有，再退回「全部」（见下面的 effect）
  const [cat, setCat] = useState('fav')      // 当前筛选：all / fav / 类别 id / '' = 未分类
  const [kw, setKw] = useState('')           // 专题搜索关键词

  const load = useCallback(() => {
    setTopics(null)
    topicApi.list()
      .then((r) => setTopics(Array.isArray(r) ? r : []))
      .catch(() => setTopics([]))
  }, [])
  const loadCats = useCallback(() => {
    topicApi.categoryList().then((r) => setCats(Array.isArray(r) ? r : [])).catch(() => setCats([]))
  }, [])
  useEffect(() => { load(); loadCats() }, [load, loadCats])

  /**
   * 「已收藏」= 我订阅过的 ∪ 我置顶过的。
   * 这两个都是**按人**存的标记（订阅进侧栏、置顶只改自己看到的顺序），
   * 合起来就是"我特意标过的专题"，没必要再造第三种收藏。
   */
  const isFav = (t) => !!(t.subscribed || t.pinned)

  // 筛选器只列**真的有专题挂着**的类别：配了但没人用的类别摆在那儿只会点出一片空
  const catOptions = useMemo(() => {
    if (!topics?.length) return []
    const count = (id) => topics.filter((t) => (t.categoryId || '') === id).length
    const used = cats.filter((c) => count(c.categoryId) > 0)
    const none = count('')
    const favCount = topics.filter(isFav).length
    // 类别一个没用上、收藏也一个没有，就别出这排按钮了（等于只有「全部」，纯占地方）
    if (!used.length && !favCount) return []
    return [
      { value: 'all', label: '全部', count: topics.length },
      // 收藏排在类别前面：它是"我的东西"，比按类别翻更常用
      ...(favCount ? [{ value: 'fav', label: '已收藏', count: favCount }] : []),
      ...used.map((c) => ({ value: c.categoryId, label: c.name, count: count(c.categoryId) })),
      ...(none ? [{ value: '', label: '未分类', count: none }] : []),
    ]
  }, [topics, cats])

  const shown = useMemo(() => {
    if (!topics) return null
    const hit = cat === 'all' ? topics
      : cat === 'fav' ? topics.filter(isFav)
        : topics.filter((t) => (t.categoryId || '') === cat)
    const k = kw.trim().toLowerCase()
    if (!k) return hit
    // 专题名 + 简介 + 类别名一起匹配（列表已全量在手，纯前端筛）
    return hit.filter((t) => `${t.name || ''}${t.description || ''}${t.categoryName || ''}`.toLowerCase().includes(k))
  }, [topics, cat, kw])

  // 一个收藏都没有时别把人晾在空列表上——退回「全部」。
  // 只在首次拿到数据时判断，之后用户自己切到哪儿就是哪儿
  const settledRef = useRef(false)
  useEffect(() => {
    if (settledRef.current || !topics) return
    settledRef.current = true
    if (!topics.some(isFav)) setCat('all')
  }, [topics])

  const enter = (t) => {
    if (t.locked) return message.info('该专题为私密专题，你没有浏览权限')
    navigate(`/news/topic/${t.topicId}`)
  }

  const del = async (t) => {
    try { await topicApi.remove(t.topicId); message.success('已删除'); load() } catch { /* 已提示 */ }
  }

  // 置顶是每人各自的：只改自己看到的顺序，别人那里不动。
  // 侧栏的订阅区读同一份顺序，所以顶完顺手通知它刷新。
  const togglePin = async (t) => {
    try {
      await topicApi.pin(t.topicId, !t.pinned)
      message.success(t.pinned ? '已取消置顶' : '已置顶')
      // 站在「已收藏」筛选里取消最后一个收藏，会剩一片空——退回全部更合理
      if (cat === 'fav' && t.pinned && !t.subscribed) setCat('all')
      load()
      window.dispatchEvent(new Event('subs-changed'))
    } catch { /* 已提示 */ }
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
          {/* 横幅上的按钮统一走 .banner-btn（玻璃质感），别用 antd 默认那套白底灰边 */}
          {user?.isSuperManager && (
            <Button className="banner-btn" size={isMobile ? 'middle' : 'large'} icon={<AppstoreOutlined />} onClick={() => setCatOpen(true)}>
              管理类别
            </Button>
          )}
          {/* 群聊占用只有超管看得到；清理动作在各专题的群聊页里，由题主自己做 */}
          {user?.isSuperManager && (
            <Button className="banner-btn" size={isMobile ? 'middle' : 'large'} icon={<DatabaseOutlined />} onClick={() => setUsageOpen(true)}>
              群聊存储
            </Button>
          )}
          {/* 人人可建（默认允许，超管可按用户关闭；每人限 5 个，后端校验） */}
          {user && (
            <Button className="banner-btn" size={isMobile ? 'middle' : 'large'} icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建专题
            </Button>
          )}
        </div>
      </div>

      {/* 搜索 + 类别筛选：与专题内帖子流的工具条同一套外观 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* 圆角/高度/底色与顶栏的全局搜索框保持一致（34 / 17 / #f5f5f5）——
            同一个动作在站里长成两种样子没有道理 */}
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#aaa' }} />}
          placeholder="搜索专题名 / 简介 / 类别"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          style={{ maxWidth: 260, height: 34, borderRadius: 17, background: '#f5f5f5' }}
        />
        {/* 数量紧跟搜索框，专题页里的「x 篇」同理 */}
        {shown != null && <span style={{ fontSize: 13, color: '#999', whiteSpace: 'nowrap' }}>{shown.length} 个专题</span>}
        <span style={{ flex: 1 }} />
      </div>

      <CategoryFilter options={catOptions} value={cat} onChange={setCat} />

      {shown === null ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : shown.length ? (
        <Row gutter={[16, 16]}>
          {shown.map((t) => {
            // 有背景图的卡片整张是深色底，卡上所有文字都要跟着翻成浅色
            const art = !!t.banner
            const shadow = art ? '0 1px 6px rgba(0,0,0,.55)' : undefined
            return (
              <Col key={t.topicId} xs={24} sm={12} lg={8}>
                {/* 新活动红点（公开或已订阅的专题）：自绘角标压在卡片左上角边缘 */}
                <div className="topic-card-badge" style={{ position: 'relative' }}>
                {t.newCount > 0 && (
                  <span
                    style={{
                      position: 'absolute', top: -9, left: -9, zIndex: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box',
                      borderRadius: 11, background: 'linear-gradient(135deg, #ff7875, #f5222d)', color: '#fff',
                      fontSize: 12, fontWeight: 700, lineHeight: 1,
                      boxShadow: '0 2px 6px rgba(245,34,45,.45)',
                    }}
                  >
                    {t.newCount > 99 ? '99+' : t.newCount}
                  </span>
                )}
                <Card
                  className="topic-card"
                  style={{ borderRadius: 14, height: '100%', overflow: 'hidden', cursor: t.locked ? 'default' : 'pointer', opacity: t.locked ? 0.85 : 1 }}
                  styles={{ body: { padding: '15px 18px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' } }}
                  onClick={() => enter(t)}
                >
                  {/* 背景图铺满整张卡片，**原图不做任何模糊**——第一版虚化了，
                      用户的评价是「糊成一片，丑得要死」，确实：画本身就看不清了，
                      那还不如不放。
                      代价是要自己解决"字压在照片上读不读得出来"。做法和专题页横幅同一套：
                      图上面盖一层上下深、中间浅的黑色渐变，卡上的文字全部翻成浅色 + 描边阴影。
                      上下重是因为字就在上下两头（标题在顶、参与人数那行贴底），
                      中间留浅一点，画面主体才露得出来。 */}
                  {art && (
                    <>
                      {/* 用 `<img>` 而不是 CSS 的 `background-image`。
                          差别在于 `<img>` 走的是浏览器的图片管线：`decoding="async"` 能让解码
                          离开主线程，图片没准备好时先画别的、好了再补上。
                          写成 background 的话，这张图是所属图层绘制的一部分——解码慢就把整层拖住，
                          在 iOS 上表现为一片区域迟迟不出来。
                          `loading="lazy"` 没加：首屏的卡片本来就该立刻出图 */}
                      <img
                        src={t.banner}
                        alt=""
                        aria-hidden
                        decoding="async"
                        style={{
                          position: 'absolute', inset: 0, zIndex: 0,
                          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute', inset: 0, zIndex: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,.58) 0%, rgba(0,0,0,.28) 42%, rgba(0,0,0,.74) 100%)',
                        }}
                      />
                    </>
                  )}
                  {/* 内容整体抬到蒙版之上；原来卡体自己是 flex 列，现在那份职责搬到这一层 */}
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: art ? '#fff' : undefined, textShadow: shadow, ...clamp(1) }}>{t.name}</div>
                      {/* 状态标记：一行裸图标，和右上角那排操作图标同一套语言。
                          原来是四五枚彩色 Tag，能占两行——一张卡上最抢眼的成了这些次要属性 */}
                      <TopicBadges topic={t} light={art} style={{ marginTop: 5 }} />
                    </div>
                    {/* 置顶（人人可用，各管各的）+ admin/owner 的编辑、admin 的删除 */}
                    {(user || t.canManage) && (
                      <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                        {/* 图标不加 drop-shadow：`filter` 会让元素单独成一个合成层，
                            而卡片顶部那截渐变已经压到 .58，白图标本来就看得清 */}
                        {user && (t.pinned
                          ? <PushpinFilled title="取消置顶" style={{ color: art ? '#ffa940' : BRAND, cursor: 'pointer' }} onClick={() => togglePin(t)} />
                          : <PushpinOutlined title="置顶" style={{ color: art ? '#fff' : '#bbb', cursor: 'pointer' }} onClick={() => togglePin(t)} />)}
                        {t.canManage && <EditOutlined style={{ color: art ? '#fff' : '#999', cursor: 'pointer' }} onClick={() => setEditTopic(t)} />}
                        {t.canManage && user?.isSuperManager && (
                          <Popconfirm title="删除该专题？" description="专题下有帖子时无法删除" onConfirm={() => del(t)} okText="删除" cancelText="取消">
                            <DeleteOutlined style={{ color: art ? '#fff' : '#bbb', cursor: 'pointer' }} />
                          </Popconfirm>
                        )}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, color: art ? 'rgba(255,255,255,.9)' : '#8c8c8c', textShadow: shadow, margin: '8px 0 12px', minHeight: 36, lineHeight: 1.55, ...clamp(2) }}>
                    {t.description || '暂无简介'}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', fontSize: 12, color: art ? 'rgba(255,255,255,.9)' : '#999', textShadow: shadow, minHeight: 32 }}>
                    {/* 原来这儿写的是题主名——谁开的版跟"值不值得点进去"没什么关系，
                        换成参与人数（发过帖或留过言的去重人数），图标不变 */}
                    <TeamOutlined style={{ marginRight: 5 }} />
                    <span style={{ whiteSpace: 'nowrap' }}>{t.participantCount ?? 0} 人正在讨论</span>
                    <span style={{ margin: '0 8px', color: art ? 'rgba(255,255,255,.5)' : '#ddd' }}>·</span>
                    <span>{t.postCount ?? 0} 帖</span>
                    {/* 群聊未读：和左上角那个红点分开——那个是新帖/新评论，这个是群聊，
                        位置和图标都不同才分得清。点它直接进群聊，省得"进专题→再点群聊"两步 */}
                    {t.chatUnread > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); navigate(`/news/topic/${t.topicId}/chat`) }}
                        title={`群聊有 ${t.chatUnread} 条新消息`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10,
                          padding: '1px 8px', borderRadius: 999, background: '#fff1f0',
                          border: '1px solid #ffccc7', color: '#f5222d', fontWeight: 700,
                          whiteSpace: 'nowrap', cursor: 'pointer',
                        }}
                      >
                        <MessageOutlined style={{ fontSize: 11 }} />
                        {t.chatUnread > 99 ? '99+' : t.chatUnread}
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    {/* 无浏览权（不是成员）→ 卡片上直接给申请按钮；否则显示"进入" */}
                    {t.locked ? (
                      <span onClick={(e) => e.stopPropagation()}>
                        <TopicApplyButton topic={t} onApplied={load} size="small" />
                      </span>
                    ) : (
                      <span style={{ color: art ? '#ffc069' : BRAND, fontWeight: 600, textShadow: shadow }}>进入 <RightOutlined style={{ fontSize: 10 }} /></span>
                    )}
                  </div>
                  </div>
                </Card>
                </div>
              </Col>
            )
          })}
        </Row>
      ) : (
        <Card style={{ borderRadius: 14 }}>
          <Empty description={kw ? '没有匹配的专题'
            : cat === 'all' ? '还没有专题'
              : cat === 'fav' ? '还没有收藏的专题——进专题点「订阅」，或在卡片上点图钉置顶'
                : '这个类别下还没有专题'}>
            {user && cat === 'all' && !kw && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建专题</Button>}
          </Empty>
        </Card>
      )}

      <TopicEditModal open={createOpen} categories={cats} onClose={() => setCreateOpen(false)} onSaved={load} />
      <TopicEditModal open={!!editTopic} topic={editTopic} categories={cats} onClose={() => setEditTopic(null)} onSaved={load} />
      <CategoryManageModal open={catOpen} onClose={() => setCatOpen(false)} onChanged={() => { loadCats(); load() }} />
      <ChatUsageModal open={usageOpen} onClose={() => setUsageOpen(false)} />
    </>
  )
}
