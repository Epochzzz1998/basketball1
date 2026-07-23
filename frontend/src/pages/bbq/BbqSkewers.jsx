import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Empty, Input, InputNumber, Modal, Popconfirm, Spin, message } from 'antd'
import { DeleteOutlined, EditOutlined, FireOutlined, PlusOutlined } from '@ant-design/icons'
import { bbqApi } from '../../api/bbq'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 耿阿姨烤串 · 串价设置（店长专属）。每种串一个单价（$澳币/串），
 * 薪资计算里的穿串工资按这里的价目下拉选择。改价只影响以后的记录——
 * 历史工资记录存的是录入当时的价格快照。
 */

const AMBER = '#d48806'

export default function BbqSkewers() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null=新增；{typeId,name,unitPrice}=编辑
  const [name, setName] = useState('')
  const [price, setPrice] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    bbqApi.skewerList().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]))
  }, [])
  useEffect(() => { load() }, [load])

  const openEdit = (r) => {
    setEditing(r || null)
    setName(r ? r.name : '')
    setPrice(r ? Number(r.unitPrice) : null)
    setEditOpen(true)
  }

  const doSave = async () => {
    const n = name.trim()
    if (!n) return message.info('先给串起个名字')
    if (!(price > 0)) return message.info('单价要大于 0')
    setSaving(true)
    try {
      await bbqApi.skewerSave({ typeId: editing?.typeId, name: n, price: Number(price).toFixed(2) })
      message.success(editing ? '已保存（改价只影响以后的记录）' : '已添加')
      setEditOpen(false)
      load()
    } catch { /* 已提示 */ } finally { setSaving(false) }
  }

  const doDelete = async (r) => {
    try { await bbqApi.skewerDelete(r.typeId); message.success('已删除'); load() } catch { /* 已提示 */ }
  }

  const ring = (size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.16)', ...pos })

  return (
    <>
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '22px 28px', marginBottom: 16,
          background: 'linear-gradient(120deg, #613400 0%, #ad6800 55%, #d48806 100%)',
        }}
      >
        <div style={ring(170, { top: -70, right: 100 })} />
        <div style={ring(110, { bottom: -45, right: 260 })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
              <FireOutlined style={{ marginRight: 8 }} />耿阿姨烤串 · 串价设置
            </div>
            <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
              每种串一个单价（$/串），薪资计算里按串数算穿串工资。改价只影响以后的记录。
            </div>
          </div>
          <Button icon={<PlusOutlined />} onClick={() => openEdit(null)} style={{ fontWeight: 600 }}>添加串</Button>
        </div>
      </div>

      <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? '10px 12px' : '14px 18px' } }}>
        {rows === null ? (
          <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
        ) : rows.length === 0 ? (
          <Empty description="还没有串，点右上角「添加串」建立价目表" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => (
              <div
                key={r.typeId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 6px',
                  borderTop: i === 0 ? 'none' : '1px solid #f5f5f5',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: AMBER, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontWeight: 650, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontWeight: 700, color: AMBER, fontSize: 15, flexShrink: 0 }}>${Number(r.unitPrice).toFixed(2)}<span style={{ color: '#bbb', fontWeight: 400, fontSize: 12 }}> /串</span></span>
                <span style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 6 }}>
                  <EditOutlined style={{ color: '#999', cursor: 'pointer' }} onClick={() => openEdit(r)} />
                  <Popconfirm title={`删除「${r.name}」？`} description="历史工资记录存的是快照，不受影响" onConfirm={() => doDelete(r)} okText="删除" cancelText="取消">
                    <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} />
                  </Popconfirm>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title={editing ? '编辑串' : '添加串'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={doSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>串名</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：羊肉串" maxLength={20} onPressEnter={doSave} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>单价（$/串）</div>
            <InputNumber
              value={price}
              onChange={setPrice}
              min={0.01}
              max={999.99}
              step={0.05}
              precision={2}
              prefix="$"
              style={{ width: 180 }}
            />
          </div>
          {editing && <div style={{ fontSize: 12, color: '#d9a05f' }}>改价只影响以后的记录，历史记录按录入当时的价格算。</div>}
        </div>
      </Modal>
    </>
  )
}
