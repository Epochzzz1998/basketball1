import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Input, Select, Space } from 'antd'
import { playerApi } from '../../api/player'
import { seasonOptions } from './rankConfig'
import { buildFullStatColumns, FULL_COLUMNS_SCROLL_X } from './statColumns'

/**
 * 全体球员某赛季数据榜（公开）。替代原 all-player-season-stats.ftl。
 * 用 ProTable：它的 request 回调把"排序/筛选"翻译成后端参数，排序直连 P3-1 白名单。
 * 传 team 时只显示该队球员（后端 PLAYER_TEAM LIKE 过滤，转会行如 "LAC->MIA" 两队都算）。
 * 不分页：一次拉全该赛季（联盟 ~300 人/季），滚动到底。
 */
export default function AllPlayerSeasonStats({ team }) {
  const [seasonNum, setSeasonNum] = useState(1)
  const [playerName, setPlayerName] = useState() // 球员名模糊搜索（后端 LIKE）

  return (
    <ProTable
      headerTitle={team ? `${team} · 球员数据` : '球员赛季数据榜'}
      rowKey="statsId"
      columns={buildFullStatColumns()}
      params={{ seasonNum, playerTeam: team, playerName }} /* 任一变化都会自动重新请求 */
      search={false}
      scroll={{ x: FULL_COLUMNS_SCROLL_X }}
      options={false}
      toolBarRender={() => [
        <Input.Search
          key="search"
          allowClear
          placeholder="搜索球员名"
          style={{ width: 200 }}
          onSearch={(v) => setPlayerName(v.trim() || undefined)}
        />,
        <Space key="season">
          赛季：
          <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions} style={{ width: 170 }} />
        </Space>,
      ]}
      pagination={false} /* 不分页，一滚到底 */
      request={async (params, sort) => {
        const sortKey = Object.keys(sort || {})[0] // 当前排序列（驼峰名）
        const res = await playerApi.listSeasonStats({
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
