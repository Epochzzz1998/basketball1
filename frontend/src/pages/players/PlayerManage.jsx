import { useEffect, useRef, useState } from 'react'
import { EditableProTable } from '@ant-design/pro-components'
import { Button, Popconfirm, message } from 'antd'
import { Link } from 'react-router-dom'
import { playerApi } from '../../api/player'

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-')
const isTemp = (id) => typeof id === 'string' && id.startsWith('new-')

/**
 * 球员名册管理（superManager）。替代 player-list.ftl + player-input.ftl。
 * "新增一行"只在前端本地追加（带 new- 临时 id），点"保存全部"才入库
 * （后端 savePlayer 对空 id 补 UUID）。写的是真实库——保存/删除立即生效。
 */
export default function PlayerManage() {
  const [rows, setRows] = useState([])
  const [editableKeys, setEditableKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const tmpSeq = useRef(0) // 递增计数器，保证本地新行的 rowKey 唯一

  const reload = async () => {
    setLoading(true)
    try {
      const res = await playerApi.listPlayers({ page: 1, limit: 1000 })
      const records = res.records || []
      setRows(records)
      setEditableKeys(records.map((r) => r.playerId)) // 让每一行都处于可编辑状态
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [])

  const onSaveAll = async () => {
    // 临时行清空 id，交给后端补 UUID
    const payload = rows.map((r) => (isTemp(r.playerId) ? { ...r, playerId: '' } : r))
    await playerApi.savePlayers(payload)
    message.success('已保存')
    reload()
  }
  // 本地新增一行：不落库，给个 new- 临时 id 占 rowKey
  const onAddRow = () => {
    const tmpId = `new-${tmpSeq.current++}`
    setRows([...rows, { playerId: tmpId }])
    setEditableKeys([...editableKeys, tmpId])
  }
  const onDelete = async (row) => {
    if (isTemp(row.playerId)) { // 还没入库，本地删掉即可
      setRows(rows.filter((r) => r.playerId !== row.playerId))
      setEditableKeys(editableKeys.filter((k) => k !== row.playerId))
      return
    }
    await playerApi.deletePlayer(row.playerId)
    message.success('已删除')
    reload()
  }

  const columns = [
    { title: '球员', dataIndex: 'playerName', formItemProps: { rules: [{ required: true, message: '必填' }] } },
    { title: '号码', dataIndex: 'playerNumber' },
    { title: '生日', dataIndex: 'playerBirthday', editable: false, render: (_, r) => fmtDate(r.playerBirthday) },
    {
      title: '操作', valueType: 'option', width: 170, editable: false,
      render: (_, row) => [
        isTemp(row.playerId)
          ? <span key="stats" style={{ color: '#bbb' }}>生涯数据</span> // 先保存才有 id
          : <Link key="stats" to={`/admin/players/${row.playerId}/stats`}>生涯数据</Link>,
        <Popconfirm
          key="del"
          title={isTemp(row.playerId) ? '移除这一未保存行？' : '删除该球员及其所有赛季数据？'}
          onConfirm={() => onDelete(row)}
        >
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <EditableProTable
      rowKey="playerId"
      headerTitle="球员管理"
      loading={loading}
      value={rows}
      onChange={setRows}
      recordCreatorProps={false}
      editable={{ type: 'multiple', editableKeys, onChange: setEditableKeys, actionRender: () => [] }}
      columns={columns}
      scroll={{ x: 700 }}
      toolBarRender={() => [
        <Button key="add" onClick={onAddRow}>新增一行</Button>,
        <Button key="save" type="primary" onClick={onSaveAll}>保存全部</Button>,
      ]}
    />
  )
}
