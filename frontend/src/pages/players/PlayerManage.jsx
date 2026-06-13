import { useEffect, useState } from 'react'
import { EditableProTable } from '@ant-design/pro-components'
import { Button, Popconfirm, message } from 'antd'
import { Link } from 'react-router-dom'
import { playerApi } from '../../api/player'

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-')

/**
 * 球员名册管理（superManager）。替代 player-list.ftl + player-input.ftl。
 * 用 EditableProTable：所有行常驻可编辑（type:'multiple'），改完点"保存全部"整表提交。
 * 写的是真实库——保存/删除立即生效。
 */
export default function PlayerManage() {
  const [rows, setRows] = useState([])
  const [editableKeys, setEditableKeys] = useState([])
  const [loading, setLoading] = useState(false)

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
    await playerApi.savePlayers(rows)
    message.success('已保存')
    reload()
  }
  // 后端 insertAndSavePlayer = 保存当前 + 追加一个带 UUID 的空行
  const onAddRow = async () => {
    await playerApi.insertAndSavePlayers(rows)
    message.success('已保存并新增一行，可继续编辑')
    reload()
  }
  const onDelete = async (playerId) => {
    await playerApi.deletePlayer(playerId)
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
        <Link key="stats" to={`/admin/players/${row.playerId}/stats`}>生涯数据</Link>,
        <Popconfirm key="del" title="删除该球员及其所有赛季数据？" onConfirm={() => onDelete(row.playerId)}>
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
        <Button key="add" onClick={onAddRow}>保存并新增一行</Button>,
        <Button key="save" type="primary" onClick={onSaveAll}>保存全部</Button>,
      ]}
    />
  )
}
