import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Empty, Input, Spin } from 'antd'
import { CloseCircleFilled, FireOutlined, LikeOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { searchApi } from '../../api/search'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'
import BackButton from '../../components/BackButton'
import { HistoryChips, SearchResults } from '../../components/SearchResults'
import { dropHistory, flatten, pushHistory, readHistory } from '../../components/searchModel'

/**
 * 整页搜索（/search）。
 *
 * 结构从上到下：**返回 + 搜索框（同一行）** → 最近搜索 → 热帖榜。
 * 一旦输入了关键词，下半部分整块换成搜索结果。
 *
 * ## 为什么是一整页，而不是顶栏下面垂一块面板
 *
 * 面板版要处理"点哪儿算收起""遮罩盖不盖得住顶栏""结果多了怎么滚"这些问题，
 * 而这些问题在整页里根本不存在——它就是一张普通页面，有自己的返回。
 * 顺带还多出了空间：没输关键词的时候摆「最近搜索 + 热帖榜」，
 * 让这一页在什么都没搜的时候也有东西可看。
 *
 * ## 顶部这一行
 *
 * 移动端做成 fixed，高度和 App 顶栏一致（TOP_BAR_HEIGHT + 刘海），
 * AppLayout 在这一页会把自己那条顶栏收起来（见 mobileNav.showTopBar），
 * 所以两者不会同时出现，位置也严丝合缝。
 * 桌面端 ProLayout 自己的顶栏是 fixed 的，这里再 fixed 一条会压上去，所以桌面走普通流。
 */

const MEDAL = ['#f5222d', '#fa8c16', '#faad14']

export default function SearchPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { canUse } = useAuth()
  const canData = canUse('featData')

  const [kw, setKw] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(readHistory)
  const [hot, setHot] = useState(null)
  const timer = useRef()
  const seq = useRef(0)
  const inputRef = useRef(null)

  const rows = useMemo(() => flatten(data, kw, canData), [data, kw, canData])

  /**
   * 进来就把键盘唤起来。
   *
   * 用 useLayoutEffect 而不是 useEffect：iOS Safari 只在**用户手势的那一拍**里
   * 才允许 focus() 唤起键盘。React 对点击这类离散事件是同步刷新的，
   * layout effect 还在那一拍里；等到 useEffect（下一帧）就已经出了手势范围，
   * 键盘不会弹，人得再点一次输入框。
   */
  useLayoutEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 热帖榜：进页面拉一次。它是"还没搜的时候看什么"，不随关键词变
  useEffect(() => {
    let alive = true
    searchApi.hotPosts(10)
      .then((r) => { if (alive) setHot(Array.isArray(r) ? r : []) })
      .catch(() => { if (alive) setHot([]) })
    return () => { alive = false }
  }, [])

  const onChange = (text) => {
    setKw(text)
    clearTimeout(timer.current)
    const k = text.trim()
    if (!k) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const mySeq = ++seq.current
      try {
        const d = await searchApi.globalSearch(k)
        if (mySeq === seq.current) setData(d)
      } catch {
        if (mySeq === seq.current) setData(null)
      } finally {
        if (mySeq === seq.current) setLoading(false)
      }
    }, 300)
  }

  const pick = (row) => {
    if (!row?.to) return
    // 记在跳转之前——只有"点了某条结果"才算一次有效搜索（见 searchCore 的说明）
    pushHistory(kw)
    navigate(row.to)
  }

  const runHistory = (k) => {
    onChange(k)
    inputRef.current?.focus()
  }

  const bar = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        // 一行放下：返回不收缩、输入框吃掉剩余宽度。nowrap 是明确写死的——
        // 输入框有最小宽度，窄屏上不写会被挤到第二行
        flexWrap: 'nowrap',
        padding: isMobile ? '8px 12px' : 0,
        paddingTop: isMobile ? 'calc(8px + env(safe-area-inset-top))' : 0,
        marginBottom: isMobile ? 0 : 16,
        ...(isMobile
          ? {
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 150,
              // 不透明白底，不用 backdrop-filter（理由见 AppLayout 顶栏那处的注释）
              background: '#fff',
              borderBottom: '1px solid #f0f0f0',
            }
          : {}),
      }}
    >
      <BackButton size={isMobile ? 32 : 30} />
      <Input
        ref={inputRef}
        value={kw}
        onChange={(e) => onChange(e.target.value)}
        placeholder="想看点什么？"
        // 手机键盘上把「回车」画成「搜索」。结果是边打边出的，按下去只是收键盘看结果
        enterKeyHint="search"
        onPressEnter={() => inputRef.current?.blur()}
        prefix={<SearchOutlined style={{ color: '#aaa' }} />}
        allowClear={{ clearIcon: <CloseCircleFilled style={{ color: '#ccc' }} /> }}
        style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 17, background: '#f5f5f5' }}
      />
    </div>
  )

  return (
    <>
      {bar}
      {/* 这里**不需要**占位块：AppLayout 在移动端恒留一块等高的（它自己那条顶栏
          在这一页收起，但占位保留），刚好被这条顶上去 */}

      {kw.trim() ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 8 }}>
          <SearchResults rows={rows} loading={loading} kw={kw} onPick={pick} />
        </div>
      ) : (
        <>
          {history.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: '6px 6px 12px' }}>
              <HistoryChips history={history} onPick={runHistory} onClear={() => setHistory(dropHistory())} />
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px 6px', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              <FireOutlined style={{ color: '#f5222d' }} />
              热帖榜
            </div>
            {hot === null ? (
              <div style={{ textAlign: 'center', padding: 28 }}><Spin /></div>
            ) : hot.length ? (
              hot.map((p, i) => (
                <Link
                  key={p.newsId}
                  to={`/news/${p.newsId}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', color: 'inherit',
                    borderBottom: i === hot.length - 1 ? 'none' : '1px solid #f5f5f5',
                  }}
                >
                  {/* 前三名给奖牌色，其余淡灰——一眼扫过去知道榜首在哪儿，又不至于整列都在喊 */}
                  <span style={{ width: 18, textAlign: 'center', fontStyle: 'italic', fontWeight: 800, color: i < 3 ? MEDAL[i] : '#c8c8c8', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14, fontWeight: i < 3 ? 600 : 400,
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}
                    >
                      {p.title || '(无标题)'}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.topicName && <span style={{ color: '#fa8c16' }}>{p.topicName}</span>}
                      <span><LikeOutlined /> {p.goodNum ?? 0}</span>
                      <span><MessageOutlined /> {p.commentNum ?? 0}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" style={{ padding: '12px 0 20px' }} />
            )}
          </div>
        </>
      )}
    </>
  )
}
