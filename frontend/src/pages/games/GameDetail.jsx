import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ProTable } from '@ant-design/pro-components'
import { Button, Card, Empty, Segmented, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import { playerApi } from '../../api/player'
import TeamLogo, { HomeAwayTag, TeamNames } from '../../components/TeamLogo'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import { compactColumns, sumColWidth } from '../players/statColumns'
import { fmtMadePct, fmtPair, seasonYearLabel } from '../players/rankConfig'
import GameRating from './GameRating'
import { groupByKind, KIND_LABEL, reasonText } from './absence'

const BRAND = '#fa541c'
const ROUND_LABEL = { 1: '首轮', 2: '半决赛', 3: '分区决赛', 4: '总决赛' }

/** 第 5 节起是加时：只有一个加时叫「加时」，多个才编号 */
const periodLabel = (p, maxPeriod) => {
  if (p <= 4) return `${p}`
  return maxPeriod > 5 ? `加${p - 4}` : '加时'
}

// 命中率现算，和球员逐场表共用一份（fmtMadePct）——两处各写一份迟早在
// "出手 0 该显示什么"上分道扬镳

/**
 * 单场详情：每节得分 + 两队合计 + 两队球员数据，另一个页签是赛后评分。
 *
 * 每节得分是**一节一行**存的（`game_period_score`），不是四个固定的季度列——加时赛不止四节，
 * 定死四列会把加时的分默默丢掉。所以这里的列是按实际拿到的节数现算的。
 *
 * ## 比分牌不进页签
 *
 * 「谁赢了、多少分」是两个页签共同的前提：看数据要它，打分更要它。
 * 收进页签的话，切到评分那边就得靠记忆。所以它留在上面，页签只切下半部分。
 *
 * ## 页签写进 URL
 *
 * 和站里其它数据页一套做法（`useUrlState`）：点进某个球员再返回时，
 * 回到的是刚才那个页签，而不是默认的「数据」。
 */
export default function GameDetail() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [data, setData] = useState(undefined)
  const [tab, setTab] = useUrlState('tab', 'stats')

  useEffect(() => {
    let alive = true
    setData(undefined)
    playerApi.gameDetail(gameId)
      .then((d) => { if (alive) setData(d || null) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [gameId])

  if (data === undefined) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />
  if (!data) {
    return (
      <Card style={{ borderRadius: 14 }}>
        <Empty description="没有这场比赛">
          <Button onClick={() => navigate('/games')}>回每日赛场</Button>
        </Empty>
      </Card>
    )
  }

  const { homeTeam, awayTeam, homeScore, awayScore, gameDate, seasonNum, seasonType, round } = data
  const isPo = Number(seasonType) === 3
  // 客队在前：和比分牌、和「客 @ 主」的读法一致
  const order = [awayTeam, homeTeam].filter(Boolean)
  const maxPeriod = Math.max(0, ...Object.values(data.periods || {})
    .flatMap((rows) => rows.map((r) => Number(r.period))))

  return (
    <>
      <Card style={{ borderRadius: 14, marginBottom: 14 }} styles={{ body: { padding: isMobile ? 16 : 20 } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Tag color={isPo ? 'volcano' : 'blue'} style={{ marginRight: 0 }}>
            {isPo ? (ROUND_LABEL[Number(round)] || '季后赛') : '常规赛'}
          </Tag>
          <span style={{ color: '#999', fontSize: 13 }}>
            {seasonYearLabel(Number(seasonNum))} · {dayjs(gameDate).format('YYYY 年 M 月 D 日')}
          </span>
          <a onClick={() => navigate(`/games?date=${dayjs(gameDate).format('YYYY-MM-DD')}`)}
             style={{ marginLeft: 'auto', fontSize: 13 }}>
            当天其他比赛
          </a>
        </div>

        {/* 比分牌 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 14 : 32 }}>
          <Side team={awayTeam} score={awayScore} win={Number(awayScore) > Number(homeScore)} isHome={false} isMobile={isMobile} />
          <span style={{ color: '#ccc', fontSize: 13 }}>@</span>
          <Side team={homeTeam} score={homeScore} win={Number(homeScore) > Number(awayScore)} isHome isMobile={isMobile} />
        </div>

        {/* 每节得分 */}
        {maxPeriod > 0 && (
          <div style={{ marginTop: 18, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320, fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#999' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>每节得分</th>
                  {Array.from({ length: maxPeriod }, (_, i) => (
                    <th key={i} style={{ padding: '6px 8px', fontWeight: 500, width: 44 }}>
                      {periodLabel(i + 1, maxPeriod)}
                    </th>
                  ))}
                  <th style={{ padding: '6px 8px', width: 52 }}>总分</th>
                </tr>
              </thead>
              <tbody>
                {order.map((team) => {
                  const byPeriod = Object.fromEntries(
                    (data.periods?.[team] || []).map((r) => [Number(r.period), Number(r.pts)]))
                  const total = team === homeTeam ? homeScore : awayScore
                  const win = Number(total) === Math.max(Number(homeScore), Number(awayScore))
                  return (
                    <tr key={team} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px', fontWeight: win ? 700 : 500 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <HomeAwayTag home={team === homeTeam} size={16} />
                          <TeamNames value={team} />
                        </span>
                      </td>
                      {Array.from({ length: maxPeriod }, (_, i) => (
                        <td key={i} style={{ textAlign: 'center', padding: '8px' }}>
                          {byPeriod[i + 1] ?? '-'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '8px', fontWeight: 800, color: win ? BRAND : '#666' }}>
                        {total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        block={isMobile}
        options={[{ value: 'stats', label: '数据' }, { value: 'rating', label: '评分' }]}
        style={{ marginBottom: 14 }}
      />

      {tab === 'stats'
        ? order.map((team) => (
          <TeamBox
            key={team}
            team={team}
            isHome={team === homeTeam}
            players={data.players?.[team] || []}
            absent={data.absent?.[team] || []}
            totals={data.totals?.[team]}
            isMobile={isMobile}
            onPlayer={(id) => id && navigate(`/players/${id}`)}
          />
        ))
        : (
          <GameRating
            gameId={gameId}
            teams={order.map((team) => ({
              team,
              isHome: team === homeTeam,
              rows: data.players?.[team] || [],
              absent: data.absent?.[team] || [],
            }))}
            isMobile={isMobile}
            onPlayer={(id) => id && navigate(`/players/${id}`)}
          />
        )}
    </>
  )
}

function Side({ team, score, win, isHome, isMobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <TeamLogo code={team} size={isMobile ? 44 : 56} />
      {/* 主客标挨着队名，不放队标上方：比分牌是左右对称的两栏，标签落在名字这一行
          两边高度才齐 */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: isMobile ? 13 : 14, color: '#555' }}>
        <HomeAwayTag home={isHome} size={16} />
        <TeamNames value={team} />
      </span>
      <span style={{ fontSize: isMobile ? 30 : 38, fontWeight: 800, lineHeight: 1, color: win ? BRAND : '#bbb' }}>
        {score}
      </span>
    </div>
  )
}

/**
 * 一支球队的 box score。合计行钉在表底，就是 B-R 的 Team Totals 那一行。
 *
 * 未出场的人**不进表格**，另起一行列在下面：表格的每一列都是统计数据，
 * 而他们一格数据都没有。硬塞进去就是一整行破折号，既占地方又会让「场次」这类
 * 一眼扫的判断出错。放在下面既说清了大名单，又不干扰上面那张表。
 */
function TeamBox({ team, isHome, players, absent, totals, isMobile, onPlayer }) {
  const cols = [
    {
      title: '球员', dataIndex: 'playerName', width: 108, fixed: 'left',
      render: (v, r) => (r.totalRow
        ? <b>全队</b>
        : <a onClick={() => onPlayer(r.playerId)} style={{ color: '#222' }}>{v || r.nameEn || '-'}</a>),
    },
    { title: '首发', dataIndex: 'starter', width: 48, render: (v, r) => (r.totalRow ? '' : Number(v) ? '✓' : '-') },
    { title: '时间', dataIndex: 'playingTime', width: 48 },
    { title: '得分', dataIndex: 'pts', width: 48, render: (v) => <b style={{ color: BRAND }}>{v}</b> },
    { title: '篮板', dataIndex: 'reb', width: 48 },
    { title: '助攻', dataIndex: 'ast', width: 48 },
    // 命中数和命中率分开成列，和场均表（statColumns 的「投篮 / 投篮%」）一套写法。
    // 原来挤成 "8/15 53.3%" 一格：两个数量级不同的东西并排，扫一列比命中率时
    // 眼睛要越过前面的比分才找得到百分号，而且 104px 里塞 11 个字符本来就紧
    { title: '投篮', dataIndex: 'fgm', width: 66, render: (_, r) => fmtPair(r.fgm, r.fga, 0) },
    { title: '投篮%', dataIndex: 'fgPct', width: 58, render: (_, r) => fmtMadePct(r.fgm, r.fga) },
    { title: '三分', dataIndex: 'tpm', width: 66, render: (_, r) => fmtPair(r.tpm, r.tpa, 0) },
    { title: '三分%', dataIndex: 'tpPct', width: 58, render: (_, r) => fmtMadePct(r.tpm, r.tpa) },
    { title: '罚球', dataIndex: 'ftm', width: 66, render: (_, r) => fmtPair(r.ftm, r.fta, 0) },
    { title: '罚球%', dataIndex: 'ftPct', width: 58, render: (_, r) => fmtMadePct(r.ftm, r.fta) },
    { title: '前板', dataIndex: 'offReb', width: 48 },
    { title: '后板', dataIndex: 'defReb', width: 48 },
    { title: '盖帽', dataIndex: 'blk', width: 48 },
    { title: '抢断', dataIndex: 'stl', width: 48 },
    { title: '失误', dataIndex: 'tov', width: 48 },
    { title: '犯规', dataIndex: 'pf', width: 48 },
    {
      title: '+/-', dataIndex: 'plusMinus', width: 56,
      render: (v, r) => (r.totalRow || v == null
        ? ''
        : <span style={{ color: v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#999' }}>{v > 0 ? `+${v}` : v}</span>),
    },
  ]
  const shown = isMobile ? compactColumns(cols) : cols
  // 合计行走 dataSource 而不是 ProTable 的 summary：summary 不跟着横向滚动，
  // 列一多就和上面的表错位
  const rows = [...players, ...(totals ? [{ ...totals, playerId: '__total__', totalRow: true }] : [])]

  return (
    <Card
      style={{ borderRadius: 14, marginBottom: 14 }}
      styles={{ body: { padding: isMobile ? '12px 10px' : '16px 18px' } }}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <TeamLogo code={team} size={22} />
          <TeamNames value={team} />
          {/* 两张 box score 上下排，翻到下面那张时比分牌已经滚出屏幕了，
              标题上得自己说清楚这是主队还是客队 */}
          <HomeAwayTag home={isHome} size={16} />
        </span>
      }
    >
      <ProTable
        className="stat-compact"
        bordered
        toolBarRender={false}
        rowKey="playerId"
        dataSource={rows}
        columns={shown}
        search={false}
        options={false}
        pagination={false}
        scroll={{ x: sumColWidth(shown) }}
        rowClassName={(r) => (r.totalRow ? 'game-total-row' : '')}
      />
      <AbsentList rows={absent} onPlayer={onPlayer} />
    </Card>
  )
}

/**
 * 大名单里没上场的人。整块在没有数据时消失，不留一句「无」——
 * 2000 年以前的比赛 B-R 根本没登这两份名单，每张老比赛的卡片下面
 * 挂一行「未出场：无」是在陈述一件不存在的事。
 */
function AbsentList({ rows, onPlayer }) {
  const groups = groupByKind(rows)
  if (!groups.length) return null
  return (
    <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.9 }}>
      {groups.map(([kind, list]) => (
        <div key={kind}>
          <span style={{ color: '#bbb', marginRight: 8 }}>{KIND_LABEL[kind]}</span>
          {list.map((r, i) => (
            <span key={r.playerId}>
              {i > 0 && <span style={{ color: '#eee' }}> · </span>}
              <a onClick={() => onPlayer?.(r.playerId)} style={{ color: '#999' }}>
                {r.playerName || r.nameEn || '-'}
              </a>
              {/* DNP 的原因才有信息量（教练决定 / 禁赛 / 不随队）；
                  未激活那一组 B-R 压根不给原因，写出来只会是重复的「未激活」 */}
              {kind === 'DNP' && reasonText(r.reason) && reasonText(r.reason) !== '未上场' && (
                <span style={{ color: '#ddd' }}>（{reasonText(r.reason)}）</span>
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
