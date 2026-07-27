import { useEffect, useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { useParams, Link } from 'react-router-dom'
import { Button, Card, Col, ConfigProvider, Empty, Row, Segmented, Space, Spin, Tag } from 'antd'
import { BarChartOutlined, FireOutlined, IdcardOutlined, TrophyOutlined } from '@ant-design/icons'
import { playerApi } from '../../api/player'
import { CAREER_SEASON, NBA_TEAM_NAMES, PLAYOFF_TAG, fmtNum as num, fmtPair, fmtReb, seasonYearLabel, seasonShort, fmtPct } from './rankConfig'
import { CAREER_AWARDS } from './honorConfig'
import { compactColumns, sumColWidth } from './statColumns'
import TeamLogo, { TeamNames } from '../../components/TeamLogo'
import SeasonProfile from './SeasonProfile'
import GameLogTable from './GameLog'
import { SEASON_TYPE, useGameLogSeasons } from './gameLogConfig'
import useIsMobile from '../../hooks/useIsMobile'

const shortSeason = (s) => seasonYearLabel(s).replace(' 赛季', '')

/* ============ 生涯荣誉（荣誉柜） ============ */

function AwardCard({ award, entries }) {
  const isChampion = award.key === 'champion'
  const isMobile = useIsMobile()
  return (
    <Card
      style={
        award.gold
          ? { background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)', border: '1px solid #ffe58f' }
          : undefined
      }
      styles={{ body: { padding: '16px 18px' } }}
    >
      <Space align="start" size={14}>
        <span style={{ fontSize: isMobile ? 26 : 34, lineHeight: 1 }}>{award.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {award.label}
            <span style={{ marginLeft: 8, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: award.gold ? '#d48806' : '#fa541c' }}>
              ×{entries.length}
            </span>
          </div>
          <Space size={[4, 4]} wrap style={{ marginTop: 6 }}>
            {entries.map((e, i) => (
              <Tag key={i} color={award.gold ? 'gold' : 'default'} style={{ marginInlineEnd: 0 }}>
                {isChampion ? `${shortSeason(e.season)} · ${e.team}` : shortSeason(e)}
              </Tag>
            ))}
          </Space>
        </div>
      </Space>
    </Card>
  )
}

function HonorShelf({ honors }) {
  if (!honors) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  const owned = CAREER_AWARDS.map((a) => ({ award: a, entries: honors[a.key] || [] })).filter((x) => x.entries.length > 0)
  if (!owned.length) return <Empty description="生涯暂无主要荣誉——还在拼搏的路上" />

  // 顶部速览条：只列拿过的荣誉计数
  const summary = owned.map((x) => `${x.award.icon} ${x.award.label} ×${x.entries.length}`).join('　')

  return (
    <>
      <Card
        style={{ marginBottom: 16, background: 'linear-gradient(120deg, #fa541c 0%, #fa8c16 100%)', border: 'none' }}
        styles={{ body: { padding: '14px 20px' } }}
      >
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15, lineHeight: 2 }}>{summary}</span>
      </Card>
      <Row gutter={[16, 16]}>
        {owned.map((x) => (
          <Col key={x.award.key} xs={24} sm={12} lg={8}>
            <AwardCard award={x.award} entries={x.entries} />
          </Col>
        ))}
      </Row>
    </>
  )
}

/* ============ Tab 1：生涯逐季数据 ============ */

function CareerTable({ playerId }) {
  const isMobile = useIsMobile()
  const columns = [
    { title: '赛季', dataIndex: 'seasonNum', width: 64, fixed: 'left', render: (s) => (s === CAREER_SEASON ? '生涯' : seasonShort(s)) },
    { title: '球队', dataIndex: 'playerTeam', width: 78, render: (v) => <TeamNames value={v} /> },
    { title: '位置', dataIndex: 'playerPosition', width: 46 },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 80, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 48, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 48, render: (v) => num(v) },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 112,
      render: (_, r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb)}</span>,
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 48, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 88, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 56, render: (v) => fmtPct(v) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 88, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 56, render: (v) => fmtPct(v) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 88, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 56, render: (v) => fmtPct(v) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 48, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 48, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 48, render: (v) => num(v) },
    { title: '犯规', dataIndex: 'playerAvgPf', width: 48, render: (v) => num(v) },
    { title: '效率值', dataIndex: 'playerPer', width: 58, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 50 },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 56 },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 72 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 72 },
  ]

  const cols = isMobile ? compactColumns(columns) : columns
  return (
    <ProTable
      className="stat-compact"
      bordered
      toolBarRender={false}
      rowKey="statsId"
      columns={cols}
      search={false}
      options={false}
      scroll={{ x: sumColWidth(cols) }}
      pagination={false}
      request={async (params, sort) => {
        const sortKey = Object.keys(sort || {})[0]
        const res = await playerApi.listPlayerCareer({
          playerId,
          page: 1,
          limit: 100,
          field: sortKey,
          order: sortKey ? (sort[sortKey] === 'ascend' ? 'asc' : 'desc') : undefined,
        })
        return { data: res.records || [], total: res.total || 0, success: true }
      }}
    />
  )
}

/* ============ Tab 2：季后赛逐季数据 ============ */

function PlayoffTable({ playerId }) {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.listPlayerPlayoffs(playerId)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [playerId])

  if (rows === null) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  if (!rows.length) return <Empty description="生涯未进过季后赛" />

  const columns = [
    { title: '赛季', dataIndex: 'seasonNum', width: 64, fixed: 'left', render: (s) => (s === CAREER_SEASON ? '生涯' : seasonShort(s)) },
    { title: '球队', dataIndex: 'playerTeam', width: 78, render: (v) => <TeamNames value={v} /> },
    {
      title: '成绩', dataIndex: 'playoffResult', width: 92,
      render: (v) => (v ? <Tag color={PLAYOFF_TAG[v] || 'default'}>{v}</Tag> : '-'),
    },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 80, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 48, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 48, render: (v) => <b style={{ color: '#fa541c' }}>{num(v)}</b> },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 112,
      render: (_, r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb)}</span>,
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 48, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 88, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 56, render: (v) => fmtPct(v) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 88, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 56, render: (v) => fmtPct(v) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 88, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 56, render: (v) => fmtPct(v) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 48, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 48, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 48, render: (v) => num(v) },
    { title: '犯规', dataIndex: 'playerAvgPf', width: 48, render: (v) => num(v) },
    { title: '效率值', dataIndex: 'playerPer', width: 58, render: (v) => num(v) },
  ]

  const cols = isMobile ? compactColumns(columns) : columns
  return (
    <ProTable
      className="stat-compact"
      bordered
      toolBarRender={false}
      rowKey="statsId"
      dataSource={rows}
      columns={cols}
      search={false}
      options={false}
      pagination={false}
      scroll={{ x: sumColWidth(cols) }}
    />
  )
}

/* ============ 逐季汇总 / 逐场数据 ============ */

/**
 * 一个赛段（常规赛或季后赛）的内容区。
 * 逐场数据是逐步回补的，所以「逐场数据」这个选项只在该球员该赛段确实有数据时才出现 —— 
 * 常规赛回补进来之后，同一个开关会自动长在常规赛页签上，不用改代码。
 */
function StagePane({ playerId, seasonType, seasons, children }) {
  const [view, setView] = useState('season')
  const hasLog = !!seasons?.length

  // 换到没有逐场数据的球员时，把视图拉回逐季汇总，免得停在一个空表上
  useEffect(() => { if (!hasLog) setView('season') }, [hasLog])

  return (
    <>
      {hasLog && (
        <div style={{ marginBottom: 12 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[{ label: '逐季汇总', value: 'season' }, { label: '逐场数据', value: 'game' }]}
          />
        </div>
      )}
      {view === 'season'
        ? children
        : <GameLogTable playerId={playerId} seasonType={seasonType} seasons={seasons} />}
    </>
  )
}


/* ============ 页面 ============ */

// 分段器选项（品牌橙胶囊，与数据概览同一设计语言）
const TAB_OPTIONS = [
  { value: 'profile', icon: <IdcardOutlined />, text: '赛季资料卡' },
  { value: 'career', icon: <BarChartOutlined />, text: '常规赛数据' },
  { value: 'playoffs', icon: <FireOutlined />, text: '季后赛数据' },
  { value: 'honors', icon: <TrophyOutlined />, text: '生涯荣誉' },
]

/** 球员主页（/players/:playerId）：身份头 + 赛季资料卡 / 生涯数据 / 生涯荣誉 */
export default function PlayerCareer() {
  const { playerId } = useParams()
  const isMobile = useIsMobile()
  const [honors, setHonors] = useState(null)
  const [tab, setTab] = useState('profile')
  // 资料卡选中赛季所属球队（由 SeasonProfile 回报）：身份头右侧那枚大队标就认它。
  // 交易赛季取最后一站＝赛季结束时所在的队；生涯档没有单一球队，不出队标。
  const [seasonTeam, setSeasonTeam] = useState(null)
  const [seasonNum, setSeasonNum] = useState(null) // 资料卡选中的赛季：队标跳转要带着它，落到同一个赛季的球队页
  const teamCode = String(seasonTeam || '').split('->').pop().trim().toUpperCase()
  const showTeamLogo = !!NBA_TEAM_NAMES[teamCode]
  // 一次查清这名球员哪些赛季有逐场数据，常规赛/季后赛两个页签共用这一份结果
  const gameLogSeasons = useGameLogSeasons(playerId)

  useEffect(() => {
    let alive = true
    setHonors(null)
    setSeasonTeam(null) // 换球员先清掉，别让上一位的队标停在头上
    playerApi.playerHonors(playerId)
      .then((d) => { if (alive) setHonors(d || {}) })
      .catch(() => { if (alive) setHonors({}) })
    return () => { alive = false }
  }, [playerId])

  const goldCount = honors
    ? (honors.champion?.length || 0) + (honors.mvp?.length || 0) + (honors.dpoy?.length || 0)
    : 0

  return (
    <>
      {/* 球员身份头：左边身份，右边一枚大队标（资料卡当前赛季所属球队） */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '18px 24px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Space size={16} align="center">
          {/* 有照片就上照片（超管在球员管理里传），没有则沿用球衣号圆牌 */}
          {honors?.photo ? (
            <img
              src={honors.photo}
              alt={honors.playerName || ''}
              style={{
                width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center',
                background: '#f5f5f5', border: '2px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,.14)',
              }}
            />
          ) : (
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%', background: 'rgba(250,84,28,.1)', color: '#fa541c',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20,
              }}
            >
              {honors?.playerNumber ? `#${honors.playerNumber}` : '🏀'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {honors?.playerName || '…'}
              {/* 圆牌让位给照片时，球衣号跟到名字后面，信息不丢 */}
              {honors?.photo && honors?.playerNumber && (
                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 800, color: '#fa541c' }}>#{honors.playerNumber}</span>
              )}
            </div>
            {/* 英文原名独立一行（未汉化时两者相同则不重复展示） */}
            {honors?.nameEn && honors.nameEn !== honors.playerName && (
              <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic' }}>{honors.nameEn}</div>
            )}
            {/* 手机上省掉括号里的注解，否则右边那枚队标一挤，这行会从「冠军」中间断开 */}
            <div style={{ color: '#999', fontSize: 13 }}>
              {goldCount > 0
                ? `顶级荣誉 ×${goldCount}${isMobile ? '' : '（冠军/MVP/DPOY）'}`
                : '生涯逐季数据与荣誉'}
            </div>
          </div>
        </Space>
        {showTeamLogo && (
          // 点队标进这支球队的页面，并停在资料卡当前选中的那个赛季（生涯档没有单一赛季，不带参数）
          <Link
            to={`/players/team/${teamCode}${seasonNum && seasonNum !== CAREER_SEASON ? `?seasonNum=${seasonNum}` : ''}`}
            title={`查看 ${NBA_TEAM_NAMES[teamCode]}`}
            style={{ flexShrink: 0, lineHeight: 0 }}
          >
            <TeamLogo code={teamCode} size={isMobile ? 60 : 76} />
          </Link>
        )}
        </div>
      </Card>
      {/* 胶囊分段器（替代默认 Tabs） */}
      <ConfigProvider
        theme={{
          token: { borderRadius: 22, borderRadiusSM: 18 },
          components: {
            Segmented: {
              itemSelectedBg: '#fa541c',
              itemSelectedColor: '#ffffff',
              trackBg: '#efefef',
              itemColor: '#666',
              itemHoverColor: '#fa541c',
              itemHoverBg: 'rgba(250,84,28,0.08)',
            },
          },
        }}
      >
        <Segmented
          size="large"
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 16, padding: 4, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.04)' }}
          options={TAB_OPTIONS.map((o) => ({
            value: o.value,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
                {o.icon} {o.text}
              </span>
            ),
          }))}
        />
      </ConfigProvider>
      {tab === 'profile' && <SeasonProfile playerId={playerId} honors={honors} onTeamChange={setSeasonTeam} onSeasonChange={setSeasonNum} />}
      {tab === 'career' && (
        <StagePane playerId={playerId} seasonType={SEASON_TYPE.REG} seasons={gameLogSeasons?.[SEASON_TYPE.REG]}>
          <CareerTable playerId={playerId} />
        </StagePane>
      )}
      {tab === 'playoffs' && (
        <StagePane playerId={playerId} seasonType={SEASON_TYPE.PO} seasons={gameLogSeasons?.[SEASON_TYPE.PO]}>
          <PlayoffTable playerId={playerId} />
        </StagePane>
      )}
      {tab === 'honors' && <HonorShelf honors={honors} />}
    </>
  )
}
