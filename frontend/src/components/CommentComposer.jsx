import { useRef, useState } from 'react'
import { Button, Image, Space, Tooltip, Upload, message } from 'antd'
import { CloseCircleFilled, FileOutlined, PictureOutlined } from '@ant-design/icons'
import MentionInput from './MentionInput'
import EmojiPicker from './EmojiPicker'
import { newsApi } from '../api/news'
import useIsMobile from '../hooks/useIsMobile'

/**
 * 评论/回复输入器：文本框（@ 提及）+ 工具栏（表情/图片/文件）+ 附件预览 + 提交。
 * 自持 text/mentions/attachments 状态；提交时把三者一起交给 onSubmit(async→boolean)，
 * 返回 true（成功）则清空。顶层评论框与楼中楼回复框共用这一个组件。
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
  const [text, setText] = useState('')
  const [mentions, setMentions] = useState([])
  const [attachments, setAttachments] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const wrapRef = useRef()

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
      const ok = await onSubmit({ text: text.trim(), mentions, attachments })
      if (ok) { setText(''); setMentions([]); setAttachments([]) }
    } finally {
      setBusy(false)
    }
  }

  const toolIcon = { fontSize: 18, color: '#8c8c8c', cursor: 'pointer' }

  return (
    <div ref={wrapRef}>
      <MentionInput
        value={text}
        onChange={(t, m) => { setText(t); setMentions(m) }}
        placeholder={placeholder}
        autoSize={{ minRows: compact ? 2 : 2, maxRows: 6 }}
      />

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
