import { useEffect, useRef, useState } from 'react'
import { EditableProTable } from '@ant-design/pro-components'
import { Button, Input, Pagination, Popconfirm, Space, Spin, Upload, message } from 'antd'
import { Link } from 'react-router-dom'
import { playerApi } from '../../api/player'

const PAGE_SIZE = 20
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-')
const isTemp = (id) => typeof id === 'string' && id.startsWith('new-')

/**
 * 球员名册管理（superManager）。替代 player-list.ftl + player-input.ftl。
 * 服务端分页（每页 20 人），当前页整页可编辑；「保存本页」只提交当前页的行。
 * "新增一行"只在前端本地追加（带 new- 临时 id），保存时清空 id 交后端补 UUID。
 * 写的是真实库——保存/删除立即生效。
 * 照片是例外：走独立的上传/移除接口即时落库（一人一张，重传即覆盖），
 * 不跟「保存本页」绑在一起。
 */
export default function PlayerManage() {
  const [rows, setRows] = useState([])
  const [editableKeys, setEditableKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchName, setSearchName] = useState() // 球员名模糊搜索
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [uploadingId, setUploadingId] = useState(null) // 正在传照片的球员
  const tmpSeq = useRef(0) // 递增计数器，保证本地新行的 rowKey 唯一

  const reload = async () => {
    setLoading(true)
    try {
      const res = await playerApi.listPlayers({ page, limit: PAGE_SIZE, playerName: searchName })
      const records = res.records || []
      setRows(records)
      setTotal(res.total || 0)
      setEditableKeys(records.map((r) => r.playerId)) // 当前页整页可编辑
    } finally {
      setLoading(false)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [searchName, page])

  const onSaveAll = async () => {
    // 只提交当前页；临时行清空 id，交给后端补 UUID
    const payload = rows.map((r) => (isTemp(r.playerId) ? { ...r, playerId: '' } : r))
    await playerApi.savePlayers(payload)
    message.success('本页已保存')
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

  // 照片：单独走上传接口，立即落库（不等「保存本页」），同时把新 URL 写回本地行——
  // 否则本页残留的旧行会在下一次保存时把 PHOTO 覆盖回空
  const onUploadPhoto = async (row, file) => {
    setUploadingId(row.playerId)
    try {
      const res = await playerApi.uploadPhoto(file, row.playerId)
      setRows((rs) => rs.map((r) => (r.playerId === row.playerId ? { ...r, photo: res?.url } : r)))
      message.success('照片已更新')
    } finally {
      setUploadingId(null)
    }
  }
  const onRemovePhoto = async (row) => {
    await playerApi.deletePhoto(row.playerId)
    setRows((rs) => rs.map((r) => (r.playerId === row.playerId ? { ...r, photo: null } : r)))
    message.success('照片已移除')
  }

  const columns = [
    { title: '球员', dataIndex: 'playerName', formItemProps: { rules: [{ required: true, message: '必填' }] } },
    { title: '号码', dataIndex: 'playerNumber' },
    {
      title: '照片', dataIndex: 'photo', width: 190, editable: false,
      render: (_, row) => (
        <Space size={8}>
          {row.photo ? (
            <img
              src={row.photo}
              alt=""
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', background: '#f5f5f5' }}
            />
          ) : (
            <span
              style={{
                width: 36, height: 36, borderRadius: '50%', background: '#f5f5f5', color: '#ccc',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}
            >
              🏀
            </span>
          )}
          {isTemp(row.playerId) ? (
            <span style={{ color: '#bbb' }}>先保存</span> // 还没有 id，传上去没处挂
          ) : uploadingId === row.playerId ? (
            <Spin size="small" />
          ) : (
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => { onUploadPhoto(row, file); return false }} // 自己发请求，不用 antd 的默认上传
            >
              <a>{row.photo ? '更换' : '上传'}</a>
            </Upload>
          )}
          {row.photo && !isTemp(row.playerId) && (
            <Popconfirm key="rm" title="移除该球员照片？" onConfirm={() => onRemovePhoto(row)}>
              <a style={{ color: '#ff4d4f' }}>移除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
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
    <>
      <EditableProTable
        rowKey="playerId"
        headerTitle="球员管理"
        loading={loading}
        value={rows}
        onChange={setRows}
        recordCreatorProps={false}
        editable={{ type: 'multiple', editableKeys, onChange: setEditableKeys, actionRender: () => [] }}
        columns={columns}
        scroll={{ x: 890 }}
        toolBarRender={() => [
          <Input.Search
            key="search"
            allowClear
            placeholder="搜索球员名"
            style={{ width: 200 }}
            onSearch={(v) => { setPage(1); setSearchName(v.trim() || undefined) }}
          />,
          <Button key="add" onClick={onAddRow}>新增一行</Button>,
          <Button key="save" type="primary" onClick={onSaveAll}>保存本页</Button>,
        ]}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 4px' }}>
        <Pagination
          current={page}
          pageSize={PAGE_SIZE}
          total={total}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 名球员`}
          onChange={setPage}
        />
      </div>
    </>
  )
}
