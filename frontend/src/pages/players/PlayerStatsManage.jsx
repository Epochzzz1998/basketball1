import { useEffect, useRef, useState } from 'react'
import { EditableProTable } from '@ant-design/pro-components'
import { Button, Popconfirm, message } from 'antd'
import { useParams, Link } from 'react-router-dom'
import { playerApi } from '../../api/player'

// [字段, 列名, 类型]：数字用 digit(InputNumber)，文本用 text
const STAT_FIELDS = [
  ['season', '赛季', 'digit'], ['seasonNum', '序号', 'digit'],
  ['playerTeam', '球队', 'text'], ['playerPosition', '位置', 'text'],
  ['playerAppearance', '出场', 'digit'], ['playerFrAppearance', '先发', 'digit'], ['playerSrAppearance', '替补', 'digit'],
  ['playingTime', '时间', 'digit'], ['playerAvgScore', '得分', 'digit'],
  ['playerAvgReb', '篮板', 'digit'], ['playerAvgOffReb', '前场篮板', 'digit'], ['playerAvgDefReb', '后场篮板', 'digit'],
  ['playerAvgAss', '助攻', 'digit'],
  ['playerAvgFgm', '投篮命中', 'digit'], ['playerAvgFga', '投篮出手', 'digit'], ['playerAccuracy', '投篮%', 'digit'],
  ['playerAvgTpm', '三分命中', 'digit'], ['playerAvgTpa', '三分出手', 'digit'], ['playerThreeAccuracy', '三分%', 'digit'],
  ['playerAvgFtm', '罚球命中', 'digit'], ['playerAvgFta', '罚球出手', 'digit'], ['playerFreethrowAccuracy', '罚球%', 'digit'],
  ['playerAvgBlock', '盖帽', 'digit'], ['playerAvgSteal', '抢断', 'digit'], ['playerAvgTurnover', '失误', 'digit'],
  ['playerPer', 'PER', 'digit'], ['playerPie', 'PIE', 'digit'], ['playerWs', 'WS', 'digit'],
  ['playerOffEff', '进攻效率', 'digit'], ['playerDefEff', '防守效率', 'digit'], ['playerNetEff', '净效率', 'digit'], ['playerAvgPn', '正负值', 'digit'],
  ['mvpRank', 'MVP', 'digit'], ['dpoyRank', 'DPOY', 'digit'],
  ['allDbaTeam', '最佳阵容', 'text'], ['allDefTeam', '最佳防守', 'text'],
]

const SUMMARY_SEASON = 50 // 生涯汇总行（season/seasonNum=50），由后端重算，不可删
const isTemp = (id) => typeof id === 'string' && id.startsWith('new-')

/**
 * 某球员生涯逐季数据管理（superManager）。替代 player-stats-manager-list.ftl。
 * "新增一行赛季"只在前端本地追加（带 new- 临时 id），点"保存全部"才入库——
 * savePlayerStats 对空 statsId 会补 UUID 再保存，并重算生涯汇总行(seasonNum=50)。
 */
export default function PlayerStatsManage() {
  const { playerId } = useParams()
  const [rows, setRows] = useState([])
  const [editableKeys, setEditableKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const tmpSeq = useRef(0) // 递增计数器，保证本地新行的 rowKey 唯一

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

  // 本地新增一行：不落库，给个 new- 临时 id 占 rowKey，序号自动取最大季+1
  const onAddRow = () => {
    const tmpId = `new-${tmpSeq.current++}`
    const maxNum = rows
      .filter((r) => r.seasonNum !== SUMMARY_SEASON)
      .reduce((m, r) => Math.max(m, Number(r.seasonNum) || 0), 0)
    setRows([...rows, { statsId: tmpId, playerId, seasonNum: maxNum + 1 }])
    setEditableKeys([...editableKeys, tmpId])
  }

  const onSaveAll = async () => {
    // 临时行清空 statsId（让后端补 UUID）并带上 playerId
    const payload = rows.map((r) => (isTemp(r.statsId) ? { ...r, statsId: '', playerId } : r))
    await playerApi.savePlayerStats(payload, playerId)
    message.success('已保存，生涯汇总已重算')
    reload()
  }

  const onDelete = async (row) => {
    if (isTemp(row.statsId)) { // 还没入库，本地删掉即可
      setRows(rows.filter((r) => r.statsId !== row.statsId))
      setEditableKeys(editableKeys.filter((k) => k !== row.statsId))
      return
    }
    await playerApi.deletePlayerStats(row.statsId, playerId)
    message.success('已删除，生涯汇总已重算')
    reload()
  }

  const columns = [
    ...STAT_FIELDS.map(([dataIndex, title, valueType]) => ({ title, dataIndex, valueType, width: 92 })),
    {
      title: '操作', valueType: 'option', fixed: 'right', width: 80, editable: false,
      render: (_, row) =>
        row.seasonNum === SUMMARY_SEASON
          ? [<span key="s" style={{ color: '#999' }}>汇总行</span>]
          : [
              <Popconfirm key="del" title="删除该赛季数据？" onConfirm={() => onDelete(row)}>
                <a style={{ color: '#ff4d4f' }}>删除</a>
              </Popconfirm>,
            ],
    },
  ]

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
        scroll={{ x: 3300 }}
        toolBarRender={() => [
          <Button key="add" onClick={onAddRow}>新增一行赛季</Button>,
          <Button key="save" type="primary" onClick={onSaveAll}>保存全部（重算汇总）</Button>,
        ]}
      />
    </>
  )
}
