import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty, Input, Modal, Spin, Tag } from 'antd'
import { EnterOutlined, FileTextOutlined, FolderOpenOutlined, LockOutlined, ReadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../api/search'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'
import { NBA_TEAM_NAMES, teamRegion } from '../pages/players/rankConfig'

/**
 * 全局搜索（cmd-k 风格）：顶栏是一枚自绘的触发胶囊（hover 样式完全自控，
 * 不经过 ProLayout/antd 的任何 hover 机制），点击或按 `/` 弹出居中搜索面板；
 * 面板内防抖查询，结果纵向分四组（球员/新闻/资讯/用户），支持 ↑↓ + Enter 选择。
 */

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
          <span>
            <Tag color="orange" style={{ marginRight: 8 }}>{code}</Tag>
            <b>{name}</b>
            {conf && <span style={{ color: '#bbb', fontSize: 12, marginLeft: 8 }}>{conf} · {div}</span>}
          </span>
        ),
      }
    })
}

/** 打平成 [{group}, {item}...] 的列表，方便键盘上下移动。canData=false 时不出球队组（数据分析模块对该用户未开放） */
function flatten(d, kw, canData) {
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
      <span>
        <Tag color="volcano" style={{ marginRight: 8 }}>#{p.playerNumber ?? '-'}</Tag>
        <b>{p.playerName}</b>
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
        {u.userNickname || u.userName}
        <span style={{ color: '#bbb', fontSize: 12, marginLeft: 8 }}>@{u.userName}</span>
      </span>
    ),
  })))
  return out
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  // 数据分析(Dream Union)是否对本人开放：未开放则前端不出球队组（球员组由后端一并过滤）
  const canData = !user || user.isSuperManager || user.featData !== false
  const [open, setOpen] = useState(false)
  const [hoverTrigger, setHoverTrigger] = useState(false)
  const [kw, setKw] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1) // 键盘高亮的行下标（打平列表）
  const timer = useRef()
  const seq = useRef(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const rows = useMemo(() => flatten(data, kw, canData), [data, kw, canData])
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
    navigate(row.to)
    setOpen(false)
    reset()
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

  return (
    <>
      {/* 触发胶囊：自绘，hover 只描边变色 */}
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
          {loading && (
            <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          )}
          {!loading && !kw.trim() && (
            <div style={{ textAlign: 'center', color: '#bbb', padding: '32px 0', fontSize: 13 }}>
              输入关键词，↑↓ 选择，Enter 打开，Esc 关闭
            </div>
          )}
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
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  borderRadius: 8, cursor: 'pointer', fontSize: 14,
                  background: active === i ? '#fff2ea' : 'transparent',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{r.node}</span>
                {active === i && <EnterOutlined style={{ color: '#fa541c' }} />}
              </div>
            ),
          )}
        </div>
      </Modal>
    </>
  )
}
