import { useEffect, useState } from 'react'
import { Alert, Input, Modal, Segmented, Switch, message } from 'antd'
import { announceApi } from '../api/announce'

/**
 * 编辑全站公告（超管）。
 *
 * 保存之后所有人（含之前把它叉掉的人）都会重新看到——因为版本号是修改时间，
 * 一保存就变了。这一点在弹窗里明说，免得以为改个错别字不会打扰别人。
 */
const LEVELS = [
  { label: '普通', value: 'info' },
  { label: '提醒', value: 'warning' },
  { label: '紧急', value: 'error' },
]

export default function AnnouncementEditModal({ open, onClose }) {
  const [content, setContent] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [level, setLevel] = useState('info')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    announceApi.get()
      .then((r) => {
        setContent(r?.content || '')
        setEnabled(!!r?.enabled)
        setLevel(r?.level || 'info')
      })
      .catch(() => {})
  }, [open])

  const submit = async () => {
    setSaving(true)
    try {
      await announceApi.save({ content, enabled: enabled ? '1' : '0', level })
      message.success(enabled ? '公告已发布' : '公告已关闭')
      onClose()
    } catch { /* 拦截器已提示 */ } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      title="全站公告"
      width={480}
      destroyOnClose
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Switch checked={enabled} onChange={setEnabled} checkedChildren="展示中" unCheckedChildren="已关闭" />
        <Segmented size="small" options={LEVELS} value={level} onChange={setLevel} />
      </div>
      <Input.TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写一句要滚动播放的提醒，比如：本周日 20:00 服务器维护，届时站点会短暂无法访问"
        maxLength={500}
        showCount
        autoSize={{ minRows: 3, maxRows: 6 }}
      />
      <Alert
        style={{ marginTop: 12 }}
        type="info"
        message={level === 'error'
          ? '紧急公告叉掉只是暂时收起，刷新或下次进站还会出现——维护、故障这类通知不该被一键永久静音。'
          : '保存后，之前把公告叉掉的人也会重新看到——关闭状态是按版本记的，内容一改就是新的一版。'}
      />
    </Modal>
  )
}
