import { useEffect, useState } from 'react'
import { ProTable } from '@ant-design/pro-components'
import { useParams, Link } from 'react-router-dom'
import { Button, Card, Col, ConfigProvider, Empty, Row, Segmented, Space, Spin, Tag } from 'antd'
import { BarChartOutlined, FireOutlined, IdcardOutlined, TrophyOutlined } from '@ant-design/icons'
import { playerApi } from '../../api/player'
import { PLAYOFF_TAG, fmtNum as num, fmtPair, fmtReb, seasonYearLabel, seasonShort } from './rankConfig'
import { CAREER_AWARDS } from './honorConfig'
import SeasonProfile from './SeasonProfile'
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
  const columns = [
    { title: '赛季', dataIndex: 'seasonNum', width: 90, fixed: 'left', sorter: true, render: (s) => (s === 50 ? '生涯' : seasonShort(s)) },
    { title: '球队', dataIndex: 'playerTeam', width: 72 },
    { title: '位置', dataIndex: 'playerPosition', width: 60 },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 82, sorter: true, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 60, sorter: true, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 62, sorter: true, render: (v) => num(v) },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 120, sorter: true,
      render: (_, r) => fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb),
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 60, sorter: true, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 86, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 68, render: (v) => num(v, 3) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 86, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 68, render: (v) => num(v, 3) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 86, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 68, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 58, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 58, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 58, sorter: true, render: (v) => num(v) },
    { title: 'PER', dataIndex: 'playerPer', width: 58, sorter: true, render: (v) => num(v) },
    { title: 'PIE', dataIndex: 'playerPie', width: 58, sorter: true, render: (v) => num(v) },
    { title: 'WS', dataIndex: 'playerWs', width: 56, sorter: true, render: (v) => num(v) },
    { title: '进攻效率', dataIndex: 'playerOffEff', width: 76, sorter: true, render: (v) => num(v) },
    { title: '防守效率', dataIndex: 'playerDefEff', width: 76, sorter: true, render: (v) => num(v) },
    { title: '净效率', dataIndex: 'playerNetEff', width: 68, sorter: true, render: (v) => num(v) },
    { title: '正负值', dataIndex: 'playerAvgPn', width: 68, sorter: true, render: (v) => num(v) },
    { title: 'MVP', dataIndex: 'mvpRank', width: 58, sorter: true },
    { title: 'DPOY', dataIndex: 'dpoyRank', width: 62, sorter: true },
    { title: '最佳阵容', dataIndex: 'allDbaTeam', width: 76 },
    { title: '最佳防守', dataIndex: 'allDefTeam', width: 76 },
  ]

  return (
    <ProTable
      headerTitle="生涯逐季数据"
      rowKey="statsId"
      columns={columns}
      search={false}
      options={false}
      scroll={{ x: 1980 }}
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
    { title: '赛季', dataIndex: 'seasonNum', width: 90, fixed: 'left', render: (s) => (s === 50 ? '生涯' : seasonShort(s)) },
    { title: '球队', dataIndex: 'playerTeam', width: 72 },
    {
      title: '成绩', dataIndex: 'playoffResult', width: 84,
      render: (v) => (v ? <Tag color={PLAYOFF_TAG[v] || 'default'}>{v}</Tag> : '-'),
    },
    { title: '首发/出场', dataIndex: 'playerAppearance', width: 82, render: (_, r) => `${r.playerFrAppearance ?? 0}/${r.playerAppearance ?? 0}` },
    { title: '时间', dataIndex: 'playingTime', width: 60, render: (v) => num(v) },
    { title: '得分', dataIndex: 'playerAvgScore', width: 62, render: (v) => <b style={{ color: '#fa541c' }}>{num(v)}</b> },
    {
      title: '篮板', dataIndex: 'playerAvgReb', width: 120,
      render: (_, r) => fmtReb(r.playerAvgReb, r.playerAvgOffReb, r.playerAvgDefReb),
    },
    { title: '助攻', dataIndex: 'playerAvgAss', width: 60, render: (v) => num(v) },
    { title: '投篮', dataIndex: 'playerAvgFgm', width: 86, render: (_, r) => fmtPair(r.playerAvgFgm, r.playerAvgFga) },
    { title: '投篮%', dataIndex: 'playerAccuracy', width: 68, render: (v) => num(v, 3) },
    { title: '三分', dataIndex: 'playerAvgTpm', width: 86, render: (_, r) => fmtPair(r.playerAvgTpm, r.playerAvgTpa) },
    { title: '三分%', dataIndex: 'playerThreeAccuracy', width: 68, render: (v) => num(v, 3) },
    { title: '罚球', dataIndex: 'playerAvgFtm', width: 86, render: (_, r) => fmtPair(r.playerAvgFtm, r.playerAvgFta) },
    { title: '罚球%', dataIndex: 'playerFreethrowAccuracy', width: 68, render: (v) => num(v, 3) },
    { title: '盖帽', dataIndex: 'playerAvgBlock', width: 58, render: (v) => num(v) },
    { title: '抢断', dataIndex: 'playerAvgSteal', width: 58, render: (v) => num(v) },
    { title: '失误', dataIndex: 'playerAvgTurnover', width: 58, render: (v) => num(v) },
    { title: 'PER', dataIndex: 'playerPer', width: 58, render: (v) => num(v) },
    { title: 'PIE', dataIndex: 'playerPie', width: 58, render: (v) => num(v) },
    { title: 'WS', dataIndex: 'playerWs', width: 56, render: (v) => num(v) },
    { title: '进攻效率', dataIndex: 'playerOffEff', width: 76, render: (v) => num(v) },
    { title: '防守效率', dataIndex: 'playerDefEff', width: 76, render: (v) => num(v) },
    { title: '净效率', dataIndex: 'playerNetEff', width: 68, render: (v) => num(v) },
    { title: '正负值', dataIndex: 'playerAvgPn', width: 68, render: (v) => num(v) },
  ]

  return (
    <ProTable
      headerTitle="季后赛逐季数据"
      rowKey="statsId"
      dataSource={rows}
      columns={columns}
      search={false}
      options={false}
      pagination={false}
      scroll={{ x: 1730 }}
    />
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
  const [honors, setHonors] = useState(null)
  const [tab, setTab] = useState('profile')

  useEffect(() => {
    let alive = true
    setHonors(null)
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
      {/* 球员身份头 */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '18px 24px' } }}>
        <Space size={16} align="center">
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(250,84,28,.1)', color: '#fa541c',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20,
            }}
          >
            {honors?.playerNumber ? `#${honors.playerNumber}` : '🏀'}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{honors?.playerName || '…'}</div>
            <div style={{ color: '#999', fontSize: 13 }}>
              {goldCount > 0 ? `顶级荣誉 ×${goldCount}（冠军/MVP/DPOY）` : '生涯逐季数据与荣誉'}
            </div>
          </div>
        </Space>
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
      {tab === 'profile' && <SeasonProfile playerId={playerId} honors={honors} />}
      {tab === 'career' && <CareerTable playerId={playerId} />}
      {tab === 'playoffs' && <PlayoffTable playerId={playerId} />}
      {tab === 'honors' && <HonorShelf honors={honors} />}
    </>
  )
}
