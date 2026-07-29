import { useEffect, useMemo, useRef, useState } from 'react'
import { Input, Modal } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../api/search'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'
import { HistoryChips, SearchResults } from './SearchResults'
import { dropHistory, flatten, pushHistory, readHistory } from './searchModel'

/**
 * 全局搜索的**入口**。两种形态：
 *
 * - `variant='pill'`（桌面端顶栏）：一枚自绘的触发胶囊，点它或按 `/` 弹出居中面板，
 *   面板内防抖查询、↑↓ + Enter 选择。桌面有键盘，这套 cmd-k 交互是最快的。
 * - `variant='bar'`（移动端顶栏）：一条**假输入框**——点下去不在原地展开，
 *   直接跳到 `/search` 整页搜索。
 *
 * ## 移动端为什么从"下拉面板"改成"整页"
 *
 * 下拉面板要处理一堆本来不该存在的问题：面板挂在哪一层、点哪儿算收起、
 * 遮罩盖不盖得住顶栏、结果多了往下顶还是自己滚。这些在整页里全都不存在。
 * 而且整页还能顺手把「最近搜索 + 热帖榜」摆开——一条 62vh 高的下拉里塞不下这些。
 *
 * 假输入框而不是真的 `<input readOnly>`：readOnly 的 input 在 iOS 上点下去
 * 仍然会闪一下光标，看着像是坏了。用 div 画成输入框的样子就没有这个问题。
 */
export default function GlobalSearch({ variant = 'pill' }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { canUse } = useAuth()
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

  const rows = useMemo(() => flatten(data, kw, canData), [data, kw, canData])
  const itemIdx = useMemo(() => rows.map((r, i) => (r.kind === 'item' ? i : -1)).filter((i) => i >= 0), [rows])

  const isBar = variant === 'bar'

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

  // `/` 打开面板（输入框里打字时不劫持）。整页搜索没有这个快捷键——它是给键盘用户的
  useEffect(() => {
    if (isBar) return undefined
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
  }, [open, isBar])

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

  /** 点一条历史：填回输入框并立刻搜，焦点留在输入框（还能继续改） */
  const runHistory = (k) => {
    onChange(k)
    inputRef.current?.focus()
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

  /**
   * 移动端顶栏：画成输入框的样子，点一下跳整页搜索。
   * 高度/圆角/底色跟原来那个真输入框保持一致，改动对眼睛是无感的。
   */
  if (isBar) {
    return (
      <div
        role="button"
        onClick={() => navigate('/search')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 34, borderRadius: 17, padding: '0 14px',
          background: '#f5f5f5', color: '#aaa', fontSize: 14,
          cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <SearchOutlined style={{ color: '#aaa', fontSize: 15 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          想看点什么？
        </span>
      </div>
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
        {!isMobile && <span style={{ flex: 1 }}>想看点什么？</span>}
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
          placeholder="想看点什么？"
          prefix={<SearchOutlined style={{ color: '#fa541c', fontSize: 18, marginRight: 6 }} />}
          style={{ padding: '14px 18px', fontSize: 16, borderBottom: '1px solid #f0f0f0', borderRadius: 0 }}
        />
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: rows.length ? 8 : 0 }}>
          {!loading && !kw.trim() ? (
            history.length ? (
              <HistoryChips history={history} onPick={runHistory} onClear={() => setHistory(dropHistory())} />
            ) : (
              <div style={{ textAlign: 'center', color: '#bbb', padding: '28px 0', fontSize: 13 }}>
                输入关键词搜索帖子、球员、资讯、用户
              </div>
            )
          ) : (
            <SearchResults rows={rows} loading={loading} kw={kw} active={active} onHover={setActive} onPick={pick} />
          )}
        </div>
      </Modal>
    </>
  )
}
