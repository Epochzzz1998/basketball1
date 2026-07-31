import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Spin, message } from 'antd'
import { CloseCircleFilled, StarFilled } from '@ant-design/icons'
import { newsApi } from '../../api/news'
import { RatingImagePicker } from '../../components/RatingCard'

/**
 * 发帖器里那几个"点一下弹出来填"的东西：话题选择、投票编辑、打分编辑，
 * 以及填完之后摆在正文下面的预览卡。
 *
 * 单独一个文件是因为 NewsEdit 本身已经够长了，而这三块彼此独立、只经由
 * value/onChange 和外面打交道。
 */

export const MAX_TAGS = 10

// 没有现成话题时兜底的推荐项（通用分类，不绑定具体主题）
const FALLBACK_TAGS = ['讨论', '分享', '求助', '公告', '资源', '教程', '反馈', '闲聊', '重磅', '精华']

/** 一枚话题胶囊。选中=品牌橙实心边框，未选=灰底 */
function TagChip({ text, count, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none',
        padding: '5px 12px', borderRadius: 999, fontSize: 13, lineHeight: 1.4,
        color: active ? '#d4380d' : '#595959',
        background: active ? '#fff1e6' : '#f5f5f5',
        border: `1px solid ${active ? '#ffbb96' : 'transparent'}`,
        transition: 'all .15s',
      }}
    >
      #{text}
      {count > 0 && <span style={{ fontSize: 11, color: active ? '#fa8c16' : '#bbb' }}>{count}</span>}
    </span>
  )
}

/**
 * 添加话题弹窗：列出**本专题里别人已经用过的**话题（按用得多少排），也可以自己敲一个。
 *
 * 已有话题从帖子列表里现算——后端没有聚合接口，而列表接口本来就是 ES 全量返回
 * （专题页每次进来都会拉这一份），再拉一次不算新增负担。弹窗打开才拉，不打开不花钱。
 */
export function TagPickerModal({ open, onClose, value, onChange, topicId, official }) {
  return (
    <Modal open={open} onCancel={onClose} title="添加话题" footer={null} width={460} destroyOnClose>
      {/* 内容单独一层：`destroyOnClose` 让它随弹窗一起卸载，
          于是"关掉再打开"天然是全新的一份状态，不用在 effect 里手动重置 */}
      <TagPickerBody value={value} onChange={onChange} topicId={topicId} official={official} onClose={onClose} />
    </Modal>
  )
}

function TagPickerBody({ value, onChange, topicId, official, onClose }) {
  const [pool, setPool] = useState(null) // [{ text, count }]，null = 还在拉
  const [kw, setKw] = useState('')

  useEffect(() => {
    let alive = true
    const params = topicId
      ? { page: 1, limit: 9999, newsChannel: 'forum', topicId }
      : { page: 1, limit: 9999, newsChannel: official ? 'official' : 'forum' }
    newsApi.listNews(params)
      .then((r) => {
        if (!alive) return
        const count = new Map()
        for (const p of r?.records || []) {
          for (const t of String(p.tags || '').split(',')) {
            const s = t.trim()
            if (s) count.set(s, (count.get(s) || 0) + 1)
          }
        }
        setPool([...count.entries()]
          .map(([text, c]) => ({ text, count: c }))
          .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)))
      })
      .catch(() => { if (alive) setPool([]) })
    return () => { alive = false }
  }, [topicId, official])

  const toggle = (t) => {
    if (value.includes(t)) return onChange(value.filter((x) => x !== t))
    if (value.length >= MAX_TAGS) return message.warning(`最多 ${MAX_TAGS} 个话题`)
    return onChange([...value, t])
  }

  // 敲进去的新话题：去掉开头的 #，空的、重复的都不收
  const addTyped = () => {
    const t = kw.trim().replace(/^#+/, '').trim()
    if (!t) return
    if (!value.includes(t)) {
      if (value.length >= MAX_TAGS) return message.warning(`最多 ${MAX_TAGS} 个话题`)
      onChange([...value, t])
    }
    setKw('')
  }

  const k = kw.trim().replace(/^#+/, '').toLowerCase()
  const existing = useMemo(
    () => (pool || []).filter((t) => !k || t.text.toLowerCase().includes(k)),
    [pool, k],
  )
  // 推荐项里已经出现在"本专题已有"里的就不再重复列一遍
  const suggested = useMemo(() => {
    const has = new Set((pool || []).map((t) => t.text))
    return FALLBACK_TAGS.filter((t) => !has.has(t) && (!k || t.toLowerCase().includes(k)))
  }, [pool, k])
  // 敲的这个谁都没有 → 给一条"创建"
  const canCreate = !!k && !existing.some((t) => t.text.toLowerCase() === k) && !suggested.some((t) => t.toLowerCase() === k)

  return (
    <>
      <Input
        className="pill-input"
        placeholder="搜索或输入新话题，回车添加"
        value={kw}
        maxLength={20}
        onChange={(e) => setKw(e.target.value)}
        onPressEnter={addTyped}
        style={{ marginBottom: 14 }}
      />

      {value.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>已选 {value.length}/{MAX_TAGS}（点一下取消）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {value.map((t) => <TagChip key={t} text={t} active onClick={() => toggle(t)} />)}
          </div>
        </div>
      )}

      {canCreate && (
        <div style={{ marginBottom: 16 }}>
          <span
            onClick={addTyped}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              padding: '5px 12px', borderRadius: 999, fontSize: 13,
              color: '#d4380d', background: '#fff7e6', border: '1px dashed #ffbb96',
            }}
          >
            创建「#{kw.trim().replace(/^#+/, '')}」
          </span>
        </div>
      )}

      {pool === null ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}><Spin /></div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            {topicId ? '本专题已有的话题' : '这里已有的话题'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {existing.length
              ? existing.map((t) => (
                <TagChip key={t.text} text={t.text} count={t.count} active={value.includes(t.text)} onClick={() => toggle(t.text)} />
              ))
              : <span style={{ fontSize: 13, color: '#ccc' }}>还没有人用过话题，你可以开第一个</span>}
          </div>
          {suggested.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>常用</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggested.map((t) => (
                  <TagChip key={t} text={t} active={value.includes(t)} onClick={() => toggle(t)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Button type="primary" onClick={onClose}>完成</Button>
      </div>
    </>
  )
}

/**
 * 发起投票的编辑弹窗。保存回 { subject, options[] }，取消/清空回 null。
 * 校验和后端一致：主题必填、2-10 个非空选项。
 */
export function PollEditModal({ open, onClose, value, onSave }) {
  return (
    <Modal open={open} onCancel={onClose} title="发起投票" footer={null} width={440} destroyOnClose>
      <PollEditBody value={value} onSave={onSave} onClose={onClose} />
    </Modal>
  )
}

function PollEditBody({ value, onSave, onClose }) {
  // 初值直接从当前值取（内容随弹窗卸载，所以每次打开都是重新初始化的一份）：
  // 改到一半关掉再打开，看到的是已保存的那份，不是半成品
  const [subject, setSubject] = useState(value?.subject || '')
  const [options, setOptions] = useState(value?.options?.length >= 2 ? [...value.options] : ['', ''])

  const save = () => {
    const s = subject.trim()
    const opts = options.map((o) => o.trim()).filter(Boolean)
    if (!s) return message.warning('填一下投票主题')
    if (opts.length < 2) return message.warning('至少两个选项')
    onSave({ subject: s, options: opts })
    return onClose()
  }

  return (
    <>
      <Input
        className="pill-input"
        placeholder="想投什么？"
        maxLength={30}
        showCount
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              className="pill-input"
              placeholder={`选项 ${i + 1}`}
              maxLength={20}
              value={opt}
              onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {options.length > 2 && (
              <Button type="text" danger onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))}>删</Button>
            )}
          </div>
        ))}
        {options.length < 10 && (
          <Button onClick={() => setOptions((arr) => [...arr, ''])} style={{ width: 120, borderRadius: 999 }}>+ 添加选项</Button>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#bbb', marginTop: 12 }}>2-10 个选项，单选、可改票</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        {value && <Button danger onClick={() => { onSave(null); onClose() }}>移除</Button>}
        <Button type="primary" onClick={save}>保存</Button>
      </div>
    </>
  )
}

/** 开启打分的编辑弹窗。保存回 { subject, imageUrl }，移除回 null。 */
export function RatingEditModal({ open, onClose, value, onSave, upload }) {
  return (
    <Modal open={open} onCancel={onClose} title="开启打分" footer={null} width={440} destroyOnClose>
      <RatingEditBody value={value} onSave={onSave} onClose={onClose} upload={upload} />
    </Modal>
  )
}

function RatingEditBody({ value, onSave, onClose, upload }) {
  const [subject, setSubject] = useState(value?.subject || '')
  const [img, setImg] = useState(value?.imageUrl || '')

  const save = () => {
    const s = subject.trim()
    if (!s) return message.warning('填一下要为什么打分')
    onSave({ subject: s, imageUrl: img })
    return onClose()
  }

  return (
    <>
      <Input
        className="pill-input"
        placeholder="想为什么打分？"
        maxLength={30}
        showCount
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <div style={{ marginTop: 16 }}>
        <RatingImagePicker value={img} onChange={setImg} upload={upload} />
      </div>
      <div style={{ fontSize: 12, color: '#bbb', marginTop: 12 }}>1-5 星，可配一张图；发帖后还能在评论区继续为别的对象开分</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        {value && <Button danger onClick={() => { onSave(null); onClose() }}>移除</Button>}
        <Button type="primary" onClick={save}>保存</Button>
      </div>
    </>
  )
}

/** 预览卡外壳：浅灰底 + 右上角一个叉。点卡片本身回到编辑弹窗 */
function PreviewShell({ children, onEdit, onRemove }) {
  return (
    <div
      onClick={onEdit}
      style={{
        position: 'relative', background: '#f7f8fa', borderRadius: 12,
        padding: '14px 16px', marginTop: 16, cursor: 'pointer',
      }}
    >
      <CloseCircleFilled
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={{ position: 'absolute', top: 10, right: 10, fontSize: 18, color: '#c8c8c8' }}
      />
      {children}
    </div>
  )
}

/** 正文下面那张投票卡（只是长得像，不能投——发出去之后才是真的） */
export function PollPreview({ value, onEdit, onRemove }) {
  return (
    <PreviewShell onEdit={onEdit} onRemove={onRemove}>
      <div style={{ fontSize: 15, fontWeight: 700, paddingRight: 24, wordBreak: 'break-word' }}>{value.subject}</div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>单选</div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {value.options.map((o, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
              border: '1px solid #eee', borderRadius: 10, padding: '11px 14px',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, wordBreak: 'break-word' }}>{o}</span>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #d9d9d9', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </PreviewShell>
  )
}

/** 正文下面那张打分卡 */
export function RatingPreview({ value, onEdit, onRemove }) {
  return (
    <PreviewShell onEdit={onEdit} onRemove={onRemove}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {value.imageUrl && (
          <img
            src={value.imageUrl}
            alt=""
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, paddingRight: 24, wordBreak: 'break-word' }}>{value.subject}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>1-5 星</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, color: '#e0e0e0', fontSize: 20 }}>
            {[0, 1, 2, 3, 4].map((i) => <StarFilled key={i} />)}
          </div>
        </div>
      </div>
    </PreviewShell>
  )
}
