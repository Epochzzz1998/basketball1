import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Col, ConfigProvider, Empty, Input, Modal, Row, Segmented, Spin, Tag } from 'antd'
import { BarChartOutlined, FireOutlined, IdcardOutlined, TrophyOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import RadarChart from '../../components/RadarChart'
import SeasonPicker from '../../components/SeasonPicker'
import { playerApi } from '../../api/player'
import { searchApi } from '../../api/search'
import { fmtNum, seasonYearLabel, PLAYOFF_TAG } from './rankConfig'
import { CAREER_AWARDS } from './honorConfig'
import { GRID_STATS, RADAR_AXES, percentileOf, val } from './SeasonProfile'

/**
 * 球员对比（/compare）：A 橙 / B 蓝，四个板块对应个人页四 Tab——
 * 赛季资料卡（双色覆盖雷达 ×常规/季后 + 逐项对位）/ 常规赛生涯场均 / 季后赛生涯场均 / 生涯荣誉。
 * 对位行：两侧数值+双向条形，优势侧加粗上色。
 */

const A_COLOR = '#fa541c'
const B_COLOR = '#2f54eb'
const A_FILL = 'rgba(250,84,28,.20)'
const B_FILL = 'rgba(47,84,235,.18)'

// 生涯场均对位在 12 项数据卡之外加两项体量数据
const CAREER_STATS = [
  { key: 'playerAppearance', label: '出场', digits: 0 },
  { key: 'playingTime', label: '场均时间' },
  ...GRID_STATS,
]

/** 卡片式选人：未选=虚线占位卡；已选=着色球员卡（点击换人）；搜索在居中 Modal 里 */
function PlayerPick({ value, onChange, color, tint, placeholder }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState([])
  const timer = useRef()

  const search = (kw) => {
    clearTimeout(timer.current)
    const k = kw.trim()
    if (!k) return setOpts([])
    timer.current = setTimeout(async () => {
      try {
        const d = await searchApi.globalSearch(k)
        setOpts(d?.players || [])
      } catch {
        setOpts([])
      }
    }, 300)
  }

  const close = () => {
    setOpen(false)
    setOpts([])
  }

  return (
    <>
      {value ? (
        <div
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderRadius: 12, background: tint, border: `1px solid ${color}33`, cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%', background: color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0,
            }}
          >
            #{value.number ?? '-'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value.name}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>点击更换球员</div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '21px 16px', borderRadius: 12, border: `1.5px dashed ${color}66`,
            color, fontWeight: 600, cursor: 'pointer', background: '#fff',
          }}
        >
          + {placeholder}
        </div>
      )}

      <Modal
        open={open}
        onCancel={close}
        footer={null}
        closable={false}
        width={440}
        style={{ top: 120 }}
        destroyOnClose
        styles={{ content: { padding: 0, overflow: 'hidden', borderRadius: 14 } }}
      >
        <Input
          autoFocus
          size="large"
          variant="borderless"
          placeholder={`搜索${placeholder}…`}
          onChange={(e) => search(e.target.value)}
          style={{ padding: '14px 18px', fontSize: 15, borderBottom: '1px solid #f0f0f0', borderRadius: 0 }}
        />
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: opts.length ? 6 : 0 }}>
          {!opts.length && (
            <div style={{ textAlign: 'center', color: '#bbb', padding: '28px 0', fontSize: 13 }}>输入球员姓名搜索</div>
          )}
          {opts.map((pp) => (
            <div
              key={pp.playerId}
              onClick={() => { onChange({ id: pp.playerId, name: pp.playerName, number: pp.playerNumber }); close() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = tint }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Tag color="volcano" style={{ marginInlineEnd: 0 }}>#{pp.playerNumber ?? '-'}</Tag>
              <b>{pp.playerName}</b>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

/** 对位行：A 数值(+排名) | 双向条形+项目名 | B 数值(+排名)（优势侧加粗上色） */
function CompareRows({ rowA, rowB, stats, league, rankPrefix = '联盟第', fmtOverride }) {
  const rankOf = (v, s) =>
    league?.length && v != null
      ? 1 + league.filter((r) => (s.asc ? val(r, s.key) < v : val(r, s.key) > v)).length
      : null
  const chip = (rank, align) =>
    rank && (
      <div style={{ fontSize: 11, fontWeight: 600, color: rank <= 3 ? MEDAL[rank - 1] : '#bbb', textAlign: align, marginTop: 1 }}>
        {rankPrefix}{rank}
      </div>
    )
  return (
    <div>
      {stats.map((s) => {
        const av = rowA ? val(rowA, s.key) : null
        const bv = rowB ? val(rowB, s.key) : null
        const digits = s.digits ?? 1
        const better = av == null || bv == null || av === bv ? 0
          : (s.asc ? av < bv : av > bv) ? 1 : -1 // 1=A 优
        const max = Math.max(Math.abs(av ?? 0), Math.abs(bv ?? 0)) || 1
        const wA = Math.max(4, (Math.abs(av ?? 0) / max) * 100)
        const wB = Math.max(4, (Math.abs(bv ?? 0) / max) * 100)
        const fmtV = (v) => (v == null ? '-' : (fmtOverride ? fmtOverride(v, s) : fmtNum(v, digits)))
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid #fafafa' }}>
            <div style={{ width: 80, textAlign: 'right' }}>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: better === 1 ? 800 : 400, color: better === 1 ? A_COLOR : '#999' }}>
                {fmtV(av)}
              </div>
              {chip(rankOf(av, s), 'right')}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 3 }}>
                {s.label}
                {s.note && <span style={{ marginLeft: 4, fontSize: 11, color: '#ccc' }}>{s.note}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: `${wA}%`, height: 5, borderRadius: 3, background: better === -1 ? '#ffd8c2' : A_COLOR, opacity: better === -1 ? 0.9 : 1 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ width: `${wB}%`, height: 5, borderRadius: 3, background: better === 1 ? '#c6d4ff' : B_COLOR }} />
                </div>
              </div>
            </div>
            <div style={{ width: 80, textAlign: 'left' }}>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: better === -1 ? 800 : 400, color: better === -1 ? B_COLOR : '#999' }}>
                {fmtV(bv)}
              </div>
              {chip(rankOf(bv, s), 'left')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 名字行（A vs B，各自链到个人页） */
function NamesBar({ a, b, extraA, extraB }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <Link to={`/players/${a.id}`} style={{ color: A_COLOR, fontWeight: 800, fontSize: 16 }}>{a.name}</Link>
        {extraA && <span style={{ marginLeft: 8 }}>{extraA}</span>}
      </div>
      <span style={{ margin: '0 18px', color: '#bbb', fontWeight: 700 }}>VS</span>
      <div style={{ flex: 1 }}>
        {extraB && <span style={{ marginRight: 8 }}>{extraB}</span>}
        <Link to={`/players/${b.id}`} style={{ color: B_COLOR, fontWeight: 800, fontSize: 16 }}>{b.name}</Link>
      </div>
    </div>
  )
}

export default function PlayerCompare() {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [tab, setTab] = useState('profile')
  const [bundle, setBundle] = useState(null) // {careerA, careerB, poA, poB, honorsA, honorsB}
  const [seasonNum, setSeasonNum] = useState(null)
  const [statSeason, setStatSeason] = useState(50) // 生涯两个板块的赛季（50=生涯场均）
  const [statLeague, setStatLeague] = useState(null)   // statSeason 的全联盟常规行（50=生涯汇总行）
  const [statPoLeague, setStatPoLeague] = useState(null)
  const [league, setLeague] = useState(null)
  const [poLeague, setPoLeague] = useState(null)

  useEffect(() => {
    if (!a || !b) return
    let alive = true
    setBundle(null)
    setSeasonNum(null)
    Promise.all([
      playerApi.listPlayerCareer({ playerId: a.id, page: 1, limit: 100 }),
      playerApi.listPlayerCareer({ playerId: b.id, page: 1, limit: 100 }),
      playerApi.listPlayerPlayoffs(a.id),
      playerApi.listPlayerPlayoffs(b.id),
      playerApi.playerHonors(a.id),
      playerApi.playerHonors(b.id),
    ]).then(([ca, cb, pa, pb, ha, hb]) => {
      if (!alive) return
      const careerA = ca.records || []
      const careerB = cb.records || []
      setBundle({ careerA, careerB, poA: pa || [], poB: pb || [], honorsA: ha || {}, honorsB: hb || {} })
      // 默认赛季：两人都打过的最近赛季；否则任一人的最近赛季
      const sa = careerA.filter((r) => r.seasonNum < 50).map((r) => r.seasonNum)
      const sb = careerB.filter((r) => r.seasonNum < 50).map((r) => r.seasonNum)
      const common = sa.filter((s) => sb.includes(s))
      setSeasonNum(common.length ? Math.max(...common) : Math.max(...sa, ...sb, 1))
    }).catch(() => { if (alive) { setBundle({ careerA: [], careerB: [], poA: [], poB: [], honorsA: {}, honorsB: {} }); setSeasonNum(1) } })
    return () => { alive = false }
  }, [a, b])

  useEffect(() => {
    if (!a || !b || !statSeason) return
    let alive = true
    setStatLeague(null)
    setStatPoLeague(null)
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum: statSeason })
      .then((r) => { if (alive) setStatLeague(r.records || []) })
      .catch(() => { if (alive) setStatLeague([]) })
    playerApi.listPlayoffSeasonStats({ page: 1, limit: 2000, seasonNum: statSeason })
      .then((r) => { if (alive) setStatPoLeague(r.records || []) })
      .catch(() => { if (alive) setStatPoLeague([]) })
    return () => { alive = false }
  }, [a, b, statSeason])

  useEffect(() => {
    if (!seasonNum) return
    let alive = true
    setLeague(null)
    setPoLeague(null)
    playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setLeague(r.records || []) })
      .catch(() => { if (alive) setLeague([]) })
    playerApi.listPlayoffSeasonStats({ page: 1, limit: 2000, seasonNum })
      .then((r) => { if (alive) setPoLeague(r.records || []) })
      .catch(() => { if (alive) setPoLeague([]) })
    return () => { alive = false }
  }, [seasonNum])

  const ready = a && b && bundle && seasonNum

  const rowA = useMemo(() => bundle?.careerA.find((r) => r.seasonNum === seasonNum), [bundle, seasonNum])
  const rowB = useMemo(() => bundle?.careerB.find((r) => r.seasonNum === seasonNum), [bundle, seasonNum])
  const poRowA = useMemo(() => bundle?.poA.find((r) => r.seasonNum === seasonNum), [bundle, seasonNum])
  const poRowB = useMemo(() => bundle?.poB.find((r) => r.seasonNum === seasonNum), [bundle, seasonNum])
  const sumA = useMemo(() => bundle?.careerA.find((r) => r.seasonNum === 50), [bundle])
  const sumB = useMemo(() => bundle?.careerB.find((r) => r.seasonNum === 50), [bundle])
  const poSumA = useMemo(() => bundle?.poA.find((r) => r.seasonNum === 50), [bundle])
  const poSumB = useMemo(() => bundle?.poB.find((r) => r.seasonNum === 50), [bundle])

  const radarSeries = (ra, rb, rows) => {
    const series = []
    if (ra && rows?.length) series.push({ color: A_COLOR, fill: A_FILL, data: RADAR_AXES.map((x) => ({ label: x.label, value: percentileOf(rows, x.get, x.get(ra)) })) })
    if (rb && rows?.length) series.push({ color: B_COLOR, fill: B_FILL, data: RADAR_AXES.map((x) => ({ label: x.label, value: percentileOf(rows, x.get, x.get(rb)) })) })
    return series
  }

  const missTag = (name, what) => <Tag style={{ color: '#999' }}>{name} {what}</Tag>

  return (
    <>
      {/* 选人区 */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '18px 22px' } }}>
        <Row gutter={16} align="middle">
          <Col xs={24} md={10}>
            <PlayerPick value={a} onChange={setA} color={A_COLOR} tint="rgba(250,84,28,.06)" placeholder="选择球员 A（橙方）" />
          </Col>
          <Col xs={24} md={4} style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#e0e0e0', letterSpacing: 2, fontStyle: 'italic' }}>VS</span>
          </Col>
          <Col xs={24} md={10}>
            <PlayerPick value={b} onChange={setB} color={B_COLOR} tint="rgba(47,84,235,.06)" placeholder="选择球员 B（蓝方）" />
          </Col>
        </Row>
      </Card>

      {!a || !b ? (
        <Card><Empty description="选择两名球员开始对比（输入姓名搜索）" image={Empty.PRESENTED_IMAGE_SIMPLE} /></Card>
      ) : !ready ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />
      ) : (
        <>
          <ConfigProvider
            theme={{
              token: { borderRadius: 22, borderRadiusSM: 18 },
              components: {
                Segmented: {
                  itemSelectedBg: '#fa541c', itemSelectedColor: '#ffffff', trackBg: '#efefef',
                  itemColor: '#666', itemHoverColor: '#fa541c', itemHoverBg: 'rgba(250,84,28,0.08)',
                },
              },
            }}
          >
            <Segmented
              size="large"
              value={tab}
              onChange={setTab}
              style={{ marginBottom: 16, padding: 4, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.04)' }}
              options={[
                { value: 'profile', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}><IdcardOutlined /> 赛季资料卡</span> },
                { value: 'career', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}><BarChartOutlined /> 常规赛生涯</span> },
                { value: 'playoffs', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}><FireOutlined /> 季后赛生涯</span> },
                { value: 'honors', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}><TrophyOutlined /> 生涯荣誉</span> },
              ]}
            />
          </ConfigProvider>

          {/* ===== 赛季资料卡对比 ===== */}
          {tab === 'profile' && (
            <>
              <Card
                title={`${seasonNum === 50 ? '生涯' : seasonYearLabel(seasonNum)} 对位`}
                extra={<SeasonPicker value={seasonNum} onChange={setSeasonNum} />}
                style={{ marginBottom: 16 }}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <NamesBar
                  a={a} b={b}
                  extraA={rowA
                    ? (seasonNum === 50 ? <Tag>生涯</Tag> : <Tag color="volcano">{String(rowA.playerTeam || '').replace('->', ' → ')}</Tag>)
                    : missTag(a.name, '未出战')}
                  extraB={rowB
                    ? (seasonNum === 50 ? <Tag>生涯</Tag> : <Tag color="blue">{String(rowB.playerTeam || '').replace('->', ' → ')}</Tag>)
                    : missTag(b.name, '未出战')}
                />
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={10}>
                    {league === null
                      ? <Spin style={{ display: 'block', margin: '90px auto' }} />
                      : <RadarChart series={radarSeries(rowA, rowB, league)} />}
                    <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>常规赛 · {seasonNum === 50 ? '生涯场均' : '当季'}联盟百分位</div>
                  </Col>
                  <Col xs={24} lg={14}>
                    <CompareRows rowA={rowA} rowB={rowB} stats={GRID_STATS} league={league} />
                  </Col>
                </Row>
              </Card>
              <Card title="季后赛对位" styles={{ body: { padding: '18px 20px' } }}>
                {!poRowA && !poRowB ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="两人该赛季都未进季后赛" />
                ) : (
                  <>
                    <NamesBar
                      a={a} b={b}
                      extraA={poRowA
                        ? (seasonNum === 50 ? <Tag>生涯</Tag> : <Tag color={PLAYOFF_TAG[poRowA.playoffResult] || 'default'}>{poRowA.playoffResult}</Tag>)
                        : missTag(a.name, '未进季后赛')}
                      extraB={poRowB
                        ? (seasonNum === 50 ? <Tag>生涯</Tag> : <Tag color={PLAYOFF_TAG[poRowB.playoffResult] || 'default'}>{poRowB.playoffResult}</Tag>)
                        : missTag(b.name, '未进季后赛')}
                    />
                    <Row gutter={[20, 20]}>
                      <Col xs={24} lg={10}>
                        {poLeague === null
                          ? <Spin style={{ display: 'block', margin: '90px auto' }} />
                          : <RadarChart series={radarSeries(poRowA, poRowB, poLeague)} />}
                        <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>季后赛 · {seasonNum === 50 ? '生涯' : '当季'}季后赛球员百分位</div>
                      </Col>
                      <Col xs={24} lg={14}>
                        <CompareRows rowA={poRowA} rowB={poRowB} stats={GRID_STATS} league={poLeague} rankPrefix="季后赛第" />
                      </Col>
                    </Row>
                  </>
                )}
              </Card>
            </>
          )}

          {/* ===== 常规赛对位（生涯场均 / 任选赛季） ===== */}
          {tab === 'career' && (() => {
            const ra = statSeason === 50 ? sumA : bundle.careerA.find((r) => r.seasonNum === statSeason)
            const rb = statSeason === 50 ? sumB : bundle.careerB.find((r) => r.seasonNum === statSeason)
            return (
              <Card
                title={`常规赛对位 · ${seasonYearLabel(statSeason)}`}
                extra={<SeasonPicker value={statSeason} onChange={setStatSeason} includeCareer />}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <NamesBar
                  a={a} b={b}
                  extraA={statSeason === 50
                    ? <Tag>{bundle.careerA.filter((r) => r.seasonNum < 50).length} 个赛季</Tag>
                    : ra ? <Tag color="volcano">{String(ra.playerTeam || '').replace('->', ' → ')}</Tag> : missTag(a.name, '未出战')}
                  extraB={statSeason === 50
                    ? <Tag>{bundle.careerB.filter((r) => r.seasonNum < 50).length} 个赛季</Tag>
                    : rb ? <Tag color="blue">{String(rb.playerTeam || '').replace('->', ' → ')}</Tag> : missTag(b.name, '未出战')}
                />
                {!ra && !rb
                  ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="两人该赛季都未出战" />
                  : <CompareRows rowA={ra} rowB={rb} stats={CAREER_STATS} league={statLeague} />}
              </Card>
            )
          })()}

          {/* ===== 季后赛对位（生涯场均 / 任选赛季） ===== */}
          {tab === 'playoffs' && (() => {
            const ra = statSeason === 50 ? poSumA : bundle.poA.find((r) => r.seasonNum === statSeason)
            const rb = statSeason === 50 ? poSumB : bundle.poB.find((r) => r.seasonNum === statSeason)
            const miss = statSeason === 50 ? '未进过季后赛' : '未进季后赛'
            return (
              <Card
                title={`季后赛对位 · ${seasonYearLabel(statSeason)}`}
                extra={<SeasonPicker value={statSeason} onChange={setStatSeason} includeCareer />}
                styles={{ body: { padding: '18px 20px' } }}
              >
                {!ra && !rb ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`两人该${statSeason === 50 ? '生涯' : '赛季'}都${miss}`} />
                ) : (
                  <>
                    <NamesBar
                      a={a} b={b}
                      extraA={ra
                        ? (statSeason === 50
                            ? <Tag>{bundle.poA.filter((r) => r.seasonNum < 50).length} 次季后赛</Tag>
                            : <Tag color={PLAYOFF_TAG[ra.playoffResult] || 'default'}>{ra.playoffResult}</Tag>)
                        : missTag(a.name, miss)}
                      extraB={rb
                        ? (statSeason === 50
                            ? <Tag>{bundle.poB.filter((r) => r.seasonNum < 50).length} 次季后赛</Tag>
                            : <Tag color={PLAYOFF_TAG[rb.playoffResult] || 'default'}>{rb.playoffResult}</Tag>)
                        : missTag(b.name, miss)}
                    />
                    <CompareRows rowA={ra} rowB={rb} stats={CAREER_STATS} league={statPoLeague} rankPrefix="季后赛第" />
                  </>
                )}
              </Card>
            )
          })()}

          {/* ===== 荣誉对位（生涯合计 / 任选赛季） ===== */}
          {tab === 'honors' && (() => {
            const isCareer = statSeason === 50
            const countOf = (h, aw) => {
              const arr = h?.[aw.key]
              if (!arr?.length) return 0
              if (isCareer) return arr.length
              const hit = aw.key === 'champion'
                ? arr.some((e) => Number(e.season) === statSeason)
                : arr.some((x) => Number(x) === statSeason)
              return hit ? 1 : 0
            }
            const rows = CAREER_AWARDS
              .map((aw) => ({ aw, ca: countOf(bundle.honorsA, aw), cb: countOf(bundle.honorsB, aw) }))
              .filter((r) => r.ca || r.cb)
            // 单赛季附加：MVP/DPOY 票选名次对位（名次小者胜）
            const ra = bundle.careerA.find((r) => r.seasonNum === statSeason)
            const rb = bundle.careerB.find((r) => r.seasonNum === statSeason)
            const voteRows = isCareer ? [] : [
              { label: 'MVP 票选名次', va: Number(ra?.mvpRank) || null, vb: Number(rb?.mvpRank) || null },
              { label: 'DPOY 票选名次', va: Number(ra?.dpoyRank) || null, vb: Number(rb?.dpoyRank) || null },
            ].filter((r) => r.va || r.vb)
            const cell = (v, mine, other, color) => {
              const win = mine != null && (other == null || mine > other)
              const disp = isCareer ? (v ? `×${v}` : '—') : (v ? '✓' : '—')
              return (
                <span style={{ fontSize: 17, fontWeight: win ? 800 : 400, color: win ? color : '#999', fontVariantNumeric: 'tabular-nums' }}>
                  {disp}
                </span>
              )
            }
            return (
              <Card
                title={`荣誉对位 · ${isCareer ? '生涯合计' : seasonYearLabel(statSeason)}`}
                extra={<SeasonPicker value={statSeason} onChange={setStatSeason} includeCareer />}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <NamesBar a={a} b={b} />
                <div>
                  {rows.map(({ aw, ca, cb }) => (
                    <div key={aw.key} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #fafafa' }}>
                      <div style={{ flex: 1, textAlign: 'right' }}>{cell(ca, ca, cb, A_COLOR)}</div>
                      <div style={{ width: 180, textAlign: 'center', fontWeight: aw.gold ? 700 : 500 }}>
                        <span style={{ marginRight: 6 }}>{aw.icon}</span>{aw.label}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>{cell(cb, cb, ca, B_COLOR)}</div>
                    </div>
                  ))}
                  {voteRows.map((r) => {
                    const aWin = r.va != null && (r.vb == null || r.va < r.vb)
                    const bWin = r.vb != null && (r.va == null || r.vb < r.va)
                    return (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #fafafa' }}>
                        <div style={{ flex: 1, textAlign: 'right', fontSize: 15, fontWeight: aWin ? 800 : 400, color: aWin ? A_COLOR : '#999' }}>
                          {r.va ? `第 ${r.va}` : '—'}
                        </div>
                        <div style={{ width: 180, textAlign: 'center', color: '#666', fontSize: 13 }}>{r.label}</div>
                        <div style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: bWin ? 800 : 400, color: bWin ? B_COLOR : '#999' }}>
                          {r.vb ? `第 ${r.vb}` : '—'}
                        </div>
                      </div>
                    )
                  })}
                  {!rows.length && !voteRows.length && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={isCareer ? '两人都还没有主要荣誉' : '该赛季两人都没有主要荣誉'} />
                  )}
                </div>
              </Card>
            )
          })()}
        </>
      )}
    </>
  )
}
