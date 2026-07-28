import { useEffect, useState } from 'react'
import { Button, Empty, Input, Modal, Popconfirm, Space, message } from 'antd'
import { DeleteOutlined, DownOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons'
import { topicApi } from '../api/topic'

/**
 * 专题类别管理（超管）：百家说首页那排筛选按钮就是这份列表。
 *
 * 每一行独立保存——改名、删除、换顺序各自一个请求，接口每次回最新全量列表，
 * 拿它直接覆盖本地状态，省掉"改完再拉一次"。专题存的是类别 id，所以改名不会
 * 让已归类的专题掉出去。
 */
export default function CategoryManageModal({ open, onClose, onChanged }) {
  const [rows, setRows] = useState([])
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    topicApi.categoryList().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [open])

  // 每个动作都用接口回来的全量列表覆盖，并通知外面刷新专题列表（类别名/顺序变了要跟着变）
  const apply = async (fn) => {
    setBusy(true)
    try {
      const next = await fn()
      if (Array.isArray(next)) setRows(next)
      onChanged?.()
    } catch { /* 拦截器已提示 */ } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const name = adding.trim()
    if (!name) return
    apply(async () => {
      const next = await topicApi.saveCategory({ name, sort: rows.length })
      message.success('已添加')
      setAdding('')
      return next
    })
  }

  const rename = (row, name) => {
    const n = name.trim()
    if (!n || n === row.name) return
    apply(() => topicApi.saveCategory({ categoryId: row.categoryId, name: n }))
  }

  // 上/下移：只把相邻两行的 sort 对调，两个请求
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    apply(async () => {
      await topicApi.saveCategory({ categoryId: rows[i].categoryId, name: rows[i].name, sort: j })
      return topicApi.saveCategory({ categoryId: rows[j].categoryId, name: rows[j].name, sort: i })
    })
  }

  return (
    <Modal open={open} onCancel={onClose} onOk={onClose} okText="完成" cancelButtonProps={{ style: { display: 'none' } }} title="管理专题类别" width={460} destroyOnClose>
      <div style={{ fontSize: 12, color: '#999', margin: '4px 0 14px' }}>
        百家说首页按这份列表筛专题。删掉一个类别，原来挂在它下面的专题会退回「未分类」，专题本身不受影响。
      </div>

      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.categoryId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Input
                defaultValue={r.name}
                maxLength={12}
                disabled={busy}
                onBlur={(e) => rename(r, e.target.value)}
                onPressEnter={(e) => e.target.blur()}
              />
              <Button size="small" type="text" icon={<UpOutlined />} disabled={busy || i === 0} onClick={() => move(i, -1)} />
              <Button size="small" type="text" icon={<DownOutlined />} disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)} />
              <Popconfirm title={`删除「${r.name}」？`} description="该类别下的专题会退回未分类" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => apply(() => topicApi.deleteCategory(r.categoryId))}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={busy} />
              </Popconfirm>
            </div>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有类别" />
      )}

      <Space.Compact style={{ width: '100%', marginTop: 14 }}>
        <Input
          placeholder="新类别名称，如：学习、游戏、生活"
          maxLength={12}
          value={adding}
          disabled={busy}
          onChange={(e) => setAdding(e.target.value)}
          onPressEnter={add}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={add} disabled={busy || !adding.trim()}>添加</Button>
      </Space.Compact>
    </Modal>
  )
}
