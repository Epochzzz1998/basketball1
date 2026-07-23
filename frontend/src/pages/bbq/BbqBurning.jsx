import { useEffect, useState } from 'react'
import { Avatar, Button, Card, Col, Empty, Input, Pagination, Popconfirm, Row, Spin, Tag, message } from 'antd'
import { CaretDownOutlined, CaretRightOutlined, CrownFilled, FireFilled, HeartFilled, HeartOutlined, LeftOutlined, RightOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { bbqApi } from '../../api/bbq'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 耿阿姨烤串 · Burning！——店内趣味排行榜（全体成员可看，不出现任何金额）。
 * 四榜按周/月：工时（第一名=劳模）、穿串数（第一名=串王）、最晚下班（跨天按次日算）、出勤天数。
 * 榜上的人可点赞（全局计数、toggle）；点行展开评论区（每页 5 条分页，作者/店长可删）。
 * 显示名走备注映射（useAuth().dn）——这正是"备注"功能给本页做的铺垫。
 */

const FLAME = '#d4380d'
const mondayOf = (d) => d.subtract((d.day() + 6) % 7, 'day')

const fmtHours = (min) => `${(min / 60).toFixed(1)}h`
const fmtOff = (min) => {
  const m = min % 1440
  const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return min >= 1440 ? `次日${t}` : t
}
const MEDALS = ['🥇', '🥈', '🥉']

export default function BbqBurning() {
  const isMobile = useIsMobile()
  const { dn } = useAuth()
  const [mode, setMode] = useState('week') // 榜单默认看本周（更有比拼感），可切按月
  const [month, setMonth] = useState(dayjs())
  const [week, setWeek] = useState(mondayOf(dayjs()))
  const [data, setData] = useState(null)
  const [likes, setLikes] = useState({})
  const [myLikes, setMyLikes] = useState([])
  // 展开的评论面板：'board:userId'；评论数据按 userId 缓存
  const [openKey, setOpenKey] = useState(null)
  const [comments, setComments] = useState({}) // {userId: {rows, total, page, loading}}
  const [cInput, setCInput] = useState('')
  const [posting, setPosting] = useState(false)

  const monthStr = month.format('YYYY-MM')
  const weekFrom = week.format('YYYY-MM-DD')
  const weekTo = week.add(6, 'day').format('YYYY-MM-DD')

  useEffect(() => {
    setData(null)
    setOpenKey(null)
    const params = mode === 'month' ? { month: monthStr } : { from: weekFrom, to: weekTo }
    bbqApi.burningBoard(params)
      .then((d) => {
        setData(d || {})
        setLikes(d?.likes || {})
        setMyLikes(Array.isArray(d?.myLikes) ? d.myLikes : [])
      })
      .catch(() => setData(undefined))
  }, [mode, monthStr, weekFrom, weekTo])

  const loadComments = (uid, page) => {
    setComments((c) => ({ ...c, [uid]: { ...(c[uid] || {}), loading: true } }))
    bbqApi.burningComments(uid, page)
      .then((r) => setComments((c) => ({ ...c, [uid]: { rows: r?.rows || [], total: r?.total || 0, page, loading: false } })))
      .catch(() => setComments((c) => ({ ...c, [uid]: { rows: [], total: 0, page: 1, loading: false } })))
  }

  const toggleOpen = (boardKey, uid) => {
    const key = `${boardKey}:${uid}`
    if (openKey === key) {
      setOpenKey(null)
      return
    }
    setOpenKey(key)
    setCInput('')
    loadComments(uid, 1)
  }

  const doLike = async (uid, e) => {
    e.stopPropagation()
    try {
      const r = await bbqApi.burningLike(uid)
      setLikes((l) => ({ ...l, [uid]: r?.count ?? 0 }))
      setMyLikes((m) => (r?.liked ? [...m, uid] : m.filter((x) => x !== uid)))
    } catch { /* 已提示 */ }
  }

  const doComment = async (uid) => {
    const c = cInput.trim()
    if (!c) return message.info('先写点什么')
    setPosting(true)
    try {
      await bbqApi.burningComment(uid, c)
      setCInput('')
      loadComments(uid, 1)
    } catch { /* 已提示 */ } finally { setPosting(false) }
  }

  const doDeleteComment = async (uid, id) => {
    try {
      await bbqApi.burningDeleteComment(id)
      loadComments(uid, comments[uid]?.page || 1)
    } catch { /* 已提示 */ }
  }

  /** 一张榜：title/badge=第一名称号；rows [{userId, userNickname, avatar, value}]；fmt 值格式化。
   *  注意：这是"渲染函数"而非组件——若定义成父组件内部的组件，父组件每次重渲染都会换掉
   *  组件身份导致整棵子树卸载重建，评论输入框每敲一个字就丢焦点、移动端键盘收起（踩过） */
  const renderBoard = (boardKey, title, icon, champion, rows, fmt) => (
    <Card
      title={<span>{icon} {title}</span>}
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ body: { padding: isMobile ? '6px 10px' : '8px 14px' } }}
    >
      {(!rows || rows.length === 0) ? (
        <Empty description="该时段还没有数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '14px 0' }} />
      ) : rows.map((r, i) => {
        const key = `${boardKey}:${r.userId}`
        const isOpen = openKey === key
        const cm = comments[r.userId]
        const liked = myLikes.includes(r.userId)
        return (
          <div key={r.userId} style={{ borderTop: i === 0 ? 'none' : '1px solid #f7f7f7' }}>
            <div
              onClick={() => toggleOpen(boardKey, r.userId)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 2px', cursor: 'pointer' }}
            >
              <span style={{ width: 26, textAlign: 'center', fontSize: i < 3 ? 16 : 13, color: '#bbb', flexShrink: 0, fontWeight: 700 }}>
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <Avatar size={30} src={r.avatar || undefined} icon={r.avatar ? undefined : <UserOutlined />} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 650, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dn(r.userId, r.userNickname)}
                </span>
                {i === 0 && (
                  <Tag color="gold" style={{ marginInlineEnd: 0, flexShrink: 0 }}><CrownFilled /> {champion}</Tag>
                )}
              </span>
              <span style={{ fontWeight: 800, color: FLAME, flexShrink: 0, fontSize: 14 }}>{fmt(r.value)}</span>
              <span
                onClick={(e) => doLike(r.userId, e)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, cursor: 'pointer', color: liked ? '#eb2f96' : '#bbb', fontSize: 13, minWidth: 34, justifyContent: 'flex-end' }}
              >
                {liked ? <HeartFilled /> : <HeartOutlined />} {likes[r.userId] || 0}
              </span>
              <span style={{ color: '#ccc', fontSize: 10, flexShrink: 0 }}>{isOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}</span>
            </div>

            {/* 下拉评论区：分页（每页 5 条）+ 输入框 */}
            {isOpen && (
              <div style={{ margin: '0 0 10px 34px', background: '#fffaf5', border: '1px solid #ffe7d6', borderRadius: 10, padding: '8px 10px' }}>
                {cm?.loading ? (
                  <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
                ) : (cm?.rows || []).length === 0 ? (
                  <div style={{ color: '#c9a', fontSize: 12, padding: '4px 2px' }}>还没有评论，来说两句</div>
                ) : (
                  <>
                    {(cm.rows || []).map((c) => (
                      <div key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #fff1e6' }}>
                        <Avatar size={22} src={c.avatar || undefined} icon={c.avatar ? undefined : <UserOutlined />} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            <span style={{ fontWeight: 650, color: '#595959' }}>{dn(c.authorId, c.authorName)}</span>
                            <span style={{ marginLeft: 8 }}>{c.createTime ? dayjs(c.createTime).format('M-D HH:mm') : ''}</span>
                            {c.canDelete && (
                              <Popconfirm title="删除这条评论？" onConfirm={() => doDeleteComment(r.userId, c.id)} okText="删除" cancelText="取消">
                                <a style={{ color: '#ff4d4f', marginLeft: 8, fontSize: 12 }}>删除</a>
                              </Popconfirm>
                            )}
                          </div>
                          <div style={{ fontSize: 13, marginTop: 2, wordBreak: 'break-all' }}>{c.content}</div>
                        </div>
                      </div>
                    ))}
                    {(cm?.total || 0) > (cm?.rows?.length || 0) || (cm?.page || 1) > 1 ? (
                      <div style={{ textAlign: 'center', padding: '8px 0 2px' }}>
                        <Pagination
                          simple
                          size="small"
                          current={cm?.page || 1}
                          pageSize={5}
                          total={cm?.total || 0}
                          onChange={(p) => loadComments(r.userId, p)}
                        />
                      </div>
                    ) : null}
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Input
                    size="small"
                    value={cInput}
                    onChange={(e) => setCInput(e.target.value)}
                    onPressEnter={() => doComment(r.userId)}
                    placeholder={`评论 ${dn(r.userId, r.userNickname)}…`}
                    maxLength={200}
                  />
                  <Button size="small" type="primary" loading={posting} onClick={() => doComment(r.userId)} style={{ background: FLAME }}>
                    发送
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )

  const ring = (size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.16)', ...pos })
  const pill = (active) => ({
    cursor: 'pointer', userSelect: 'none', padding: '3px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
    color: active ? '#fff' : FLAME, background: active ? FLAME : 'transparent', transition: 'all .15s', whiteSpace: 'nowrap',
  })

  return (
    <>
      {/* 横幅：燃烧的火焰红 */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '22px 28px', marginBottom: 16,
          background: 'linear-gradient(120deg, #5c0011 0%, #a8071a 45%, #d4380d 80%, #fa8c16 100%)',
        }}
      >
        <div style={ring(170, { top: -70, right: 100 })} />
        <div style={ring(110, { bottom: -45, right: 260 })} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
            <FireFilled style={{ marginRight: 8, color: '#ffa940' }} />耿阿姨烤串 · Burning！
          </div>
          <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
            谁在燃烧！工时最长的是劳模，穿串最多的是串王；点人展开评论，给拼命的人点个赞。
          </div>
        </div>
      </div>

      {/* 周/月切换 + 时段导航（默认按周，比拼感更强） */}
      <Card style={{ borderRadius: 16, marginBottom: 16 }} styles={{ body: { padding: '10px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 999, padding: 2 }}>
            <span style={pill(mode === 'week')} onClick={() => setMode('week')}>按周</span>
            <span style={pill(mode === 'month')} onClick={() => setMode('month')}>按月</span>
          </span>
          <span style={{ flex: isMobile ? '1 1 100%' : 1 }} />
          {mode === 'month' ? (
            <>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{month.format('YYYY 年 M 月')}</span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setMonth((m) => m.add(1, 'month'))} />
              <span onClick={() => setMonth(dayjs())} style={{ cursor: 'pointer', userSelect: 'none', padding: '3px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: FLAME, background: '#fff1f0', border: '1px solid #ffccc7', whiteSpace: 'nowrap' }}>
                回到本月
              </span>
            </>
          ) : (
            <>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setWeek((w) => w.subtract(7, 'day'))} />
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {week.format('M月D日')} ~ {week.add(6, 'day').format('M月D日')}
              </span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setWeek((w) => w.add(7, 'day'))} />
              <span onClick={() => setWeek(mondayOf(dayjs()))} style={{ cursor: 'pointer', userSelect: 'none', padding: '3px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: FLAME, background: '#fff1f0', border: '1px solid #ffccc7', whiteSpace: 'nowrap' }}>
                回到本周
              </span>
            </>
          )}
        </div>
      </Card>

      {data === null ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : !data ? (
        <Card style={{ borderRadius: 16 }}><Empty description="加载失败" /></Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            {renderBoard('hours', '工时榜', '⏱', '劳模', data.hours, fmtHours)}
          </Col>
          <Col xs={24} lg={12}>
            {renderBoard('skewers', '穿串榜', '🍢', '串王', data.skewers, (v) => `${v} 串`)}
          </Col>
          <Col xs={24} lg={12}>
            {renderBoard('latestOff', '最晚下班榜', '🌙', '熬夜冠军', data.latestOff, fmtOff)}
          </Col>
          <Col xs={24} lg={12}>
            {renderBoard('days', '出勤天数榜', '📅', '全勤之星', data.days, (v) => `${v} 天`)}
          </Col>
        </Row>
      )}
    </>
  )
}
