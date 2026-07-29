import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty, Input, Modal, Spin, Tag } from 'antd'
import { CloseOutlined, EnterOutlined, FileTextOutlined, FolderOpenOutlined, LockOutlined, ReadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../api/search'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'
import { NBA_TEAM_NAMES, teamRegion } from '../pages/players/rankConfig'
import TeamLogo from './TeamLogo'

/**
 * 全局搜索（cmd-k 风格）：顶栏是一枚自绘的触发胶囊（hover 样式完全自控，
 * 不经过 ProLayout/antd 的任何 hover 机制），点击或按 `/` 弹出居中搜索面板；
 * 面板内防抖查询，结果纵向分四组（球员/新闻/资讯/用户），支持 ↑↓ + Enter 选择。
 */

/**
 * 最近搜索：只存关键词，最多 10 条，放 localStorage（换设备不同步，够用）。
 *
 * **只在"点了某条结果"时记录**，不在每次查询时记。查询是防抖触发的，
 * 打字过程中「杜」「杜兰」「杜兰特」会各触发一次，全记下来历史里全是半截词。
 * 点了结果说明这次搜索真的有用，才值得留。
 */
const HISTORY_KEY = 'epoch:search-history'
const HISTORY_MAX = 10

const readHistory = () => {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []
  } catch {
    return []   // 存的东西坏了就当没有，别让搜索框整个崩掉
  }
}

const pushHistory = (kw) => {
  const k = (kw || '').trim()
  if (!k) return readHistory()
  // 已存在就提到最前，不产生重复项
  const next = [k, ...readHistory().filter((s) => s !== k)].slice(0, HISTORY_MAX)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式下 localStorage 会抛，历史丢了不影响搜索本身
  }
  return next
}

const dateStr = (v) => {
  if (!v) return ''
  const s = typeof v === 'string' ? v : new Date(v).toISOString()
  return s.slice(0, 10)
}

/** 球队是固定的 30 支（前端配置），直接本地匹配：队码（不分大小写）或中文名包含关键词 */
function matchTeams(kw) {
  const k = kw.trim().toLowerCase()
  if (!k) return []
  return Object.entries(NBA_TEAM_NAMES)
    .filter(([code, name]) => code.toLowerCase().includes(k) || name.includes(kw.trim()))
    .slice(0, 6)
    .map(([code, name]) => {
      const { conf, div } = teamRegion(code)
      return {
        key: `team:${code}`,
        to: `/players/team/${code}`,
        node: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <TeamLogo code={code} size={20} />
            <b>{name}</b>
            <Tag color="orange" style={{ marginInlineEnd: 0 }}>{code}</Tag>
            {conf && <span style={{ color: '#bbb', fontSize: 12 }}>{conf} · {div}</span>}
          </span>
        ),
      }
    })
}

/** 打平成 [{group}, {item}...] 的列表，方便键盘上下移动。canData=false 时不出球队组（数据分析模块对该用户未开放） */
function flatten(d, kw, canData, dn) {
  const out = []
  const push = (group, items) => {
    if (!items?.length) return
    out.push({ kind: 'group', key: `g-${group}`, label: group })
    items.forEach((it) => out.push({ kind: 'item', ...it }))
  }
  push('球员', d?.players?.map((p) => ({
    key: `player:${p.playerId}`,
    to: `/players/${p.playerId}`,
    node: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {/* 传过照片的球员出头像，否则还是球衣号标签 */}
        {p.photo ? (
          <img
            src={p.photo}
            alt=""
            style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', flexShrink: 0, background: '#f0f0f0' }}
          />
        ) : (
          <Tag color="volcano" style={{ marginInlineEnd: 0, flexShrink: 0 }}>#{p.playerNumber ?? '-'}</Tag>
        )}
        <b style={{ flexShrink: 0 }}>{p.playerName}</b>
        {p.nameEn && p.nameEn !== p.playerName && (
          <span style={{ color: '#bbb', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nameEn}</span>
        )}
      </span>
    ),
  })))
  push('球队', canData ? matchTeams(kw) : [])
  const newsNode = (n, icon) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {icon}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
      <span style={{ color: '#bbb', fontSize: 12, flexShrink: 0 }}>{dateStr(n.publishDate)}</span>
    </span>
  )
  push('新闻', d?.news?.map((n) => ({
    key: `news:${n.newsId}`,
    to: `/news/${n.newsId}`,
    node: newsNode(n, <ReadOutlined style={{ color: '#fa541c' }} />),
  })))
  push('专题', d?.topics?.map((t) => ({
    key: `topic:${t.topicId}`,
    to: `/news/topic/${t.topicId}`,
    node: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FolderOpenOutlined style={{ color: '#fa8c16' }} />
        <b style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</b>
        {t.visibility === 'private' && <Tag icon={<LockOutlined />} style={{ marginInlineEnd: 0, flexShrink: 0 }}>私密</Tag>}
      </span>
    ),
  })))
  push('资讯', d?.forum?.map((n) => ({
    key: `forum:${n.newsId}`,
    to: `/news/${n.newsId}`,
    node: newsNode(n, <FileTextOutlined style={{ color: '#999' }} />),
  })))
  push('用户', d?.users?.map((u) => ({
    key: `user:${u.userId}`,
    to: `/users/${u.userId}`,
    node: (
      <span>
        <UserOutlined style={{ marginRight: 8, color: '#999' }} />
        {dn(u.userId, u.userNickname || u.userName)}
        <span style={{ color: '#bbb', fontSize: 12, marginLeft: 8 }}>@{u.userName}</span>
      </span>
    ),
  })))
  return out
}

export default function GlobalSearch({ variant = 'pill' }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user, dn, canUse } = useAuth()
  // NBA 模块是否对本人开放（默认关，超管逐个放行）：未开放则不出球队组（球员组由后端一并过滤）
  const canData = canUse('featData')
  const [open, setOpen] = useState(false)
  const [hoverTrigger, setHoverTrigger] = useState(false)
  const [kw, setKw] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1) // 键盘高亮的行下标（打平列表）
  const [history, setHistory] = useState(readHistory)   // 最近搜索（本机 localStorage）
  const timer = useRef()
  const seq = useRef(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const rows = useMemo(() => flatten(data, kw, canData, dn), [data, kw, canData, dn])
  const itemIdx = useMemo(() => rows.map((r, i) => (r.kind === 'item' ? i : -1)).filter((i) => i >= 0), [rows])

  // 顶栏触发胶囊外层：剥掉 ProLayout 动作项的 hover 类（灰底保险丝，双保险）
  useEffect(() => {
    const item = wrapRef.current?.closest('[class*="actions-item"], [class*="actions-hover"]')
    if (!item) return
    const strip = () => {
      const doomed = [...item.classList].filter((c) => c.includes('actions-hover'))
      if (doomed.length) item.classList.remove(...doomed)
      item.style.background = 'transparent'
    }
    strip()
    const mo = new MutationObserver(strip)
    mo.observe(item, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  // `/` 打开面板（输入框里打字时不劫持）
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable
      if (e.key === '/' && !typing && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const reset = () => {
    setKw('')
    setData(null)
    setActive(-1)
    setLoading(false)
    clearTimeout(timer.current)
  }

  const onChange = (text) => {
    setKw(text)
    setActive(-1)
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
    // 记在跳转之前：reset() 会把 kw 清掉
    setHistory(pushHistory(kw))
    navigate(row.to)
    setOpen(false)
    reset()
  }

  const close = () => { setOpen(false); reset() }

  /** 点一条历史：填回输入框并立刻搜，焦点留在输入框（还能继续改） */
  const runHistory = (k) => {
    onChange(k)
    inputRef.current?.focus()
  }

  const clearHistory = () => {
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* 隐私模式下会抛，忽略 */ }
    setHistory([])
  }

  const onKeyDown = (e) => {
    if (!itemIdx.length) return
    const pos = itemIdx.indexOf(active)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(itemIdx[(pos + 1) % itemIdx.length])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(itemIdx[(pos - 1 + itemIdx.length) % itemIdx.length])
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(rows[active])
    }
  }

  const kbd = {
    fontSize: 12, color: '#999', background: '#f5f5f5', border: '1px solid #e8e8e8',
    borderRadius: 4, padding: '0 6px', lineHeight: '18px', fontFamily: 'monospace',
  }

  // variant='bar'：移动端顶栏那条占满宽度的搜索框
  const isBar = variant === 'bar'

  /**
   * 关键词为空时显示的内容：有历史就列历史，没有就给一句提示。
   * 弹窗版和移动端下拉版共用。
   */
  const historyPanel = history.length ? (
    <div style={{ padding: '4px 4px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px 8px' }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#999', letterSpacing: 1 }}>最近搜索</span>
        <a onClick={clearHistory} style={{ fontSize: 12, color: '#bbb' }}>清空</a>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 8px' }}>
        {history.map((k) => (
          <Tag
            key={k}
            onClick={() => runHistory(k)}
            style={{ margin: 0, cursor: 'pointer', borderRadius: 14, padding: '3px 12px', fontSize: 13, background: '#f5f5f5', border: '1px solid #eee' }}
          >
            {k}
          </Tag>
        ))}
      </div>
    </div>
  ) : (
    <div style={{ textAlign: 'center', color: '#bbb', padding: '28px 0', fontSize: 13 }}>
      输入关键词搜索帖子、球员、资讯、用户
    </div>
  )

  /** 结果列表。弹窗版和移动端下拉版共用同一份渲染 */
  const resultList = (
    <>
      {loading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}
      {!loading && kw.trim() && !itemIdx.length && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到相关内容" style={{ padding: 24 }} />
      )}
      {!loading && rows.map((r, i) =>
        r.kind === 'group' ? (
          <div key={r.key} style={{ padding: '10px 12px 4px', fontSize: 12, fontWeight: 600, color: '#fa541c', letterSpacing: 1 }}>
            {r.label}
          </div>
        ) : (
          <div
            key={r.key}
            onClick={() => pick(r)}
            onMouseEnter={() => setActive(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 8, cursor: 'pointer', fontSize: 14,
              background: active === i ? '#fff2ea' : 'transparent',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{r.node}</span>
            {active === i && <EnterOutlined style={{ color: '#fa541c' }} />}
          </div>
        ),
      )}
    </>
  )

  /**
   * 移动端：**不弹窗**，顶栏那条就是真正的输入框。
   *
   * 原来点一下弹一个居中小窗，在手机上有两个问题：多了一次"等动画"的等待，
   * 而且窗口顶部离键盘很远，视线要来回跳。改成就地聚焦之后，点一下键盘直接起来，
   * 结果从顶栏底下垂下来，眼睛不用移动。
   *
   * 结果面板用 fixed 定位挂在顶栏正下方（高度读 --mobile-topbar-h，AppLayout 写入），
   * 而不是相对定位——顶栏本身是 fixed 的，跟着它做相对定位会被内容区的层叠上下文困住。
   */
  if (isBar) {
    return (
      <>
        <Input
          ref={inputRef}
          value={kw}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          /**
           * **收起面板靠失焦，不靠点遮罩。**
           *
           * 第一版只在遮罩上挂了 onClick，结果面板关不掉：遮罩的 z-index 压在顶栏下面，
           * 点顶栏那一条根本碰不到它；点面板白框本身也没有任何处理。
           * 失焦这条路不管点哪儿都会触发——点顶栏、点面板、点内容区、按返回键，
           * 输入框都会失去焦点。
           *
           * 配合下面面板上的 onMouseDown preventDefault：不拦的话，点结果的瞬间
           * 先失焦 → 面板卸载 → click 落空，表现就是"点了没反应"。
           */
          onBlur={close}
          onKeyDown={onKeyDown}
          placeholder="搜索帖子 / 球员 / 用户"
          prefix={<SearchOutlined style={{ color: '#aaa' }} />}
          // 点右上角的 × 只清空文字、不收起面板，所以自己接管 allowClear 的图标
          allowClear={{ clearIcon: <CloseOutlined style={{ color: '#bbb' }} onClick={() => onChange('')} /> }}
          style={{ height: 34, borderRadius: 17, background: '#f5f5f5' }}
        />
        {open && (
          <>
            {/* 遮罩只负责压暗背景。关闭由输入框失焦完成——点这里会让输入框失焦，
                所以不需要再挂 onClick */}
            <div
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 149,
                top: 'var(--mobile-topbar-h, 50px)', background: 'rgba(0,0,0,.32)',
              }}
            />
            <div
              // 见上面 onBlur 的说明：不阻止默认行为，点结果会先失焦把面板卸载掉
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'fixed', left: 0, right: 0, zIndex: 151,
                top: 'var(--mobile-topbar-h, 50px)',
                maxHeight: '62vh', overflowY: 'auto',
                background: '#fff', borderTop: '1px solid #f0f0f0',
                boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                padding: 8,
                // 惯性滚动，否则在 iOS 上滑起来是一顿一顿的
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {!loading && !kw.trim() ? historyPanel : resultList}
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <>
      {/* 触发器：自绘，hover 只描边变色 */}
      <div
        ref={wrapRef}
        role="button"
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHoverTrigger(true)}
        onMouseLeave={() => setHoverTrigger(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start',
          gap: 8, height: 32, padding: isMobile ? 0 : '0 6px 0 12px',
          border: `1px solid ${hoverTrigger ? '#fa541c' : '#e8e8e8'}`, borderRadius: 16,
          background: '#fff', color: '#999', fontSize: 13, cursor: 'pointer',
          transition: 'border-color .2s', userSelect: 'none', width: isMobile ? 32 : 220,
        }}
      >
        <SearchOutlined style={{ color: hoverTrigger ? '#fa541c' : '#aaa', transition: 'color .2s' }} />
        {!isMobile && <span style={{ flex: 1 }}>搜索…</span>}
        {!isMobile && <span style={kbd}>/</span>}
      </div>

      <Modal
        open={open}
        onCancel={() => { setOpen(false); reset() }}
        footer={null}
        closable={false}
        width={580}
        style={{ top: 90 }}
        destroyOnClose
        // Input 上的 autoFocus 会被 Modal 的入场动画抢掉焦点（antd 动画结束才把焦点交还给内容），
        // 所以等弹窗真正打开后再主动聚焦一次——按 / 或点搜索图标就能直接打字
        afterOpenChange={(opened) => { if (opened) inputRef.current?.focus({ cursor: 'end' }) }}
        styles={{ content: { padding: 0, overflow: 'hidden', borderRadius: 14 } }}
      >
        <Input
          ref={inputRef}
          autoFocus
          size="large"
          variant="borderless"
          value={kw}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入关键词搜索…"
          prefix={<SearchOutlined style={{ color: '#fa541c', fontSize: 18, marginRight: 6 }} />}
          style={{ padding: '14px 18px', fontSize: 16, borderBottom: '1px solid #f0f0f0', borderRadius: 0 }}
        />
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: rows.length ? 8 : 0 }}>
          {!loading && !kw.trim() ? historyPanel : resultList}
        </div>
      </Modal>
    </>
  )
}
