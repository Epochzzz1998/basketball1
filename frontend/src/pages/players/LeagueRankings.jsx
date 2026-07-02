import { useEffect, useState } from 'react'
import { Badge, Card, Col, Empty, Row, Select, Space, Table, Tabs, Tag } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { teamApi } from '../../api/team'
import { HONOR_GROUPS } from './honorConfig'
import { NBA_STRUCTURE, NBA_TEAM_NAMES, RANKING_STATS, fmtNum, seasonOptions } from './rankConfig'

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333'] // 金 / 银 / 铜

/* ============ Tab 1：单项排行 ============ */

function StatRankCard({ stat, seasonNum }) {
  const [rows, setRows] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.listSeasonStats({ page: 1, limit: 10, seasonNum, field: stat.field, order: stat.order || 'desc' })
      .then((r) => { if (alive) setRows(r.records || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [stat.field, stat.order, seasonNum])

  return (
    <Card
      title={
        <>
          {stat.label}榜
          {stat.note && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#999' }}>{stat.note}</span>}
        </>
      }
      extra={<a onClick={() => navigate(`/rankings/${stat.field}?seasonNum=${seasonNum}`)}>完整排行 →</a>}
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

function StatsTab({ seasonNum }) {
  return (
    <Row gutter={[16, 16]}>
      {RANKING_STATS.map((s) => (
        <Col key={s.field} xs={24} sm={12} lg={8}>
          <StatRankCard stat={s} seasonNum={seasonNum} />
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
    <Row gutter={[16, 16]}>
      {HONOR_GROUPS.map((g) => (
        <Col key={g.key} xs={24} sm={g.span === 12 ? 24 : 12} lg={g.span}>
          <HonorCard group={g} rows={rows} seasonNum={seasonNum} />
        </Col>
      ))}
    </Row>
  )
}

/* ============ Tab 3：球队排行 ============ */

const PLAYOFF_TAG = {
  总冠军: 'gold', 总决赛: 'volcano', 分区决赛: 'purple', 半决赛: 'geekblue', 首轮: 'cyan', 未进季后赛: 'default',
}
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

function TeamsTab({ seasonNum }) {
  const [rows, setRows] = useState(null)
  const [scope, setScope] = useState('all')

  useEffect(() => {
    let alive = true
    setRows(null)
    teamApi.rankings(seasonNum)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [seasonNum])

  const list = (rows || [])
    .filter((r) => !teamsInScope(scope) || teamsInScope(scope).includes(r.teamCode))
    .map((r, i) => ({ ...r, rank: i + 1, winRate: r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0 }))

  const numCol = (title, key, d = 1) => ({
    title, dataIndex: key, width: 90, align: 'right',
    sorter: (a, b) => Number(a[key]) - Number(b[key]),
    render: (v) => fmtNum(v, d),
  })

  const columns = [
    {
      title: '排名', width: 60, fixed: 'left',
      render: (_, __, i) => (
        <span style={{ fontWeight: 700, fontStyle: 'italic', color: i < 3 ? MEDAL[i] : '#bbb' }}>{i + 1}</span>
      ),
    },
    {
      title: '球队', dataIndex: 'teamCode', width: 140, fixed: 'left',
      render: (code) => (
        <Space size={6}>
          <Link to={`/players/team/${code}`}><b>{NBA_TEAM_NAMES[code] || code}</b></Link>
          <span style={{ color: '#999', fontSize: 12 }}>{code}</span>
        </Space>
      ),
    },
    { title: '胜', dataIndex: 'wins', width: 60, align: 'right', sorter: (a, b) => a.wins - b.wins },
    { title: '负', dataIndex: 'losses', width: 60, align: 'right', sorter: (a, b) => a.losses - b.losses },
    {
      title: '胜率', dataIndex: 'winRate', width: 80, align: 'right',
      sorter: (a, b) => a.winRate - b.winRate,
      render: (v) => `${(v * 100).toFixed(1)}%`,
    },
    {
      title: '季后赛', dataIndex: 'playoffResult', width: 110,
      render: (v) => <Tag color={PLAYOFF_TAG[v] || 'default'}>{v || '-'}</Tag>,
    },
    numCol('场均得分', 'pts'),
    numCol('篮板', 'reb'),
    numCol('助攻', 'ast'),
    numCol('抢断', 'stl'),
    numCol('盖帽', 'blk'),
    numCol('失误', 'tov'),
  ]

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '14px 20px' }}>
        <Space size="middle">
          范围：
          <Select value={scope} onChange={setScope} options={SCOPES} style={{ width: 140 }} />
          <Badge status="processing" text={<span style={{ color: '#888', fontSize: 12 }}>点击表头可按数据排序；点球队名看本队球员</span>} />
        </Space>
      </div>
      <Table
        rowKey="teamCode"
        loading={rows === null}
        dataSource={list}
        columns={columns}
        pagination={false}
        scroll={{ x: 1100 }}
        size="middle"
      />
    </Card>
  )
}

/* ============ 页面 ============ */

/** 联盟排行：单项排行 / 赛季荣誉 / 球队排行 三个 Tab，共用赛季选择 */
export default function LeagueRankings() {
  const [seasonNum, setSeasonNum] = useState(1) // 默认第一赛季（2008-2009）
  const [tab, setTab] = useState('stats')

  return (
    <>
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '14px 20px' } }}>
        <Space size="middle" wrap>
          <span style={{ fontSize: 16, fontWeight: 600 }}>联盟排行</span>
          <span>
            赛季：
            <Select value={seasonNum} onChange={setSeasonNum} options={seasonOptions} style={{ width: 170 }} />
          </span>
        </Space>
      </Card>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'stats', label: '单项排行', children: <StatsTab seasonNum={seasonNum} /> },
          { key: 'honors', label: '赛季荣誉', children: <HonorsTab seasonNum={seasonNum} /> },
          { key: 'teams', label: '球队排行', children: <TeamsTab seasonNum={seasonNum} /> },
        ]}
      />
    </>
  )
}
