import { useEffect, useState } from 'react'
import { Alert, DatePicker, Modal, Spin, message } from 'antd'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'

/**
 * 按日期清理群聊记录（题主/管理者）。
 *
 * 选一个日期，把这天 00:00 之前的消息全部删掉，**图片和附件一起删** ——
 * 只删数据库行的话磁盘并没有腾出来，那这个功能就白做了。
 *
 * 删除不可逆，所以先调预览接口把「要删多少条、其中多少个文件」摆出来再让人确认。
 */
export default function ChatPurgeModal({ topicId, open, onClose, onDone }) {
  const [date, setDate] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) { setDate(null); setPreview(null) }
  }, [open])

  useEffect(() => {
    if (!open || !date) { setPreview(null); return }
    let alive = true
    setLoading(true)
    chatApi.purgePreview(topicId, date.format('YYYY-MM-DD'))
      .then((r) => { if (alive) setPreview(r) })
      .catch(() => { if (alive) setPreview(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, date, topicId])

  const submit = async () => {
    if (!date || !preview?.count) return
    setBusy(true)
    try {
      const r = await chatApi.purge(topicId, date.format('YYYY-MM-DD'))
      message.success(`已清理 ${r?.messages ?? 0} 条消息、${r?.files ?? 0} 个文件`)
      onDone?.()
      onClose()
    } catch { /* 拦截器已提示 */ } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="确认清理"
      cancelText="取消"
      okButtonProps={{ danger: true, disabled: !preview?.count }}
      confirmLoading={busy}
      title="清理群聊记录"
      width={440}
      destroyOnClose
    >
      <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 12 }}>
        选一个日期，把这天 <b>00:00 之前</b>的消息全部删除，消息里的图片和附件也会一并删掉。
        建议先「导出备份」再清理。
      </div>
      <DatePicker
        value={date}
        onChange={setDate}
        placeholder="选择日期"
        style={{ width: '100%' }}
        disabledDate={(d) => d && d > dayjs().endOf('day')}
      />
      {loading && <Spin size="small" style={{ marginTop: 12 }} />}
      {!loading && preview && (
        <Alert
          style={{ marginTop: 12 }}
          type={preview.count ? 'warning' : 'info'}
          message={preview.count
            ? `将删除 ${preview.count} 条消息，其中 ${preview.files} 条带图片或附件`
            : '这个日期之前没有消息'}
        />
      )}
      {preview?.count > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#cf1322' }}>删除不可恢复。</div>
      )}
    </Modal>
  )
}
