import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, Col, Empty, Row, Space, Spin, Tag } from 'antd'
import SeasonPicker from '../../components/SeasonPicker'
import RadarChart from '../../components/RadarChart'
import { playerApi } from '../../api/player'
import { ADV_EMPTY, CAREER_SEASON, PLAYOFF_TAG, fmtNum, seasonYearLabel, statQualifiedIn, qualifiedFor, rankIn, unqualifiedReason, tiedCount, ADVANCED_STATS, fmtAdv } from './rankConfig'
import { TeamNames } from '../../components/TeamLogo'
import { CAREER_AWARDS } from './honorConfig'
import { GlossaryIcon, GlossaryTip } from './statGlossary'
import CareerTotals from './CareerTotals'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 赛季资料卡：选中某赛季 → 当季荣誉徽章 + 六维能力雷达（当季联盟百分位）
 * + 常规赛数据卡（联盟排名）+ 季后赛数据卡（季后赛内排名）。
 * 排名/百分位都在前端算：复用全联盟当季榜（常规/季后各一把）。
 */

export const val = (r, k) => Number(r?.[k] ?? 0)
// 真实命中率近似：pts / (2 * (FGA + 0.44 * FTA))
// 真实命中率优先用 B-R 的官方 TS%；老赛季没有时回退到 pts/(2*(FGA+0.44*FTA)) 近似
const tsOf = (r) => {
  const official = r?.playerTsPct
  if (official != null) {
    return Number(official)
  }
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

/**
 * 高阶视图下的六维：换成高阶指标本身，而不是继续画基础数据的百分位。
 * 选这六项是为了各占一角——效率(PER)、真实产出效率(TS%)、球权占比(USG%)、
 * 进攻与防守各一个(OBPM/DBPM)、总价值(VORP)，跟基础版一样有攻有守。
 * 注意生涯档：那一行根本没有高阶数据，六个轴全按 0 参与百分位，而 BPM 这类有负值的
 * 轴会因此落在中游而不是原点——生涯档看高阶雷达本来就没有意义（数据行那边显示的是「/」）。
 */
export const ADV_RADAR_AXES = [
  { label: 'PER', get: (r) => val(r, 'playerPerReal') },
  { label: '真实命中', get: (r) => val(r, 'playerTsPct') },
  { label: '使用率', get: (r) => val(r, 'playerUsgPct') },
  { label: '进攻BPM', get: (r) => val(r, 'playerObpm') },
  { label: '防守BPM', get: (r) => val(r, 'playerDbpm') },
  { label: 'VORP', get: (r) => val(r, 'playerVorp') },
]

export const GRID_STATS = [
  { key: 'playerAppearance', label: '出场数', digits: 0 },
  { key: 'playingTime', label: '上场时间' },
  { key: 'playerAvgScore', label: '得分' },
  { key: 'playerAvgReb', label: '篮板' },
  { key: 'playerAvgOffReb', label: '前场篮板' },
  { key: 'playerAvgDefReb', label: '后场篮板' },
  { key: 'playerAvgAss', label: '助攻' },
  { key: 'playerAvgSteal', label: '抢断' },
  { key: 'playerAvgBlock', label: '盖帽' },
  { key: 'playerAvgTurnover', label: '失误', asc: true, note: '最少排' },
  { key: 'playerAvgPf', label: '犯规', asc: true, note: '最少排' },
  { key: 'playerPer', label: '效率值' },
  // 常规赛的正负值来自逐场累加（赛季汇总表没这项），补到哪季就有到哪季
  { key: 'playerAvgPn', label: '正负值' },
  // 三种投篮各占一行：命中 / 出手 / 命中率（格子是一行三个，正好对齐着读）
  { key: 'playerAvgFgm', label: '场均投篮命中' },
  { key: 'playerAvgFga', label: '场均投篮出手' },
  { key: 'playerAccuracy', label: '投篮%', pct: true },
  { key: 'playerAvgTpm', label: '场均三分命中' },
  { key: 'playerAvgTpa', label: '场均三分出手' },
  { key: 'playerThreeAccuracy', label: '三分%', pct: true },
  { key: 'playerAvgFtm', label: '场均罚球命中' },
  { key: 'playerAvgFta', label: '场均罚球出手' },
  { key: 'playerFreethrowAccuracy', label: '罚球%', pct: true },
]

/**
 * 资料卡/对比页向后端声明要哪些列。这里只用于**联盟池**（算名次和雷达百分位的那一批
 * 2000 行），球员本人那一行走生涯接口、字段不裁。
 * 从 GRID_STATS / ADVANCED_STATS / 两套雷达轴推导，再补上资格线要用的列。
 */
export const PROFILE_FIELDS = [...new Set([
  ...GRID_STATS.map((s) => s.key),
  ...ADVANCED_STATS.map((s) => s.field),
  'playerAppearance',              // 58 场资格线
  'playerPosition',
  'playerAvgFga', 'playerAvgFta',  // 老赛季没有官方 TS% 时雷达的近似算法要用
])].join(',')

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

export function RankChip({ rank, prefix = '联盟第', to, unqualified, tied }) {
  // 手机上一行三个格子，胶囊得再小一号，否则「并列季后赛第 12」放不下
  const isMobile = useIsMobile()
  const fs = isMobile ? 10 : 12
  const pad = isMobile ? '1px 5px' : '1px 8px'
  // 不达标就明说，别给一个跟别人不可比的数字
  if (unqualified) {
    return (
      <span style={{ fontSize: fs, fontWeight: 600, color: '#d46b08', background: '#fff7e6', padding: pad, borderRadius: 10, whiteSpace: 'nowrap' }}>
        {unqualified}
      </span>
    )
  }
  if (!rank) return null
  const color = rank <= 3 ? MEDAL[rank - 1] : '#999'
  const chip = (
    <span
      style={{
        fontSize: fs, fontWeight: 600, color, whiteSpace: 'nowrap',
        background: rank <= 3 ? 'rgba(250,84,28,.08)' : '#f5f5f5',
        padding: pad, borderRadius: 10, cursor: to ? 'pointer' : undefined,
      }}
    >
      {tied > 1 ? '并列' : ''}{prefix} {rank}
    </span>
  )
  // 点名次胶囊 → 当季该单项的完整联盟排名
  return to ? <Link to={to}>{chip}</Link> : chip
}

export default function SeasonProfile({ playerId, honors, onTeamChange, onSeasonChange }) {
  const isMobile = useIsMobile()
  const [career, setCareer] = useState(null)   // 本人常规赛逐季
  const [poRows, setPoRows] = useState(null)   // 本人季后赛逐季
  // 用户手选的赛季写进 URL（返回本页可恢复）；自动兜底（最近打过的赛季）不写
  const [searchParams, setSearchParams] = useSearchParams()
  const [seasonNum, setSeasonNum] = useState(Number(searchParams.get('seasonNum')) || null)
  const [league, setLeague] = useState(null)       // 当季全联盟（常规）：算「联盟第 N」用，不设门槛
  const [leagueQual, setLeagueQual] = useState(null) // 同一批但过了 58 场线：只给雷达当基准分布
  const [poLeague, setPoLeague] = useState(null)

  useEffect(() => {
    let alive = true
    setCareer(null)
    setPoRows(null)
    Promise.all([
      playerApi.listPlayerCareer({ playerId, page: 1, limit: 100 }),
      playerApi.listPlayerPlayoffs(playerId),
    ]).then(([c, p]) => {
      if (!alive) return
      const rows = c.records || [] // 含 seasonNum=CAREER_SEASON 生涯汇总行（"生涯"档用）
      setCareer(rows)
      setPoRows(p || [])
      const played = rows.filter((r) => r.seasonNum < CAREER_SEASON).map((r) => r.seasonNum)
      // URL 没带赛季时默认展示最近打过的赛季
      setSeasonNum((cur) => cur || (played.length ? Math.max(...played) : 1))
    }).catch(() => {
      if (!alive) return
      setCareer([])
      setPoRows([])
      setSeasonNum((cur) => cur || 1)
    })
    return () => { alive = false }
  }, [playerId])

  useEffect(() => {
    if (!seasonNum) return
    let alive = true
    setLeague(null)
    setLeagueQual(null)
    setPoLeague(null)
    // 两个池子分开用：
    //  · 「联盟第 N」按**当季所有出场过的人**排——只跟够 58 场的人比的话，自己没够线时
    //    会得出荒唐结果（21-22 的杜兰特 55 场、詹姆斯 56 场都没进池子，于是两人都被算成
    //    场均命中数联盟第 1，而实际上詹姆斯 11.4 高于杜兰特 10.5）；
    //  · 雷达百分位仍套 58 场线——那是分布基准，两场秀会把整条基线带偏。
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum, fields: PROFILE_FIELDS })
      .then((r) => {
        if (!alive) return
        const rows = r.records || []
        setLeague(rows)
        setLeagueQual(rows.filter(statQualifiedIn(rows)))
      })
      .catch(() => { if (alive) { setLeague([]); setLeagueQual([]) } })
    playerApi.listPlayoffSeasonStats({ page: 1, limit: 2000, seasonNum, fields: PROFILE_FIELDS })
      .then((r) => { if (alive) setPoLeague(r.records || []) })
      .catch(() => { if (alive) setPoLeague([]) })
    return () => { alive = false }
  }, [seasonNum])

  const row = useMemo(() => career?.find((r) => r.seasonNum === seasonNum), [career, seasonNum])
  const poRow = useMemo(() => poRows?.find((r) => r.seasonNum === seasonNum), [poRows, seasonNum])

  // 把当前赛季所属球队回报给球员主页（身份头右侧那枚大队标）
  useEffect(() => {
    onTeamChange?.(row?.playerTeam || null)
  }, [row, onTeamChange])

  // 身份头那枚大队标要能跳到「同一个赛季」的球队页，所以赛季号也回报给上层
  useEffect(() => {
    onSeasonChange?.(seasonNum)
  }, [seasonNum, onSeasonChange])

  // 当季荣誉徽章（与荣誉柜同源）
  const chips = useMemo(() => {
    if (!honors || !seasonNum) return []
    const out = []
    CAREER_AWARDS.forEach((a) => {
      const arr = honors[a.key]
      if (!arr?.length) return
      if (seasonNum === CAREER_SEASON) {
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

  const isCareer = seasonNum === CAREER_SEASON
  const seasonLabel = isCareer ? '生涯' : seasonYearLabel(seasonNum)
  const changeSeason = (v) => {
    setSeasonNum(v)
    setSearchParams((prev) => {
      const q = new URLSearchParams(prev)
      q.set('seasonNum', v)
      return q
    }, { replace: true })
  }
  const picker = <SeasonPicker value={seasonNum} onChange={changeSeason} />

  if (!row) {
    return (
      <Card title="赛季资料卡" extra={picker}>
        <Empty description={`${seasonLabel}未出战（未进入联盟或赛季报销）`} />
      </Card>
    )
  }


  const statCard = (dataRow, leagueRows, prefix, color, stage, stats = GRID_STATS) => {
    // 季后赛不套 58 场资格线（最多才 28 场），否则名次全没、全员「场次不足」
    const po = stage === 'po'
    return (
    <Row gutter={isMobile ? [6, 6] : [10, 10]}>
      {stats.filter((s) => stage === 'po' || !s.poOnly).map((raw) => {
        const s = { ...raw, key: raw.key || raw.field }
        const mine = val(dataRow, s.key)
        // 生涯档没有高阶数据（B-R 只按赛季发布），1976-77 也没有效率值。
        // 这种情况要显示占位符——写成 0.0 会被当成"真的是 0"，排名也不能给
        const cell = dataRow?.[s.key]
        const missing = cell == null || cell === '' || Number.isNaN(Number(cell))
        return (
          <Col key={s.key} xs={8} sm={8}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: isMobile ? '7px 6px' : '10px 12px', background: '#fff' }}>
              <div style={{ color: '#888', fontSize: isMobile ? 11 : 12, whiteSpace: 'nowrap' }}>
                {/* 高阶项的格子标题可悬停出释义；基础项 GlossaryTip 原样返回，不加下划线 */}
                <GlossaryTip field={s.key}>{s.label}</GlossaryTip>
                {/* 备注（"最少排"「联盟平均 15"）在手机上放不下，去说明书里看 */}
                {s.note && !isMobile && <span style={{ marginLeft: 4, fontSize: 11, color: '#ccc' }}>{s.note}</span>}
              </div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: missing ? '#ccc' : color, margin: '2px 0 4px', fontVariantNumeric: 'tabular-nums' }}>
                {missing ? ADV_EMPTY : s.pct || s.rate ? fmtAdv(mine, s) : fmtNum(mine, s.digits ?? 1)}
              </div>
              {!missing && (
                <RankChip
                  rank={rankIn(leagueRows, s.key, mine, s.asc, po)}
                  unqualified={!po && leagueRows?.length && !qualifiedFor(leagueRows, s.key, dataRow) ? unqualifiedReason(s.key) : null}
                  tied={tiedCount(leagueRows, s.key, mine, po)}
                  prefix={prefix}
                  to={`/rankings/${s.key}?seasonNum=${seasonNum}&stage=${stage}`}
                />
              )}
            </div>
          </Col>
        )
      })}
    </Row>
    )
  }

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
          {/* 队标已经在身份头那枚大的上了，这里只留中文队名 */}
          {!isCareer && <Tag color="volcano"><TeamNames value={row.playerTeam} /></Tag>}
          {!isCareer && row.playerPosition && <Tag>{row.playerPosition}</Tag>}
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

        {/* 常规赛数据卡（六维雷达挪到卡片下方） */}
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>{isCareer ? '生涯场均' : '常规赛'}</div>
        {statCard(row, league, '联盟第', '#fa541c', 'rg')}
        {/* 高阶数据单独一块：跟基础数据混在一起就是 30 多个格子，一屏塞不下。
            生涯档整块不出——B-R 只按赛季发布高阶指标，没有生涯合计，21 个格子会全是 "/" */}
        {!isCareer && (
          <>
            <div style={{ fontWeight: 700, margin: '20px 0 10px', fontSize: 15 }}>
              高阶数据
              <GlossaryIcon />
              <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                PER 联盟平均 15；BPM / 效率均为每百回合口径
              </span>
            </div>
            {statCard(row, league, '联盟第', '#fa541c', 'rg', ADVANCED_STATS)}
          </>
        )}
        <div style={{ maxWidth: 440, margin: '20px auto 0' }}>
          {league === null
            ? <Spin style={{ display: 'block', margin: '60px auto' }} />
            : <Radar data={radarOf(row, leagueQual)} />}
          <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 2 }}>
            六维 = {isCareer ? '生涯场均' : '当季'}联盟百分位（0-100；防守 = 抢断+盖帽，真实命中 = TS%）
          </div>
        </div>
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
            {/* 出场/场均时间的 Tag 撤掉后这里只剩队名，生涯档下会整个空掉——空 Space
                仍占 14px 间距，所以没内容就不渲染 */}
            {!isCareer && (
              <Space size={[6, 8]} wrap style={{ marginBottom: 14 }}>
                <Tag color="volcano"><TeamNames value={poRow.playerTeam} /></Tag>
              </Space>
            )}
            {/* 季后赛数据卡（雷达同样在卡片下方，只和当季季后赛球员比） */}
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>季后赛</div>
            {statCard(poRow, poLeague, '季后赛第', '#d4380d', 'po')}
            {!isCareer && (
              <>
                <div style={{ fontWeight: 700, margin: '20px 0 10px', fontSize: 15 }}>
                  高阶数据
                  <GlossaryIcon />
                </div>
                {statCard(poRow, poLeague, '季后赛第', '#d4380d', 'po', ADVANCED_STATS)}
              </>
            )}
            <div style={{ maxWidth: 440, margin: '20px auto 0' }}>
              {poLeague === null
                ? <Spin style={{ display: 'block', margin: '60px auto' }} />
                : <Radar data={radarOf(poRow, poLeague)} color="#d4380d" fill="rgba(212,56,13,.20)" />}
              <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 2 }}>
                六维 = {isCareer ? '生涯' : '当季'}季后赛球员百分位（0-100）
              </div>
            </div>
          </>
        )}
      </Card>

      {/* 生涯总数放最后：上面两张卡是场均，这一块是累计值，量级和读法都不同，
          混在场均中间会让人误读。只有"生涯"这一档才有意义 */}
      {isCareer && (
        <Card title="生涯总数" style={{ marginTop: 16 }} styles={{ body: { padding: '18px 20px' } }}>
          <CareerTotals playerId={playerId} />
        </Card>
      )}
    </>
  )
}
