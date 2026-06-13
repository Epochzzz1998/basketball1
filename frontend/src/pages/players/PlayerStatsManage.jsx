import { useEffect, useState } from 'react'
import { EditableProTable } from '@ant-design/pro-components'
import { Button, message } from 'antd'
import { useParams, Link } from 'react-router-dom'
import { playerApi } from '../../api/player'

// [字段, 列名, 类型]：数字用 digit(InputNumber)，文本用 text
const STAT_FIELDS = [
  ['season', '赛季', 'digit'], ['seasonNum', '序号', 'digit'],
  ['playerTeam', '球队', 'text'], ['playerPosition', '位置', 'text'],
  ['playerAppearance', '出场', 'digit'], ['playerFrAppearance', '先发', 'digit'], ['playerSrAppearance', '替补', 'digit'],
  ['playingTime', '时间', 'digit'], ['playerAvgScore', '得分', 'digit'], ['playerAvgReb', '篮板', 'digit'], ['playerAvgAss', '助攻', 'digit'],
  ['playerAccuracy', '命中率', 'digit'], ['playerThreeAccuracy', '三分%', 'digit'], ['playerFreethrowAccuracy', '罚球%', 'digit'],
  ['playerAvgBlock', '盖帽', 'digit'], ['playerAvgSteal', '抢断', 'digit'], ['playerAvgTurnover', '失误', 'digit'],
  ['playerPer', 'PER', 'digit'], ['playerPie', 'PIE', 'digit'], ['playerWs', 'WS', 'digit'],
  ['playerOffEff', '进攻效率', 'digit'], ['playerDefEff', '防守效率', 'digit'], ['playerNetEff', '净效率', 'digit'], ['playerAvgPn', '正负值', 'digit'],
  ['mvpRank', 'MVP', 'digit'], ['dpoyRank', 'DPOY', 'digit'],
  ['allDbaTeam', '最佳阵容', 'text'], ['allDefTeam', '最佳防守', 'text'],
]

/**
 * 某球员生涯逐季数据管理（superManager）。替代 player-stats-manager-list.ftl。
 * "保存全部"调 savePlayerStats → 后端会按各赛季行重算生涯汇总行(seasonNum=50)。
 */
export default function PlayerStatsManage() {
  const { playerId } = useParams()
  const [rows, setRows] = useState([])
  const [editableKeys, setEditableKeys] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const res = await playerApi.listPlayerCareer({ playerId, page: 1, limit: 1000 })
      const records = res.records || []
      setRows(records)
      setEditableKeys(records.map((r) => r.statsId))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [playerId])

  const onSaveAll = async () => {
    await playerApi.savePlayerStats(rows, playerId)
    message.success('已保存，生涯汇总已重算')
    reload()
  }
  const onAddRow = async () => {
    await playerApi.insertAndSavePlayerStats(rows, playerId)
    message.success('已保存并新增一行赛季')
    reload()
  }

  const columns = STAT_FIELDS.map(([dataIndex, title, valueType]) => ({ title, dataIndex, valueType, width: 92 }))

  return (
    <>
      <Link to="/admin/players"><Button style={{ marginBottom: 12 }}>← 返回球员管理</Button></Link>
      <EditableProTable
        rowKey="statsId"
        headerTitle="生涯逐季数据管理（保存后自动重算生涯汇总行）"
        loading={loading}
        value={rows}
        onChange={setRows}
        recordCreatorProps={false}
        editable={{ type: 'multiple', editableKeys, onChange: setEditableKeys, actionRender: () => [] }}
        columns={columns}
        scroll={{ x: 2400 }}
        toolBarRender={() => [
          <Button key="add" onClick={onAddRow}>保存并新增赛季</Button>,
          <Button key="save" type="primary" onClick={onSaveAll}>保存全部（重算汇总）</Button>,
        ]}
      />
    </>
  )
}
