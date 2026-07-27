import { useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { Input } from 'antd'
import { playerApi } from '../../api/player'
import SeasonPicker from '../../components/SeasonPicker'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import { LATEST_SEASON } from './rankConfig'
import { TeamNames } from '../../components/TeamLogo'
import StatViewSwitch from './StatViewSwitch'
import { buildFullStatColumns, buildAdvancedStatColumns, HONOR_COLUMN_KEYS, compactColumns, sumColWidth } from './statColumns'

/**
 * 球员数据榜（公开）。可独立使用（自带赛季选择），也可受控嵌入（传 seasonNum 则隐藏内部选择）。
 * - team：只显示该队球员（按交易链最后一站归队，赛季末不在该队的不算），
 *   且不渲染工具条（无标题无搜索，与球员卡片逐季表同款纯表格）；
 * - stage：'reg' 常规赛 / 'po' 季后赛（各查各的表，同一套排序白名单）；
 * - round：季后赛下指定轮次（1-4）时改查单轮次表，此时"球队"列换成"对手"，
 *   位置列丢掉（系列赛数据源没有位置）；不传或传 null 就是整个季后赛的汇总；
 * - 排序直连 P3-1 白名单；不分页一滚到底；独立使用时带球员名模糊搜索。
 */
export default function AllPlayerSeasonStats({ team, stage = 'reg', seasonNum: seasonProp, round = null }) {
  // 独立使用时赛季写进 URL（返回可恢复）；受控嵌入（球队页）时忽略此值
  const [seasonState, setSeasonState] = useUrlState('seasonNum', LATEST_SEASON, true)
  const [playerName, setPlayerName] = useState() // 球员名模糊搜索（后端 LIKE）
  const isMobile = useIsMobile()
  const controlled = seasonProp != null
  const seasonNum = controlled ? seasonProp : seasonState
  const po = stage === 'po'
  const byRound = po && round != null
  // 基础表已有 20+ 列，高阶又是 20 个指标，并成一张表没法看——拆两组切换
  const [view, setView] = useState('basic')
  const adv = view === 'adv' && !byRound

  const base = (adv ? buildAdvancedStatColumns({ po }) : buildFullStatColumns())
    .filter((c) => !po || !HONOR_COLUMN_KEYS.includes(c.dataIndex))
    // 单轮次数据来自 B-R 系列赛表：没有位置列，球队恒为本队、换成更有用的对手
    .filter((c) => !byRound || c.dataIndex !== 'playerPosition')
    .map((c) => {
      if (!byRound) return c
      if (c.dataIndex === 'playerTeam') {
        return { ...c, title: '对手', dataIndex: 'oppTeam', render: (v) => <TeamNames value={v} /> }
      }
      // 系列赛页没有首发场次这一列，别拿 0 冒充「无人首发」
      if (c.dataIndex === 'playerAppearance') {
        return { ...c, title: '出场', width: 48, render: (_, r) => r.playerAppearance ?? 0 }
      }
      return c
    })
  const columns = isMobile ? compactColumns(base) : base

  // 轮次视图的数据来自 B-R 系列赛页，没有高阶指标，那种情况下不给切换
  const showSwitch = !byRound

  return (
    <>
    {showSwitch && <StatViewSwitch value={view} onChange={setView} />}
    <ProTable
      className="stat-compact"
      bordered
      headerTitle={team ? undefined : '球员赛季数据榜'}
      rowKey="statsId"
      columns={columns}
      params={{ seasonNum, playerTeam: team, playerName, stage, round }} /* 任一变化都会自动重新请求 */
      search={false}
      scroll={{ x: sumColWidth(columns) }}
      options={false}
      /* 球队页嵌入：开关挪到表外后工具条就空了，整条关掉回到纯表格 */
      toolBarRender={team ? false : () => [
        <Input.Search
          key="search"
          allowClear
          placeholder="搜索球员名"
          style={{ width: isMobile ? 150 : 200 }}
          onSearch={(v) => setPlayerName(v.trim() || undefined)}
        />,
        ...(controlled ? [] : [<SeasonPicker key="season" value={seasonNum} onChange={setSeasonState} />]),
      ]}
      pagination={false} /* 不分页，一滚到底 */
      request={async (params, sort) => {
        const sortKey = Object.keys(sort || {})[0] // 当前排序列（驼峰名）
        const query = {
          seasonNum: params.seasonNum,
          playerTeam: params.playerTeam,
          playerName: params.playerName,
          field: sortKey,
          order: sortKey ? (sort[sortKey] === 'ascend' ? 'asc' : 'desc') : undefined,
        }
        // 单轮次走独立接口，返回的是裸数组（不分页）
        if (byRound) {
          const rows = await playerApi.playoffRoundStats({ ...query, round: params.round })
          return { data: rows || [], total: rows?.length || 0, success: true }
        }
        const api = po ? playerApi.listPlayoffSeasonStats : playerApi.listSeasonStats
        const res = await api({ ...query, page: 1, limit: 2000 })
        // 拦截器已把 Result 拆成 {total, records}
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
    />
    </>
  )
}
