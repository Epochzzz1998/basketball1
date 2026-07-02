import { useEffect, useState } from 'react'
import { Button, Card, Col, Empty, Progress, Row, Select, Space, Spin, Table, Tabs, Tag } from 'antd'
import { TrophyFilled } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import AllPlayerSeasonStats from './AllPlayerSeasonStats'
import { teamApi } from '../../api/team'
import { NBA_TEAM_NAMES, PLAYOFF_TAG, fmtNum, playoffRecord, seasonOptions, seasonYearLabel, teamRegion } from './rankConfig'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

/* ============ Tab 2：赛季概览 ============ */

// 全队数据卡（失分/失误按"最少"排名；净胜分为派生值，带正负色）
const netOf = (r) => Number(r.pts) - Number(r.ptsAllowed)
const TEAM_STATS = [
  { key: 'pts', label: '场均得分' },
  { key: 'ptsAllowed', label: '场均失分', asc: true, note: '按最少排' },
  { key: 'net', label: '场均净胜', get: netOf, signed: true },
  { key: 'reb', label: '篮板' },
  { key: 'ast', label: '助攻' },
  { key: 'stl', label: '抢断' },
  { key: 'blk', label: '盖帽' },
  { key: 'tov', label: '失误', asc: true, note: '按最少排' },
]

function RankBadge({ rank, prefix = '联盟第' }) {
  const color = rank <= 3 ? MEDAL[rank - 1] : '#999'
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, background: rank <= 3 ? 'rgba(250,84,28,.08)' : '#f5f5f5', padding: '2px 8px', borderRadius: 10 }}>
      {prefix} {rank}
    </span>
  )
}

function SeasonOverview({ teamCode }) {
  const [seasonNum, setSeasonNum] = useState(1)
  const [rows, setRows] = useState(null) // 全联盟 30 队（该赛季），用来算名次

  useEffect(() => {
    let alive = true
    setRows(null)
    teamApi.rankings(seasonNum)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum])

  const me = rows?.find((r) => r.teamCode === teamCode)
  const { conf } = teamRegion(teamCode)

  const rankOf = (stat) => {
    if (!rows || !me) return '-'
    const val = (r) => (stat.get ? stat.get(r) : Number(r[stat.key]))
    return 1 + rows.filter((r) => (stat.asc ? val(r) < val(me) : val(r) > val(me))).length
  }
  const winRankLeague = () => (rows && me ? 1 + rows.filter((r) => r.wins > me.wins).length : '-')
  const winRankConf = () => {
    if (!rows || !me || !conf) return '-'
    const confTeams = rows.filter((r) => teamRegion(r.teamCode).conf === conf)
    return 1 + confTeams.filter((r) => r.wins > me.wins).length
  }

  const seasonSelect = (
    <Space>
      赛季：
      <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions.filter((o) => o.value !== 50)} style={{ width: 170 }} />
    </Space>
  )

  if (rows === null) return <Card extra={seasonSelect} title="赛季概览"><Spin style={{ display: 'block', margin: '40px auto' }} /></Card>
  if (!me) return <Card extra={seasonSelect} title="赛季概览"><Empty description="该赛季暂无本队数据" /></Card>

  const winRate = me.wins + me.losses ? me.wins / (me.wins + me.losses) : 0

  return (
    <>
      <Row gutter={[16, 16]}>
        {/* 战绩卡 */}
        <Col xs={24} lg={9}>
          <Card
            title={`${seasonYearLabel(seasonNum)} 战绩`}
            extra={seasonSelect}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Space size={28} align="center" wrap>
              <Progress
                type="circle"
                size={110}
                percent={Math.round(winRate * 100)}
                strokeColor="#fa541c"
                format={(p) => (
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{p}%</div>
                    <div style={{ fontSize: 11, color: '#999' }}>胜率</div>
                  </div>
                )}
              />
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {me.wins} <span style={{ color: '#bbb', fontSize: 20 }}>胜</span>{' '}
                  {me.losses} <span style={{ color: '#bbb', fontSize: 20 }}>负</span>
                </div>
                <Space size={6} wrap style={{ marginTop: 10 }}>
                  <Tag color="orange">联盟第 {winRankLeague()}</Tag>
                  {conf && <Tag>{conf}第 {winRankConf()}</Tag>}
                </Space>
                <div style={{ marginTop: 10 }}>
                  <span style={{ color: '#888', marginRight: 8 }}>季后赛</span>
                  <Tag color={PLAYOFF_TAG[me.playoffResult] || 'default'}>
                    {me.playoffResult === '总冠军' && <TrophyFilled style={{ marginRight: 4 }} />}
                    {me.playoffResult || '-'}
                  </Tag>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
        {/* 六项数据卡 */}
        <Col xs={24} lg={15}>
          <Row gutter={[12, 12]}>
            {TEAM_STATS.map((s) => {
              const rank = rankOf(s)
              const val = s.get ? s.get(me) : Number(me[s.key])
              const display = s.signed ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}` : fmtNum(val)
              const color = s.signed ? (val >= 0 ? '#3f8600' : '#cf1322') : '#fa541c'
              return (
                <Col key={s.key} xs={12} sm={6}>
                  <Card styles={{ body: { padding: '14px 16px' } }}>
                    <div style={{ color: '#888', fontSize: 13 }}>
                      {s.label}
                      {s.note && <span style={{ marginLeft: 6, fontSize: 11, color: '#bbb' }}>{s.note}</span>}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color, margin: '2px 0 6px', fontVariantNumeric: 'tabular-nums' }}>
                      {display}
                    </div>
                    <RankBadge rank={rank} />
                  </Card>
                </Col>
              )
            })}
          </Row>
        </Col>
      </Row>
    </>
  )
}

/* ============ 季后赛：赛季概况 ============ */

const PLAYOFF_STATS = [
  { key: 'pts', label: '场均得分' },
  { key: 'ptsAllowed', label: '场均失分', asc: true, note: '按最少排' },
  { key: 'net', label: '场均净胜', get: netOf, signed: true },
  { key: 'reb', label: '篮板' },
  { key: 'ast', label: '助攻' },
  { key: 'stl', label: '抢断' },
  { key: 'blk', label: '盖帽' },
  { key: 'tov', label: '失误', asc: true, note: '按最少排' },
]

function PlayoffOverview({ teamCode }) {
  const [seasonNum, setSeasonNum] = useState(1)
  const [rows, setRows] = useState(null) // 该季 16 支季后赛球队

  useEffect(() => {
    let alive = true
    setRows(null)
    teamApi.playoffRankings(seasonNum)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum])

  const me = rows?.find((r) => r.teamCode === teamCode)
  const rankOf = (stat) => {
    if (!rows || !me) return '-'
    const val = (r) => (stat.get ? stat.get(r) : Number(r[stat.key]))
    return 1 + rows.filter((r) => (stat.asc ? val(r) < val(me) : val(r) > val(me))).length
  }
  const seasonSelect = (
    <Space>
      赛季：
      <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions.filter((o) => o.value !== 50)} style={{ width: 170 }} />
    </Space>
  )

  if (rows === null) return <Card extra={seasonSelect} title="季后赛概况"><Spin style={{ display: 'block', margin: '40px auto' }} /></Card>
  if (!me) return <Card extra={seasonSelect} title="季后赛概况"><Empty description="该赛季未进季后赛" /></Card>

  return (
    <Row gutter={[16, 16]}>
      {/* 战报卡 */}
      <Col xs={24} lg={9}>
        <Card title={`${seasonYearLabel(seasonNum)} 季后赛战报`} extra={seasonSelect} styles={{ body: { padding: '20px 24px' } }}>
          {(() => {
            const rec = playoffRecord(me.playoffResult, me.games)
            const winRate = rec && me.games ? rec.wins / me.games : 0
            const isChamp = me.playoffResult === '总冠军'
            return (
              <Space size={28} align="center" wrap>
                <Progress
                  type="circle"
                  size={110}
                  percent={Math.round(winRate * 100)}
                  strokeColor={isChamp ? '#d4a017' : '#fa541c'}
                  format={(p) => (
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{p}%</div>
                      <div style={{ fontSize: 11, color: '#999' }}>季后赛胜率</div>
                    </div>
                  )}
                />
                <div>
                  <Tag color={PLAYOFF_TAG[me.playoffResult] || 'default'} style={{ fontSize: 16, padding: '4px 14px', lineHeight: 1.6 }}>
                    {isChamp && <TrophyFilled style={{ marginRight: 6 }} />}
                    {me.playoffResult}
                  </Tag>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
                    {rec ? (
                      <>
                        {rec.wins} <span style={{ color: '#bbb', fontSize: 18 }}>胜</span>{' '}
                        {rec.losses} <span style={{ color: '#bbb', fontSize: 18 }}>负</span>
                      </>
                    ) : '-'}
                    <span style={{ color: '#999', fontSize: 13, marginLeft: 10 }}>出战 {me.games ?? '-'} 场</span>
                  </div>
                  <div style={{ marginTop: 6, color: '#999', fontSize: 12 }}>数据排名基于当季 {rows.length} 支季后赛球队</div>
                </div>
              </Space>
            )
          })()}
        </Card>
      </Col>
      {/* 八项数据卡（季后赛内排名，失分/净胜含在内） */}
      <Col xs={24} lg={15}>
        <Row gutter={[12, 12]}>
          {PLAYOFF_STATS.map((s) => {
            const rank = rankOf(s)
            const val = s.get ? s.get(me) : Number(me[s.key])
            const display = s.signed ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}` : fmtNum(val)
            const color = s.signed ? (val >= 0 ? '#3f8600' : '#cf1322') : '#fa541c'
            return (
              <Col key={s.key} xs={12} sm={6}>
                <Card styles={{ body: { padding: '14px 16px' } }}>
                  <div style={{ color: '#888', fontSize: 13 }}>
                    {s.label}
                    {s.note && <span style={{ marginLeft: 6, fontSize: 11, color: '#bbb' }}>{s.note}</span>}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color, margin: '2px 0 6px', fontVariantNumeric: 'tabular-nums' }}>
                    {display}
                  </div>
                  <RankBadge rank={rank} prefix="季后赛第" />
                </Card>
              </Col>
            )
          })}
        </Row>
      </Col>
    </Row>
  )
}

/* ============ 季后赛：球队历史 ============ */

function PlayoffHistory({ teamCode }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    teamApi.playoffHistory(teamCode)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [teamCode])

  if (rows === null) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  if (!rows.length) return <Empty description="队史从未打进季后赛" />

  const champs = rows.filter((r) => r.playoffResult === '总冠军').length
  const finals = rows.filter((r) => ['总冠军', '总决赛'].includes(r.playoffResult)).length

  const numCol = (title, key) => ({
    title, dataIndex: key, width: 90, align: 'right',
    sorter: (a, b) => Number(a[key]) - Number(b[key]),
    render: (v) => fmtNum(v),
  })

  const columns = [
    {
      title: '赛季', dataIndex: 'seasonNum', width: 150, fixed: 'left',
      sorter: (a, b) => a.seasonNum - b.seasonNum, defaultSortOrder: 'descend',
      render: (v) => seasonYearLabel(v),
    },
    {
      title: '成绩', dataIndex: 'playoffResult', width: 110,
      render: (v) => (
        <Tag color={PLAYOFF_TAG[v] || 'default'}>
          {v === '总冠军' && <TrophyFilled style={{ marginRight: 4 }} />}
          {v}
        </Tag>
      ),
    },
    {
      title: '战绩', width: 80, align: 'right',
      sorter: (a, b) => (playoffRecord(a.playoffResult, a.games)?.wins ?? 0) - (playoffRecord(b.playoffResult, b.games)?.wins ?? 0),
      render: (_, r) => {
        const rec = playoffRecord(r.playoffResult, r.games)
        return rec ? <b>{rec.wins}-{rec.losses}</b> : '-'
      },
    },
    { title: '出战', dataIndex: 'games', width: 70, align: 'right', sorter: (a, b) => a.games - b.games },
    numCol('场均得分', 'pts'),
    numCol('场均失分', 'ptsAllowed'),
    {
      title: '净胜分', width: 84, align: 'right',
      sorter: (a, b) => (a.pts - a.ptsAllowed) - (b.pts - b.ptsAllowed),
      render: (_, r) => {
        const d = Number(r.pts) - Number(r.ptsAllowed)
        return <span style={{ fontWeight: 600, color: d >= 0 ? '#3f8600' : '#cf1322' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span>
      },
    },
    numCol('篮板', 'reb'),
    numCol('助攻', 'ast'),
    numCol('抢断', 'stl'),
    numCol('盖帽', 'blk'),
    numCol('失误', 'tov'),
  ]

  return (
    <Card
      title="季后赛历史"
      extra={
        <Space size={8} wrap>
          <Tag color="geekblue">季后赛 ×{rows.length}</Tag>
          <Tag color="volcano">总决赛 ×{finals}</Tag>
          <Tag color="gold"><TrophyFilled /> 总冠军 ×{champs}</Tag>
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Table rowKey="seasonNum" dataSource={rows} columns={columns} pagination={false} scroll={{ x: 1000 }} size="middle" />
    </Card>
  )
}

/* ============ 常规赛：球队历史 ============ */

function TeamHistory({ teamCode }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    teamApi.history(teamCode)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [teamCode])

  if (rows === null) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  if (!rows.length) return <Empty description="暂无队史数据" />

  const totalW = rows.reduce((s, r) => s + r.wins, 0)
  const totalL = rows.reduce((s, r) => s + r.losses, 0)
  const champs = rows.filter((r) => r.playoffResult === '总冠军').length
  const playoffs = rows.filter((r) => r.playoffResult && r.playoffResult !== '未进季后赛').length

  const numCol = (title, key) => ({
    title, dataIndex: key, width: 90, align: 'right',
    sorter: (a, b) => Number(a[key]) - Number(b[key]),
    render: (v) => fmtNum(v),
  })

  const columns = [
    {
      title: '赛季', dataIndex: 'seasonNum', width: 150, fixed: 'left',
      sorter: (a, b) => a.seasonNum - b.seasonNum, defaultSortOrder: 'descend',
      render: (v) => seasonYearLabel(v),
    },
    { title: '胜', dataIndex: 'wins', width: 60, align: 'right', sorter: (a, b) => a.wins - b.wins },
    { title: '负', dataIndex: 'losses', width: 60, align: 'right', sorter: (a, b) => a.losses - b.losses },
    {
      title: '胜率', width: 80, align: 'right',
      sorter: (a, b) => a.wins / (a.wins + a.losses) - b.wins / (b.wins + b.losses),
      render: (_, r) => `${((r.wins / (r.wins + r.losses)) * 100).toFixed(1)}%`,
    },
    {
      title: '季后赛', dataIndex: 'playoffResult', width: 110,
      render: (v) => (
        <Tag color={PLAYOFF_TAG[v] || 'default'}>
          {v === '总冠军' && <TrophyFilled style={{ marginRight: 4 }} />}
          {v || '-'}
        </Tag>
      ),
    },
    numCol('场均得分', 'pts'),
    numCol('场均失分', 'ptsAllowed'),
    {
      title: '净胜分', width: 84, align: 'right',
      sorter: (a, b) => (a.pts - a.ptsAllowed) - (b.pts - b.ptsAllowed),
      render: (_, r) => {
        const d = Number(r.pts) - Number(r.ptsAllowed)
        return <span style={{ fontWeight: 600, color: d >= 0 ? '#3f8600' : '#cf1322' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span>
      },
    },
    numCol('篮板', 'reb'),
    numCol('助攻', 'ast'),
    numCol('抢断', 'stl'),
    numCol('盖帽', 'blk'),
    numCol('失误', 'tov'),
  ]

  return (
    <Card
      title="球队历史"
      extra={
        <Space size={8} wrap>
          <Tag>队史 {rows.length} 个赛季</Tag>
          <Tag color="orange">总战绩 {totalW}-{totalL}（{((totalW / (totalW + totalL)) * 100).toFixed(1)}%）</Tag>
          <Tag color="geekblue">季后赛 ×{playoffs}</Tag>
          <Tag color="gold"><TrophyFilled /> 总冠军 ×{champs}</Tag>
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Table rowKey="seasonNum" dataSource={rows} columns={columns} pagination={false} scroll={{ x: 1240 }} size="middle" />
    </Card>
  )
}

/* ============ 页面 ============ */

/** 球队主页（/players/team/:teamCode）：球员数据 / 赛季概览 / 球队历史 */
export default function TeamPlayers() {
  const { teamCode } = useParams()
  const navigate = useNavigate()
  const { conf, div } = teamRegion(teamCode)

  return (
    <>
      <Button style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>← 返回</Button>
      {/* 球队身份头 */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '18px 24px' } }}>
        <Space size={16} align="center">
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(250,84,28,.1)', color: '#fa541c',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18,
            }}
          >
            {teamCode}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{NBA_TEAM_NAMES[teamCode] || teamCode}</div>
            <div style={{ color: '#999', fontSize: 13 }}>{conf && div ? `${conf} · ${div}` : teamCode}</div>
          </div>
        </Space>
      </Card>
      <Tabs
        defaultActiveKey="players"
        items={[
          { key: 'players', label: '球员数据', children: <AllPlayerSeasonStats team={teamCode} /> },
          {
            key: 'regular',
            label: '常规赛',
            children: (
              <Tabs
                defaultActiveKey="season"
                items={[
                  { key: 'season', label: '赛季概况', children: <SeasonOverview teamCode={teamCode} /> },
                  { key: 'history', label: '球队历史', children: <TeamHistory teamCode={teamCode} /> },
                ]}
              />
            ),
          },
          {
            key: 'playoffs',
            label: '季后赛',
            children: (
              <Tabs
                defaultActiveKey="season"
                items={[
                  { key: 'season', label: '赛季概况', children: <PlayoffOverview teamCode={teamCode} /> },
                  { key: 'history', label: '球队历史', children: <PlayoffHistory teamCode={teamCode} /> },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  )
}
