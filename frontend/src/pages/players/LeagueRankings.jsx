import { useEffect, useState } from 'react'
import { Badge, Card, Col, Empty, Row, Segmented, Select, Space, Table, Tag } from 'antd'
import { CrownOutlined, OrderedListOutlined, TeamOutlined } from '@ant-design/icons'
import PillTabs from '../../components/PillTabs'
import { Link, useNavigate } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { teamApi } from '../../api/team'
import { HONOR_GROUPS } from './honorConfig'
import { NBA_STRUCTURE, NBA_TEAM_NAMES, PLAYOFF_TAG, RANKING_STATS, fmtNum, playoffRecord } from './rankConfig'
import SeasonPicker from '../../components/SeasonPicker'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333'] // 金 / 银 / 铜

/* ============ Tab 1：单项排行 ============ */

function StatRankCard({ stat, seasonNum, stage }) {
  const [rows, setRows] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    setRows(null)
    const api = stage === 'po' ? playerApi.listPlayoffSeasonStats : playerApi.listSeasonStats
    api({ page: 1, limit: 10, seasonNum, field: stat.field, order: stat.order || 'desc' })
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [stat.field, stat.order, seasonNum, stage])

  return (
    <Card
      title={
        <>
          {stat.label}榜
          {stat.note && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#999' }}>{stat.note}</span>}
        </>
      }
      extra={<a onClick={() => navigate(`/rankings/${stat.field}?seasonNum=${seasonNum}&stage=${stage}`)}>完整排行 →</a>}
      loading={rows === null}
      styles={{ body: { padding: '8px 20px' } }}
    >
      {rows?.length ? (
        rows.map((r, i) => (
          <div
            key={r.statsId}
            style={{
              display: 'flex', alignItems: 'center', padding: '8px 0',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid #f5f5f5',
            }}
          >
            <span style={{ width: 28, fontWeight: 700, fontStyle: 'italic', fontSize: i < 3 ? 16 : 14, color: i < 3 ? MEDAL[i] : '#bbb' }}>
              {i + 1}
            </span>
            <Link to={`/players/${r.playerId}`} style={{ flex: 1, fontWeight: i < 3 ? 600 : 400 }}>
              {r.playerName}
            </Link>
            <span style={{ color: '#999', fontSize: 12, marginRight: 14 }}>{r.playerTeam}</span>
            <span style={{ fontWeight: 700, color: '#fa541c', fontVariantNumeric: 'tabular-nums' }}>
              {fmtNum(r[stat.field], stat.digits)}
            </span>
          </div>
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该赛季暂无数据" />
      )}
    </Card>
  )
}

function StatsTab({ seasonNum, stage }) {
  return (
    <Row gutter={[16, 16]}>
      {RANKING_STATS.map((s) => (
        <Col key={s.field} xs={24} sm={12} lg={8}>
          <StatRankCard stat={s} seasonNum={seasonNum} stage={stage} />
        </Col>
      ))}
    </Row>
  )
}

/* ============ Tab 2：赛季荣誉 ============ */

function HonorCard({ group, rows, seasonNum }) {
  const navigate = useNavigate()
  const members = group.pick(rows)
  return (
    <Card
      title={
        <>
          {group.title}
          {group.note && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#999' }}>{group.note}</span>}
        </>
      }
      extra={<a onClick={() => navigate(`/rankings/honors/${group.key}?seasonNum=${seasonNum}`)}>完整数据 →</a>}
      styles={{ body: { padding: '8px 20px' } }}
    >
      {members.length ? (
        members.map((r, i) => (
          <div
            key={r.statsId}
            style={{
              display: 'flex', alignItems: 'center', padding: '8px 0',
              borderBottom: i === members.length - 1 ? 'none' : '1px solid #f5f5f5',
            }}
          >
            <span style={{ width: 30, fontWeight: 700, fontStyle: 'italic', fontSize: i < 3 ? 15 : 13, color: i < 3 ? MEDAL[i] : '#bbb' }}>
              {group.rankOf(r)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/players/${r.playerId}`} style={{ fontWeight: i < 3 ? 600 : 400 }}>{r.playerName}</Link>
              <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{r.playerTeam} · {r.playerPosition}</span>
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>{group.sub(r)}</div>
            </div>
          </div>
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该赛季暂无数据" />
      )}
    </Card>
  )
}

// 特别奖卡：MVP / DPOY（取自当季名次第 1）+ FMVP / 最佳第六人 / 最快进步球员（season_award）
const SPECIAL_AWARDS = {
  mvp: { label: '常规赛 MVP', icon: '👑', gold: true },
  dpoy: { label: '最佳防守球员', icon: '🛡️', gold: true },
  fmvp: { label: '总决赛 FMVP', icon: '🏅', gold: true },
  smoy: { label: '最佳第六人', icon: '🪑' },
  mip: { label: '最快进步球员', icon: '📈' },
}

function SpecialAwardCards({ seasonNum, rows }) {
  const [awards, setAwards] = useState(null) // fmvp/smoy/mip 来自后端 season_award

  useEffect(() => {
    let alive = true
    setAwards(null)
    playerApi.seasonAwards(seasonNum)
      .then((r) => { if (alive) setAwards(r || []) })
      .catch(() => { if (alive) setAwards([]) })
    return () => { alive = false }
  }, [seasonNum])

  const off = (p, r, a) => `${fmtNum(p)}分 ${fmtNum(r)}板 ${fmtNum(a)}助`
  const gray = { color: '#8c8c8c', fontSize: 12 }

  const entries = []
  const mvpRow = rows?.find((r) => r.mvpRank === 1)
  if (mvpRow) {
    entries.push({
      key: 'mvp', playerId: mvpRow.playerId, playerName: mvpRow.playerName, playerTeam: mvpRow.playerTeam,
      lines: [<div key="l" style={gray}>{off(mvpRow.playerAvgScore, mvpRow.playerAvgReb, mvpRow.playerAvgAss)}</div>],
    })
  }
  const dpoyRow = rows?.find((r) => r.dpoyRank === 1)
  if (dpoyRow) {
    entries.push({
      key: 'dpoy', playerId: dpoyRow.playerId, playerName: dpoyRow.playerName, playerTeam: dpoyRow.playerTeam,
      lines: [<div key="l" style={gray}>{fmtNum(dpoyRow.playerAvgSteal)}断 {fmtNum(dpoyRow.playerAvgBlock)}帽 {fmtNum(dpoyRow.playerAvgReb)}板</div>],
    })
  }
  for (const key of ['fmvp', 'smoy', 'mip']) {
    const w = awards?.find((r) => r.award === key)
    if (!w) continue
    const lines = key === 'fmvp'
      ? [
          <div key="a" style={gray}>常规赛 {off(w.pts, w.reb, w.ast)}</div>,
          <div key="b" style={{ color: '#d48806', fontSize: 12, fontWeight: 600 }}>季后赛 {off(w.poPts, w.poReb, w.poAst)}</div>,
        ]
      : key === 'mip'
        ? [
            <div key="a" style={gray}>上季 {off(w.prevPts, w.prevReb, w.prevAst)}</div>,
            <div key="b" style={{ color: '#3f8600', fontSize: 12, fontWeight: 600 }}>
              本季 {off(w.pts, w.reb, w.ast)}
              {w.prevPts != null && w.pts != null && (
                <span style={{ marginLeft: 6 }}>↑ +{(Number(w.pts) - Number(w.prevPts)).toFixed(1)}分</span>
              )}
            </div>,
          ]
        : [<div key="l" style={gray}>{off(w.pts, w.reb, w.ast)}</div>]
    entries.push({ key, playerId: w.playerId, playerName: w.playerName, playerTeam: w.playerTeam, lines })
  }

  if (!entries.length) return null
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {entries.map((e) => {
        const meta = SPECIAL_AWARDS[e.key]
        return (
          <Col key={e.key} xs={24} sm={12} lg={8}>
            <Card
              style={meta.gold ? { background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)', border: '1px solid #ffe58f' } : undefined}
              styles={{ body: { padding: '14px 18px' } }}
            >
              <Space align="center" size={14}>
                <span style={{ fontSize: 30, lineHeight: 1 }}>{meta.icon}</span>
                <div>
                  <div style={{ color: '#888', fontSize: 12 }}>{meta.label}</div>
                  <Link to={`/players/${e.playerId}`} style={{ fontWeight: 700, fontSize: 16 }}>{e.playerName}</Link>
                  <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{e.playerTeam}</span>
                  {e.lines}
                </div>
              </Space>
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}

function HonorsTab({ seasonNum }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum])

  if (rows === null) return <Card loading style={{ minHeight: 240 }} />
  return (
    <>
      <SpecialAwardCards seasonNum={seasonNum} rows={rows} />
      <Row gutter={[16, 16]}>
        {HONOR_GROUPS.map((g) => (
          <Col key={g.key} xs={24} sm={g.span === 12 ? 24 : 12} lg={g.span}>
            <HonorCard group={g} rows={rows} seasonNum={seasonNum} />
          </Col>
        ))}
      </Row>
    </>
  )
}

/* ============ Tab 3：球队排行 ============ */

const SCOPES = [
  { value: 'all', label: '全联盟' },
  { value: '东部', label: '东部' },
  { value: '西部', label: '西部' },
  ...Object.entries(NBA_STRUCTURE).flatMap(([, divs]) => Object.keys(divs).map((d) => ({ value: d, label: d }))),
]

function teamsInScope(scope) {
  if (scope === 'all') return null
  if (NBA_STRUCTURE[scope]) return Object.values(NBA_STRUCTURE[scope]).flat()
  for (const divs of Object.values(NBA_STRUCTURE)) {
    if (divs[scope]) return divs[scope]
  }
  return null
}

const TIER = { 总冠军: 0, 总决赛: 1, 分区决赛: 2, 半决赛: 3, 首轮: 4 }

function TeamsTab({ seasonNum, stage }) {
  const [rows, setRows] = useState(null)
  const [scope, setScope] = useState('all')
  const po = stage === 'po'

  useEffect(() => {
    let alive = true
    setRows(null)
    const api = po ? teamApi.playoffRankings : teamApi.rankings
    api(seasonNum)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum, po])

  const filtered = (rows || []).filter((r) => !teamsInScope(scope) || teamsInScope(scope).includes(r.teamCode))
  const list = po
    ? [...filtered].sort((a, b) =>
        (TIER[a.playoffResult] ?? 9) - (TIER[b.playoffResult] ?? 9)
        || (b.pts - b.ptsAllowed) - (a.pts - a.ptsAllowed))
    : filtered.map((r) => ({ ...r, winRate: r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0 }))

  const numCol = (title, key, d = 1) => ({
    title, dataIndex: key, width: 90, align: 'right',
    sorter: (a, b) => Number(a[key]) - Number(b[key]),
    render: (v) => fmtNum(v, d),
  })
  const netCol = {
    title: '净胜分', width: 84, align: 'right',
    sorter: (a, b) => (a.pts - a.ptsAllowed) - (b.pts - b.ptsAllowed),
    render: (_, r) => {
      const d = Number(r.pts) - Number(r.ptsAllowed)
      return <span style={{ fontWeight: 600, color: d >= 0 ? '#3f8600' : '#cf1322' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span>
    },
  }
  const rankCol = {
    title: '排名', width: 60, fixed: 'left',
    render: (_, __, i) => (
      <span style={{ fontWeight: 700, fontStyle: 'italic', color: i < 3 ? MEDAL[i] : '#bbb' }}>{i + 1}</span>
    ),
  }
  const teamCol = {
    title: '球队', dataIndex: 'teamCode', width: 140, fixed: 'left',
    render: (code) => (
      <Space size={6}>
        <Link to={`/players/team/${code}`}><b>{NBA_TEAM_NAMES[code] || code}</b></Link>
        <span style={{ color: '#999', fontSize: 12 }}>{code}</span>
      </Space>
    ),
  }
  const resultCol = {
    title: po ? '成绩' : '季后赛', dataIndex: 'playoffResult', width: 110,
    render: (v) => <Tag color={PLAYOFF_TAG[v] || 'default'}>{v || '-'}</Tag>,
  }

  const poRecordCol = {
    title: '战绩', width: 80, align: 'right',
    sorter: (a, b) => (playoffRecord(a.playoffResult, a.games)?.wins ?? 0) - (playoffRecord(b.playoffResult, b.games)?.wins ?? 0),
    render: (_, r) => {
      const rec = playoffRecord(r.playoffResult, r.games)
      return rec ? <b>{rec.wins}-{rec.losses}</b> : '-'
    },
  }

  const columns = po
    ? [
        rankCol, teamCol, resultCol, poRecordCol,
        { title: '出战', dataIndex: 'games', width: 70, align: 'right', sorter: (a, b) => a.games - b.games },
        numCol('场均得分', 'pts'), numCol('场均失分', 'ptsAllowed'), netCol,
        numCol('篮板', 'reb'), numCol('助攻', 'ast'), numCol('抢断', 'stl'), numCol('盖帽', 'blk'), numCol('失误', 'tov'),
      ]
    : [
        rankCol, teamCol,
        { title: '胜', dataIndex: 'wins', width: 60, align: 'right', sorter: (a, b) => a.wins - b.wins },
        { title: '负', dataIndex: 'losses', width: 60, align: 'right', sorter: (a, b) => a.losses - b.losses },
        {
          title: '胜率', dataIndex: 'winRate', width: 80, align: 'right',
          sorter: (a, b) => a.winRate - b.winRate,
          render: (v) => `${(v * 100).toFixed(1)}%`,
        },
        resultCol,
        numCol('场均得分', 'pts'), numCol('场均失分', 'ptsAllowed'), netCol,
        numCol('篮板', 'reb'), numCol('助攻', 'ast'), numCol('抢断', 'stl'), numCol('盖帽', 'blk'), numCol('失误', 'tov'),
      ]

  return (
    <Card styles={{ body: { padding: '4px 12px 12px' } }}>
      <div style={{ padding: '10px 8px 14px' }}>
        <Space size="middle">
          范围：
          <Select value={scope} onChange={setScope} options={SCOPES} style={{ width: 140 }} />
          <Badge
            status="processing"
            text={<span style={{ color: '#888', fontSize: 12 }}>
              {po ? '仅当季 16 支季后赛球队，按轮次+净胜排序' : '点击表头可按数据排序'}；点球队名看本队球员
            </span>}
          />
        </Space>
      </div>
      <Table
        className="clean-table"
        rowKey="teamCode"
        loading={rows === null}
        dataSource={list}
        columns={columns}
        pagination={false}
        scroll={{ x: 1290 }}
        size="middle"
      />
    </Card>
  )
}

/* ============ 页面 ============ */

/** 联盟排行：单项排行 / 赛季荣誉 / 球队排行 三个 Tab，共用赛季选择 + 常规赛/季后赛切换 */
export default function LeagueRankings() {
  const [seasonNum, setSeasonNum] = useState(1) // 默认第一赛季（2008-2009）
  const [stage, setStage] = useState('reg') // reg=常规赛 po=季后赛（作用于单项/球队排行；荣誉为全季评选）
  const [tab, setTab] = useState('stats')

  return (
    <>
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '14px 20px' } }}>
        <Space size="middle" wrap>
          <span style={{ fontSize: 16, fontWeight: 600 }}>联盟排行</span>
          <Segmented
            value={stage}
            onChange={(v) => {
              setStage(v)
              if (v === 'po' && tab === 'honors') {
                setTab('stats') // 荣誉 Tab 在季后赛模式下不存在，跳回单项排行
              }
            }}
            options={[{ label: '常规赛', value: 'reg' }, { label: '季后赛', value: 'po' }]}
          />
          <SeasonPicker value={seasonNum} onChange={setSeasonNum} />
        </Space>
      </Card>
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'stats', icon: <OrderedListOutlined />, label: '单项排行' },
          // 荣誉是全季评选（FMVP 已含），季后赛模式下不显示该 Tab
          ...(stage === 'po' ? [] : [{ value: 'honors', icon: <CrownOutlined />, label: '赛季荣誉' }]),
          { value: 'teams', icon: <TeamOutlined />, label: '球队排行' },
        ]}
      />
      {tab === 'stats' && <StatsTab seasonNum={seasonNum} stage={stage} />}
      {tab === 'honors' && stage !== 'po' && <HonorsTab seasonNum={seasonNum} />}
      {tab === 'teams' && <TeamsTab seasonNum={seasonNum} stage={stage} />}
    </>
  )
}
