import { useMemo, useRef, useState } from 'react'
import { Button, Image, Input, Space, Tag, Tooltip, Upload, message } from 'antd'
import { CloseCircleFilled, FileOutlined, PictureOutlined } from '@ant-design/icons'
import EmojiPicker from './EmojiPicker'
import { newsApi } from '../api/news'
import { followApi } from '../api/follow'
import { useAuth } from '../auth/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 评论/回复输入器：文本框 + 工具栏（表情/图片/文件）+ 附件预览 + 提交。
 * @ 联想：只联想**关注我的人**（粉丝），选中插入其真实昵称并记录 mention id；
 * 手打的 @昵称 依旧由后端按全站昵称识别兜底。
 * 自持 text/attachments 状态；提交给 onSubmit(async→boolean)，返回 true（成功）则清空。
 */

const IMG_ACCEPT = 'image/*'
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,.7z'
const MAX_ATTACH = 9

export const humanSize = (n) => {
  if (n == null) return ''
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

export default function CommentComposer({ newsId, placeholder, submitText = '发表评论', onSubmit, onCancel, compact }) {
  const isMobile = useIsMobile()
  const { user, dn } = useAuth()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [followers, setFollowers] = useState(null) // 我的粉丝（懒加载，@ 联想数据源）
  const [mentions, setMentions] = useState([]) // 从联想里选中过的 {id, name}
  const [sug, setSug] = useState(null) // 正在输入的 @ 片段：{ query, start }
  const wrapRef = useRef()

  const loadFollowers = () => {
    if (followers !== null || !user) return
    followApi.list(user.userId, 'followers')
      .then((r) => setFollowers(Array.isArray(r) ? r : []))
      .catch(() => setFollowers([]))
  }

  // 光标前若是未完成的 "@xx" 片段则开启联想
  const refreshSug = (val, caret) => {
    if (!user) return
    const m = /@([^\s@]{0,20})$/.exec(val.slice(0, caret ?? val.length))
    if (m) {
      setSug({ query: m[1], start: (caret ?? val.length) - m[1].length - 1 })
      loadFollowers()
    } else {
      setSug(null)
    }
  }

  const sugList = useMemo(() => {
    if (!sug || !followers) return []
    const q = sug.query.toLowerCase()
    return followers
      .map((f) => ({ id: f.userId, name: f.userNickname || '' }))
      .filter((f) => f.name && (!q || f.name.toLowerCase().includes(q) || (dn(f.id, f.name) || '').toLowerCase().includes(q)))
      .slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sug, followers])

  const pickMention = (f) => {
    const before = text.slice(0, sug.start)
    const after = text.slice(sug.start + 1 + sug.query.length)
    const inserted = `@${f.name} `
    setText(before + inserted + after)
    setSug(null)
    setMentions((m) => (m.some((x) => x.id === f.id) ? m : [...m, { id: f.id, name: f.name }]))
    const ta = wrapRef.current?.querySelector('textarea')
    requestAnimationFrame(() => { ta?.focus(); const pos = before.length + inserted.length; ta?.setSelectionRange(pos, pos) })
  }

  // 在光标处插入 emoji（拿底层 textarea 的选区拼接，再恢复光标）
  const insertEmoji = (emoji) => {
    const ta = wrapRef.current?.querySelector('textarea')
    if (!ta) { setText((t) => t + emoji); return }
    const s = ta.selectionStart ?? text.length
    const e = ta.selectionEnd ?? text.length
    setText(text.slice(0, s) + emoji + text.slice(e))
    requestAnimationFrame(() => { ta.focus(); const p = s + emoji.length; ta.setSelectionRange(p, p) })
  }

  const doUpload = async ({ file, onSuccess, onError }) => {
    if (attachments.length >= MAX_ATTACH) { message.warning(`最多 ${MAX_ATTACH} 个附件`); onError?.(new Error('max')); return }
    setUploading(true)
    try {
      const url = await newsApi.uploadCommentFile(file, newsId)
      if (url) {
        const isImage = (file.type || '').startsWith('image/')
        setAttachments((a) => [...a, { type: isImage ? 'image' : 'file', url, name: file.name, size: file.size }])
        onSuccess?.()
      } else {
        onError?.(new Error('上传失败'))
      }
    } catch (err) {
      onError?.(err) // 具体错误已由 http 拦截器弹出
    } finally {
      setUploading(false)
    }
  }

  const removeAt = (i) => setAttachments((a) => a.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (busy || (!text.trim() && !attachments.length)) return
    setBusy(true)
    try {
      // 只提交仍留在正文里的 @（删掉的就不算）
      const live = mentions.filter((m) => text.includes(`@${m.name}`))
      const ok = await onSubmit({ text: text.trim(), mentions: live, attachments })
      if (ok) { setText(''); setAttachments([]); setMentions([]); setSug(null) }
    } finally {
      setBusy(false)
    }
  }

  const toolIcon = { fontSize: 18, color: '#8c8c8c', cursor: 'pointer' }

  return (
    <div ref={wrapRef}>
      <Input.TextArea
        value={text}
        onChange={(e) => { setText(e.target.value); refreshSug(e.target.value, e.target.selectionStart) }}
        onBlur={() => setTimeout(() => setSug(null), 150)}
        placeholder={placeholder}
        autoSize={{ minRows: compact ? 2 : 2, maxRows: 6 }}
        maxLength={500}
      />

      {/* @ 联想（仅关注我的人）；onMouseDown 抢在 blur 前完成插入 */}
      {sugList.length > 0 && (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, marginTop: 4, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,.08)', overflow: 'hidden' }}>
          {sugList.map((f) => {
            const remark = dn(f.id, f.name)
            return (
              <div
                key={f.id}
                onMouseDown={(e) => { e.preventDefault(); pickMention(f) }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fff7f0' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
              >
                <span style={{ fontWeight: 600 }}>@{f.name}</span>
                {remark !== f.name && <Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>{remark}</Tag>}
              </div>
            )
          })}
        </div>
      )}

      {/* 附件预览：图片缩略图 / 文件卡，各带右上角移除 */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {attachments.map((att, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {att.type === 'image' ? (
                <Image src={att.url} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#f5f5f5', borderRadius: 8, maxWidth: 200, height: 72, boxSizing: 'border-box' }}>
                  <FileOutlined style={{ color: '#fa541c', fontSize: 18 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{humanSize(att.size)}</div>
                  </div>
                </div>
              )}
              <CloseCircleFilled
                onClick={() => removeAt(i)}
                style={{ position: 'absolute', top: -6, right: -6, color: '#8c8c8c', background: '#fff', borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 工具栏 + 提交 */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, flexWrap: isMobile ? 'wrap' : 'nowrap', rowGap: isMobile ? 8 : 0 }}>
        <Space size={16} align="center">
          <EmojiPicker onPick={insertEmoji} />
          <Upload accept={IMG_ACCEPT} multiple showUploadList={false} customRequest={doUpload}>
            <Tooltip title="图片"><PictureOutlined style={toolIcon} /></Tooltip>
          </Upload>
          <Upload accept={FILE_ACCEPT} multiple showUploadList={false} customRequest={doUpload}>
            <Tooltip title="文件"><FileOutlined style={toolIcon} /></Tooltip>
          </Upload>
          {uploading && <span style={{ fontSize: 12, color: '#999' }}>上传中…</span>}
        </Space>
        <span style={{ flex: 1 }} />
        {onCancel && <Button size="small" style={{ marginRight: 8 }} onClick={onCancel}>取消</Button>}
        <Button
          type="primary"
          size={compact ? 'small' : 'middle'}
          loading={busy}
          onClick={submit}
          disabled={!text.trim() && !attachments.length}
        >
          {submitText}
        </Button>
      </div>
    </div>
  )
}
