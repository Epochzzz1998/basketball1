import { useEffect, useMemo, useState } from 'react'
import { Card, Col, Empty, Row, Space, Spin, Tag } from 'antd'
import SeasonPicker from '../../components/SeasonPicker'
import RadarChart from '../../components/RadarChart'
import { playerApi } from '../../api/player'
import { PLAYOFF_TAG, fmtNum, seasonYearLabel, fmtPct, statQualified } from './rankConfig'
import { CAREER_AWARDS } from './honorConfig'

/**
 * 赛季资料卡：选中某赛季 → 当季荣誉徽章 + 六维能力雷达（当季联盟百分位）
 * + 常规赛数据卡（联盟排名）+ 季后赛数据卡（季后赛内排名）。
 * 排名/百分位都在前端算：复用全联盟当季榜（常规/季后各一把）。
 */

export const val = (r, k) => Number(r?.[k] ?? 0)
// 真实命中率近似：pts / (2 * (FGA + 0.44 * FTA))
const tsOf = (r) => {
  const denom = val(r, 'playerAvgFga') + 0.44 * val(r, 'playerAvgFta')
  return denom > 0 ? val(r, 'playerAvgScore') / (2 * denom) : 0
}
const defOf = (r) => val(r, 'playerAvgSteal') + val(r, 'playerAvgBlock')

export const RADAR_AXES = [
  { label: '得分', get: (r) => val(r, 'playerAvgScore') },
  { label: '篮板', get: (r) => val(r, 'playerAvgReb') },
  { label: '助攻', get: (r) => val(r, 'playerAvgAss') },
  { label: '防守', get: defOf },
  { label: '效率', get: (r) => val(r, 'playerPer') },
  { label: '真实命中', get: tsOf },
]

export const GRID_STATS = [
  { key: 'playerAvgScore', label: '得分' },
  { key: 'playerAvgReb', label: '篮板' },
  { key: 'playerAvgAss', label: '助攻' },
  { key: 'playerAvgSteal', label: '抢断' },
  { key: 'playerAvgBlock', label: '盖帽' },
  { key: 'playerAvgTurnover', label: '失误', asc: true, note: '最少排' },
  { key: 'playerPer', label: '效率值' },
  { key: 'playerAvgFgm', label: '场均投篮命中' },
  { key: 'playerAccuracy', label: '投篮%', pct: true },
  { key: 'playerAvgTpm', label: '场均三分命中' },
  { key: 'playerThreeAccuracy', label: '三分%', pct: true },
]

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

export function percentileOf(rows, getter, mine) {
  if (!rows?.length) return 0
  const below = rows.filter((r) => getter(r) < mine).length
  return Math.round((below / Math.max(1, rows.length - 1)) * 100)
}

// 单系列雷达 = 共享 RadarChart 的一个系列（对比页用双系列覆盖）
const Radar = ({ data, color = '#fa541c', fill = 'rgba(250,84,28,.22)' }) => (
  <RadarChart series={[{ color, fill, data }]} />
)

function RankChip({ rank, prefix = '联盟第' }) {
  if (!rank) return null
  const color = rank <= 3 ? MEDAL[rank - 1] : '#999'
  return (
    <span
      style={{
        fontSize: 12, fontWeight: 600, color,
        background: rank <= 3 ? 'rgba(250,84,28,.08)' : '#f5f5f5',
        padding: '1px 8px', borderRadius: 10,
      }}
    >
      {prefix} {rank}
    </span>
  )
}

export default function SeasonProfile({ playerId, honors }) {
  const [career, setCareer] = useState(null)   // 本人常规赛逐季
  const [poRows, setPoRows] = useState(null)   // 本人季后赛逐季
  const [seasonNum, setSeasonNum] = useState(null)
  const [league, setLeague] = useState(null)   // 当季全联盟（常规）
  const [poLeague, setPoLeague] = useState(null)

  useEffect(() => {
    let alive = true
    setCareer(null)
    setPoRows(null)
    setSeasonNum(null)
    Promise.all([
      playerApi.listPlayerCareer({ playerId, page: 1, limit: 100 }),
      playerApi.listPlayerPlayoffs(playerId),
    ]).then(([c, p]) => {
      if (!alive) return
      const rows = c.records || [] // 含 seasonNum=50 生涯汇总行（"生涯"档用）
      setCareer(rows)
      setPoRows(p || [])
      const played = rows.filter((r) => r.seasonNum < 50).map((r) => r.seasonNum)
      // 默认展示最近打过的赛季
      setSeasonNum(played.length ? Math.max(...played) : 1)
    }).catch(() => {
      if (!alive) return
      setCareer([])
      setPoRows([])
      setSeasonNum(1)
    })
    return () => { alive = false }
  }, [playerId])

  useEffect(() => {
    if (!seasonNum) return
    let alive = true
    setLeague(null)
    setPoLeague(null)
    // 联盟池（算"联盟第 N"和雷达百分位）套 58 场资格线——两场秀不该抬高或压低全联盟基准
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setLeague((r.records || []).filter(statQualified)) })
      .catch(() => { if (alive) setLeague([]) })
    playerApi.listPlayoffSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setPoLeague(r.records || []) })
      .catch(() => { if (alive) setPoLeague([]) })
    return () => { alive = false }
  }, [seasonNum])

  const row = useMemo(() => career?.find((r) => r.seasonNum === seasonNum), [career, seasonNum])
  const poRow = useMemo(() => poRows?.find((r) => r.seasonNum === seasonNum), [poRows, seasonNum])

  // 当季荣誉徽章（与荣誉柜同源）
  const chips = useMemo(() => {
    if (!honors || !seasonNum) return []
    const out = []
    CAREER_AWARDS.forEach((a) => {
      const arr = honors[a.key]
      if (!arr?.length) return
      if (seasonNum === 50) {
        out.push({ ...a, count: arr.length }) // 生涯档：全部荣誉 ×N
        return
      }
      const hit = a.key === 'champion'
        ? arr.some((e) => Number(e.season) === seasonNum)
        : arr.some((s) => Number(s) === seasonNum)
      if (hit) out.push(a)
    })
    return out
  }, [honors, seasonNum])

  if (career === null || seasonNum === null) return <Spin style={{ display: 'block', margin: '60px auto' }} />

  const isCareer = seasonNum === 50
  const seasonLabel = isCareer ? '生涯' : seasonYearLabel(seasonNum)
  const picker = <SeasonPicker value={seasonNum} onChange={setSeasonNum} />

  if (!row) {
    return (
      <Card title="赛季资料卡" extra={picker}>
        <Empty description={`${seasonLabel}未出战（未进入联盟或赛季报销）`} />
      </Card>
    )
  }

  const rankIn = (rows, s, mine) =>
    rows?.length ? 1 + rows.filter((r) => (s.asc ? val(r, s.key) < mine : val(r, s.key) > mine)).length : null

  const statCard = (dataRow, leagueRows, prefix, color) => (
    <Row gutter={[10, 10]}>
      {GRID_STATS.map((s) => {
        const mine = val(dataRow, s.key)
        return (
          <Col key={s.key} xs={12} sm={8}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
              <div style={{ color: '#888', fontSize: 12 }}>
                {s.label}
                {s.note && <span style={{ marginLeft: 4, fontSize: 11, color: '#ccc' }}>{s.note}</span>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color, margin: '2px 0 4px', fontVariantNumeric: 'tabular-nums' }}>
                {s.pct ? fmtPct(mine) : fmtNum(mine, s.digits ?? 1)}
              </div>
              <RankChip rank={rankIn(leagueRows, s, mine)} prefix={prefix} />
            </div>
          </Col>
        )
      })}
    </Row>
  )

  const radarOf = (dataRow, leagueRows) =>
    RADAR_AXES.map((a) => ({ label: a.label, value: percentileOf(leagueRows, a.get, a.get(dataRow)) }))

  return (
    <>
      <Card
        title={`${seasonLabel} 资料卡`}
        extra={picker}
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        {/* 基本信息 + 当季荣誉 */}
        <Space size={[6, 8]} wrap style={{ marginBottom: 16 }}>
          {!isCareer && <Tag color="volcano">{String(row.playerTeam || '').replace('->', ' → ')}</Tag>}
          {!isCareer && row.playerPosition && <Tag>{row.playerPosition}</Tag>}
          <Tag>出场 {row.playerAppearance}{row.playerFrAppearance != null ? `（先发 ${row.playerFrAppearance}）` : ''}</Tag>
          <Tag>场均 {fmtNum(row.playingTime)} 分钟</Tag>
          {chips.map((a) => (
            <Tag key={a.key} color={a.gold ? 'gold' : 'orange'} style={{ fontWeight: 600 }}>
              {a.icon} {a.label}{a.count ? ` ×${a.count}` : ''}
            </Tag>
          ))}
          {!isCareer && Number(row.mvpRank) > 1 && Number(row.mvpRank) <= 10 && (
            <Tag color="purple">MVP 票选第 {row.mvpRank}</Tag>
          )}
          {!isCareer && Number(row.dpoyRank) > 1 && Number(row.dpoyRank) <= 10 && (
            <Tag color="cyan">DPOY 票选第 {row.dpoyRank}</Tag>
          )}
        </Space>

        <Row gutter={[20, 20]}>
          {/* 能力雷达 */}
          <Col xs={24} lg={9}>
            {league === null
              ? <Spin style={{ display: 'block', margin: '90px auto' }} />
              : <Radar data={radarOf(row, league)} />}
            <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 2 }}>
              六维 = {isCareer ? '生涯场均' : '当季'}联盟百分位（0-100；防守 = 抢断+盖帽，真实命中 = TS%）
            </div>
          </Col>
          {/* 常规赛数据卡 */}
          <Col xs={24} lg={15}>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>常规赛</div>
            {statCard(row, league, '联盟第', '#fa541c')}
          </Col>
        </Row>
      </Card>

      {/* 季后赛区块 */}
      <Card
        title={
          <Space>
            季后赛
            {poRow?.playoffResult && (
              <Tag color={PLAYOFF_TAG[poRow.playoffResult] || 'default'}>{poRow.playoffResult}</Tag>
            )}
          </Space>
        }
        styles={{ body: { padding: '18px 20px' } }}
      >
        {!poRow ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isCareer ? '生涯未进过季后赛' : '该赛季未进季后赛'} />
        ) : (
          <>
            <Space size={[6, 8]} wrap style={{ marginBottom: 14 }}>
              {!isCareer && <Tag color="volcano">{String(poRow.playerTeam || '').replace('->', ' → ')}</Tag>}
              <Tag>出战 {poRow.playerAppearance} 场{poRow.playerFrAppearance != null ? `（先发 ${poRow.playerFrAppearance}）` : ''}</Tag>
              <Tag>场均 {fmtNum(poRow.playingTime)} 分钟</Tag>
            </Space>
            <Row gutter={[20, 20]}>
              {/* 季后赛能力雷达（只和当季季后赛球员比） */}
              <Col xs={24} lg={9}>
                {poLeague === null
                  ? <Spin style={{ display: 'block', margin: '90px auto' }} />
                  : <Radar data={radarOf(poRow, poLeague)} color="#d4380d" fill="rgba(212,56,13,.20)" />}
                <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 2 }}>
                  六维 = {isCareer ? '生涯' : '当季'}季后赛球员百分位（0-100）
                </div>
              </Col>
              <Col xs={24} lg={15}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>季后赛</div>
                {statCard(poRow, poLeague, '季后赛第', '#d4380d')}
              </Col>
            </Row>
          </>
        )}
      </Card>
    </>
  )
}
