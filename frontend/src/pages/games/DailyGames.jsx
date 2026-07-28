import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Empty, Spin, Tag } from 'antd'
import { playerApi } from '../../api/player'
import TeamLogo, { HomeAwayTag, TeamNames } from '../../components/TeamLogo'
import useIsMobile from '../../hooks/useIsMobile'
import GameDayNav from './GameDayNav'
import { seasonYearLabel } from '../players/rankConfig'

const BRAND = '#fa541c'
const ROUND_LABEL = { 1: '首轮', 2: '半决赛', 3: '分区决赛', 4: '总决赛' }

/**
 * 每日赛场：选一个日期，看当天的全部比赛，点进去是单场详情。
 *
 * **默认落在"有比赛的最后一天"，不是今天。** 逐场数据是逐步回补的（季后赛先到、常规赛在爬），
 * 按今天打开多半是空的，看着像页面坏了。日期通过 ?date= 挂在地址栏上，
 * 这样从单场详情按浏览器返回能回到同一天，分享链接也带得走。
 *
 * 小日历里有比赛的日子标成橙底：不然只能一天天点过去试，很难找到有内容的日期。
 */
export default function DailyGames() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(params.get('date') || null)
  const [rows, setRows] = useState(null)
  const [days, setDays] = useState(null)

  // 没带日期时先问后端最后一场比赛是哪天
  useEffect(() => {
    if (date) return
    let alive = true
    playerApi.latestGameDate()
      .then((d) => { if (alive && d) setDate(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [date])

  // 地址栏跟着选中的日期走（replace：翻日期不该在历史里堆一大串）
  useEffect(() => {
    if (date && params.get('date') !== date) setParams({ date }, { replace: true })
  }, [date])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!date) return
    let alive = true
    setRows(null)
    playerApi.gamesByDate(date)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [date])

  // 当月哪几天有比赛，换月才重拉
  const month = date ? date.slice(0, 7) : null
  useEffect(() => {
    if (!month) return
    let alive = true
    playerApi.gameDates(month)
      .then((r) => { if (alive) setDays(new Set(r || [])) })
      .catch(() => { if (alive) setDays(new Set()) })
    return () => { alive = false }
  }, [month])

  if (!date) return <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />


  return (
    <>
      <Card
        style={{ borderRadius: 14, marginBottom: 14 }}
        styles={{ body: { padding: isMobile ? '14px 14px' : '18px 20px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20 }}>每日赛场</span>
          <GameDayNav date={date} onChange={setDate} days={days} />
          <span style={{ color: '#999', fontSize: 13, marginLeft: 'auto' }}>
            {rows === null ? '…' : `${rows.length} 场`}
          </span>
        </div>
      </Card>

      {rows === null ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : rows.length === 0 ? (
        <Card style={{ borderRadius: 14 }}>
          <Empty description="这一天没有比赛" style={{ margin: '30px 0' }} />
        </Card>
      ) : (
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        }}>
          {rows.map((g) => <GameCard key={g.gameId} g={g} onOpen={() => navigate(`/games/${g.gameId}`)} />)}
        </div>
      )}
    </>
  )
}

/**
 * 一场比赛的卡片：客队在上、主队在下（和比分牌一致），赢的那边加粗。
 * 每行前面挂一个「主 / 客」小标（HomeAwayTag，和单场详情共用一份）。
 */
function GameCard({ g, onOpen }) {
  const home = Number(g.homeScore)
  const away = Number(g.awayScore)
  const line = (team, score, win, isHome) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <HomeAwayTag home={isHome} />
      <TeamLogo code={team} size={26} />
      <span style={{ fontWeight: win ? 800 : 500, color: win ? '#222' : '#888', flex: 1 }}>
        <TeamNames value={team} />
      </span>
      <span style={{ fontWeight: win ? 800 : 500, fontSize: 18, color: win ? BRAND : '#999' }}>{score}</span>
    </div>
  )
  return (
    <Card
      hoverable
      onClick={onOpen}
      style={{ borderRadius: 14, cursor: 'pointer' }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <Tag color={Number(g.seasonType) === 3 ? 'volcano' : 'blue'} style={{ marginRight: 0 }}>
          {Number(g.seasonType) === 3 ? (ROUND_LABEL[Number(g.round)] || '季后赛') : '常规赛'}
        </Tag>
        <span style={{ color: '#bbb', fontSize: 12, alignSelf: 'center' }}>
          {seasonYearLabel(Number(g.seasonNum))}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {line(g.awayTeam, g.awayScore, away > home, false)}
        {line(g.homeTeam, g.homeScore, home > away, true)}
      </div>
    </Card>
  )
}
