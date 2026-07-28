import { useEffect, useState } from 'react'
import { Alert, Checkbox, Modal } from 'antd'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'
import DayRangePicker from './DayRangePicker'

/**
 * 导出群聊备份（题主/管理者）。
 *
 * 日期是**闭区间**：选 7-21 ~ 7-28，导出的是 7-21 00:00 到 **7-29 00:00 之前**的全部消息，
 * 也就是把 7-28 那一整天算进去——包含你点下载那一刻为止的最新消息。
 * 这是最容易写错的地方：写成 `<= 结束日` 会把结束日整天漏掉。
 *
 * 下载走浏览器直连（不经 axios）：要的是把文件存下来，不是拿到响应体。
 */
export default function ChatExportModal({ topicId, open, onClose }) {
  const [range, setRange] = useState(null)
  const [all, setAll] = useState(true)

  useEffect(() => {
    if (!open) { setRange(null); setAll(true) }
  }, [open])

  const ok = () => {
    const [from, to] = all || !range ? [null, null] : [range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')]
    window.open(chatApi.exportUrl(topicId, from, to), '_blank')
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={ok}
      okText="下载"
      cancelText="取消"
      okButtonProps={{ disabled: !all && !range }}
      title="导出群聊备份"
      width={440}
      destroyOnClose
    >
      <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 12 }}>
        打包成 zip：<code>messages.json</code>（结构化）、<code>chat.txt</code>（可读流水）、
        <code>files/</code>（图片和附件原件）。
      </div>
      <Checkbox checked={all} onChange={(e) => setAll(e.target.checked)}>导出全部记录</Checkbox>
      <div style={{ marginTop: 12 }}>
        <DayRangePicker
          value={range}
          onChange={(v) => { setRange(v); if (v) setAll(false) }}
          disabled={all}
          disabledDate={(d) => d && d > dayjs().endOf('day')}
        />
      </div>
      {!all && range && (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          message={`导出 ${range[0].format('M 月 D 日')} 到 ${range[1].format('M 月 D 日')}，含 ${range[1].format('M 月 D 日')} 当天到此刻的全部消息`}
        />
      )}
    </Modal>
  )
}
