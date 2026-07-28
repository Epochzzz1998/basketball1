import { useEffect, useState } from 'react'
import { Alert, Modal, Spin, message } from 'antd'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import DayRangePicker from './DayRangePicker'

/**
 * 按日期清理群聊记录（题主/管理者）。
 *
 * 日期是**闭区间**，和导出同一套语义：选 7-21 ~ 7-28，删的是 7-21 00:00 到
 * 7-29 00:00 之前的消息，也就是把 7-28 那一整天算进去。
 *
 * 消息里的图片和附件一起删——只删数据库行的话磁盘并没有腾出来，这功能就白做了。
 * 删除不可逆，所以先调预览接口把「要删多少条、其中多少个文件」摆出来再让人确认。
 */
export default function ChatPurgeModal({ topicId, open, onClose, onDone }) {
  const [range, setRange] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) { setRange(null); setPreview(null) }
  }, [open])

  useEffect(() => {
    if (!open || !range) { setPreview(null); return }
    let alive = true
    setLoading(true)
    chatApi.purgePreview(topicId, range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'))
      .then((r) => { if (alive) setPreview(r) })
      .catch(() => { if (alive) setPreview(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, range, topicId])

  const submit = async () => {
    if (!range || !preview?.count) return
    setBusy(true)
    try {
      const r = await chatApi.purge(topicId, range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'))
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
      width={460}
      destroyOnClose
    >
      <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 12 }}>
        选一段日期，把这段时间里的消息删除（**含结束日当天**），消息里的图片和附件也会一并删掉。
        建议先「导出备份」再清理。
      </div>
      <DayRangePicker
        value={range}
        onChange={setRange}
        disabledDate={(d) => d && d > dayjs().endOf('day')}
      />
      {loading && <Spin size="small" style={{ marginTop: 12 }} />}
      {!loading && preview && (
        <Alert
          style={{ marginTop: 12 }}
          type={preview.count ? 'warning' : 'info'}
          message={preview.count
            ? `将删除 ${preview.count} 条消息，其中 ${preview.files} 条带图片或附件`
            : '这段时间里没有消息'}
        />
      )}
      {preview?.count > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#cf1322' }}>删除不可恢复。</div>
      )}
    </Modal>
  )
}
