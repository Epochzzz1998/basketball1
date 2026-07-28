import { useEffect, useState } from 'react'
import { Empty, Modal, Spin, Table } from 'antd'
import dayjs from 'dayjs'
import { chatApi } from '../api/chat'

/**
 * 各专题群聊的存储占用（仅超管）。
 *
 * 分两部分算：正文字节直接从库里 sum（LENGTH 是字节不是字符，中文一个字三字节），
 * 附件字节只能拿着 URL 去磁盘上逐个 stat——库里存的只有路径，没有大小。
 */
const human = (n) => {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  return `${(v / 1024 / 1024).toFixed(2)} MB`
}

const day = (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '—')

export default function ChatUsageModal({ open, onClose }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!open) return
    setRows(null)
    chatApi.usage().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [open])

  const total = (rows || []).reduce((s, r) => s + (Number(r.totalBytes) || 0), 0)

  const columns = [
    { title: '专题', dataIndex: 'topicName', render: (v, r) => v || r.topicId },
    { title: '消息', dataIndex: 'msgs', width: 70, align: 'right' },
    { title: '正文', dataIndex: 'textBytes', width: 90, align: 'right', render: human },
    { title: '附件', dataIndex: 'fileBytes', width: 100, align: 'right', render: (v, r) => `${human(v)}${r.files ? ` (${r.files})` : ''}` },
    { title: '合计', dataIndex: 'totalBytes', width: 90, align: 'right', render: (v) => <b>{human(v)}</b> },
    { title: '时间跨度', width: 190, render: (_, r) => `${day(r.firstAt)} ~ ${day(r.lastAt)}` },
  ]

  return (
    <Modal open={open} onCancel={onClose} onOk={onClose} okText="关闭" cancelButtonProps={{ style: { display: 'none' } }} title="群聊存储占用" width={720} destroyOnClose>
      {rows === null ? (
        <Spin style={{ display: 'block', margin: '40px auto' }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有任何群聊消息" />
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 10 }}>
            全站群聊合计 <b>{human(total)}</b>。清理由各专题的题主在群聊页里按日期操作，系统不做自动清理。
          </div>
          <Table
            className="clean-table"
            rowKey="topicId"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 660 }}
          />
        </>
      )}
    </Modal>
  )
}
