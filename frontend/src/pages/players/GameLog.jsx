import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProTable } from '@ant-design/pro-components'
import { Empty, Select } from 'antd'
import { playerApi } from '../../api/player'
import { TeamNames } from '../../components/TeamLogo'
import useIsMobile from '../../hooks/useIsMobile'
import { seasonShort, seasonYearLabel } from './rankConfig'
import { ROUND_LABEL, SEASON_TYPE } from './gameLogConfig'
import { compactColumns, sumColWidth } from './statColumns'

function buildColumns(seasonType, isMobile, openGame) {
  const cols = [
    { title: '日期', dataIndex: 'gameDate', width: 92, fixed: 'left', render: (v) => String(v || '').slice(5) },
    // 轮次只对季后赛有意义，常规赛行的 ROUND 是 NULL
    ...(seasonType === SEASON_TYPE.PO
      ? [{ title: '轮次', dataIndex: 'round', width: 72, render: (v) => ROUND_LABEL[Number(v)] || '-' }]
      : []),
    { title: '球队', dataIndex: 'playerTeam', width: 78, render: (v) => <TeamNames value={v} /> },
    {
      title: '对手', dataIndex: 'oppTeam', width: 78,
      render: (v, r) => (
        <span style={{ whiteSpace: 'nowrap' }}>{Number(r.home) ? '' : '@'}<TeamNames value={v} /></span>
      ),
    },
    {
      // 结果这一格点得动：跳到这场比赛的详情（两队完整 box score + 每节得分）。
      // 挂在这一列是因为比分本来就在这儿——"想知道这场到底怎么打的"就是看着比分产生的念头。
      //
      // 用 span 不用 <a>：<a> 会吃到 antd 的链接色（主色是橙），和左边红色的「负」撞在一起。
      // 这一格不加任何链接装饰，就是纯数字（见 index.css 的 .game-link）。
      // 没有 gameId 的行（理论上不该有）退回纯文本，不给一个点不动的假链接
      title: '结果', dataIndex: 'win', width: 84,
      render: (v, r) => {
        const body = (
          <>
            <b style={{ color: Number(v) ? '#52c41a' : '#ff4d4f' }}>{Number(v) ? '胜' : '负'}</b>
            <span className="score" style={{ color: '#999', marginLeft: 4 }}>{r.teamScore}-{r.oppScore}</span>
          </>
        )
        if (!r.gameId) return <span style={{ whiteSpace: 'nowrap' }}>{body}</span>
        return (
          <span
            className="game-link"
            onClick={() => openGame(r.gameId)}
            title="查看这场比赛"
            style={{ whiteSpace: 'nowrap' }}
          >
            {body}
          </span>
        )
      },
    },
    { title: '首发', dataIndex: 'starter', width: 48, render: (v) => (Number(v) ? '✓' : '-') },
    { title: '时间', dataIndex: 'playingTime', width: 48 },
    { title: '得分', dataIndex: 'pts', width: 48, render: (v) => <b style={{ color: '#fa541c' }}>{v}</b> },
    { title: '篮板', dataIndex: 'reb', width: 48 },
    { title: '助攻', dataIndex: 'ast', width: 48 },
    { title: '投篮', dataIndex: 'fgm', width: 88, render: (_, r) => `${r.fgm}/${r.fga}` },
    { title: '三分', dataIndex: 'tpm', width: 88, render: (_, r) => `${r.tpm}/${r.tpa}` },
    { title: '罚球', dataIndex: 'ftm', width: 88, render: (_, r) => `${r.ftm}/${r.fta}` },
    // 前后场篮板独立成列，与场均表口径一致；紧挨盖帽之前，两张表顺序对齐
    { title: '前板', dataIndex: 'offReb', width: 48 },
    { title: '后板', dataIndex: 'defReb', width: 48 },
    { title: '盖帽', dataIndex: 'blk', width: 48 },
    { title: '抢断', dataIndex: 'stl', width: 48 },
    { title: '失误', dataIndex: 'tov', width: 48 },
    { title: '犯规', dataIndex: 'pf', width: 48 },
    {
      title: '+/-', dataIndex: 'plusMinus', width: 56,
      render: (v) => <span style={{ color: v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#999' }}>{v > 0 ? `+${v}` : v}</span>,
    },
  ]
  return isMobile ? compactColumns(cols) : cols
}

/**
 * 逐场 box score 表（player_game_stats）。
 * 赛季选择就长在表的上方，选项只列这名球员在这个类型下真有数据的赛季，
 * 默认落在最新的一季 —— 常规赛和季后赛用的是同一套控件，只是 seasonType 不同。
 */
export default function GameLogTable({ playerId, seasonType, seasons }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [season, setSeason] = useState(seasons?.[0]?.seasonNum ?? null)
  const [rows, setRows] = useState(null)

  // 换球员时列表会整个换掉，把选中赛季拉回新列表的最新一季
  useEffect(() => { setSeason(seasons?.[0]?.seasonNum ?? null) }, [seasons])

  useEffect(() => {
    if (season == null) return
    let alive = true
    setRows(null)
    playerApi
      .playerGameLog({ playerId, seasonNum: season, seasonType })
      .then((r) => alive && setRows(r || []))
      .catch(() => alive && setRows([]))
    return () => { alive = false }
  }, [playerId, season, seasonType])

  if (!seasons?.length) return <Empty description="该球员暂无逐场数据" />

  const cols = buildColumns(seasonType, isMobile, (gameId) => navigate(`/games/${gameId}`))
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: '#999', fontSize: 13 }}>赛季</span>
        <Select
          value={season}
          onChange={setSeason}
          style={{ width: isMobile ? 168 : 210 }}
          options={seasons.map((s) => ({
            value: s.seasonNum,
            label: `${isMobile ? seasonShort(s.seasonNum) : seasonYearLabel(s.seasonNum)} · ${s.games} 场`,
          }))}
        />
      </div>
      <ProTable
        className="stat-compact"
        bordered
        toolBarRender={false}
        rowKey="gameId"
        loading={rows === null}
        dataSource={rows || []}
        columns={cols}
        search={false}
        options={false}
        pagination={false}
        scroll={{ x: sumColWidth(cols) }}
      />
    </>
  )
}
