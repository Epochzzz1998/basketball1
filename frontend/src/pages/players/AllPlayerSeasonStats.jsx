import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Input } from 'antd'
import { playerApi } from '../../api/player'
import SeasonPicker from '../../components/SeasonPicker'
import { buildFullStatColumns, FULL_COLUMNS_SCROLL_X, HONOR_COLUMN_KEYS, PLAYOFF_COLUMNS_SCROLL_X } from './statColumns'

/**
 * 球员数据榜（公开）。可独立使用（自带赛季选择），也可受控嵌入（传 seasonNum 则隐藏内部选择）。
 * - team：只显示该队球员（后端 PLAYER_TEAM LIKE，转会行两队都算）；
 * - stage：'reg' 常规赛 / 'po' 季后赛（各查各的表，同一套排序白名单）；
 * - 排序直连 P3-1 白名单；不分页一滚到底；球员名模糊搜索。
 */
export default function AllPlayerSeasonStats({ team, stage = 'reg', seasonNum: seasonProp }) {
  const [seasonState, setSeasonState] = useState(LATEST_SEASON)
  const [playerName, setPlayerName] = useState() // 球员名模糊搜索（后端 LIKE）
  const controlled = seasonProp != null
  const seasonNum = controlled ? seasonProp : seasonState
  const po = stage === 'po'

  return (
    <ProTable
      headerTitle={team ? `${team} · ${po ? '季后赛' : ''}球员数据` : '球员赛季数据榜'}
      rowKey="statsId"
      columns={buildFullStatColumns().filter((c) => !po || !HONOR_COLUMN_KEYS.includes(c.dataIndex))}
      params={{ seasonNum, playerTeam: team, playerName, stage }} /* 任一变化都会自动重新请求 */
      search={false}
      scroll={{ x: po ? PLAYOFF_COLUMNS_SCROLL_X : FULL_COLUMNS_SCROLL_X }}
      options={false}
      toolBarRender={() => [
        <Input.Search
          key="search"
          allowClear
          placeholder="搜索球员名"
          style={{ width: 200 }}
          onSearch={(v) => setPlayerName(v.trim() || undefined)}
        />,
        ...(controlled
          ? []
          : [
              <SeasonPicker key="season" value={seasonNum} onChange={setSeasonState} />,
            ]),
      ]}
      pagination={false} /* 不分页，一滚到底 */
      request={async (params, sort) => {
        const sortKey = Object.keys(sort || {})[0] // 当前排序列（驼峰名）
        const api = po ? playerApi.listPlayoffSeasonStats : playerApi.listSeasonStats
        const res = await api({
          page: 1,
          limit: 2000,
          seasonNum: params.seasonNum,
          playerTeam: params.playerTeam,
          playerName: params.playerName,
          field: sortKey,
          order: sortKey ? (sort[sortKey] === 'ascend' ? 'asc' : 'desc') : undefined,
        })
        // 拦截器已把 Result 拆成 {total, records}
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
    />
  )
}
