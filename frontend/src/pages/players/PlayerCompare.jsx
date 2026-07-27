import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Col, Empty, Input, Modal, Row, Segmented, Spin, Tag } from 'antd'
import { BarChartOutlined, FireOutlined, IdcardOutlined, TrophyOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import RadarChart from '../../components/RadarChart'
import SeasonPicker from '../../components/SeasonPicker'
import PillTabs from '../../components/PillTabs'
import { playerApi } from '../../api/player'
import { searchApi } from '../../api/search'
import { ADVANCED_STATS, ADV_EMPTY, CAREER_SEASON, fmtAdv, fmtNum, seasonShort, PLAYOFF_TAG, statQualified, LATEST_SEASON, NBA_TEAM_NAMES, qualifiedFor, rankIn, unqualifiedReason } from './rankConfig'
import TeamLogo, { TeamChain } from '../../components/TeamLogo'
import { CAREER_AWARDS } from './honorConfig'
import { ADV_RADAR_AXES, GRID_STATS, PROFILE_FIELDS, RADAR_AXES, percentileOf } from './SeasonProfile'
import StatViewSwitch from './StatViewSwitch'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 球员对比（/compare）：A 橙 / B 蓝，**两侧各自独立选赛季**（跨时代对比时各取各的年代，
 * 排名与雷达百分位也各自对当季联盟池）。选人支持两种方式：搜索，或"按球队选"
 * （先选赛季再选球队，列出当季阵容；选中顺带把该侧赛季设为所选赛季）。
 * 四个板块：赛季资料卡（常规+季后对位）/ 常规赛对位 / 季后赛对位 / 荣誉对位，
 * 全部跟随两侧各自的赛季（含"生涯场均"档）。
 */

const A_COLOR = '#fa541c'
const B_COLOR = '#2f54eb'
const A_FILL = 'rgba(250,84,28,.20)'
const B_FILL = 'rgba(47,84,235,.18)'
const A_TINT = 'rgba(250,84,28,.07)'
const B_TINT = 'rgba(47,84,235,.07)'

// 生涯/单季对位在 12 项数据卡之外加两项体量数据
const CAREER_STATS = [
  { key: 'playerAppearance', label: '出场', digits: 0 },
  { key: 'playingTime', label: '场均时间' },
  ...GRID_STATS,
]

// ADVANCED_STATS 用 field 命名，对位组件按 key 取值，转一次即可复用同一份定义
const ADV_COMPARE_STATS = ADVANCED_STATS.map((s) => ({ ...s, key: s.field }))

/**
 * 取一个数据项的值，缺失返回 null 而不是 0。
 * 生涯汇总行没有高阶指标、1997 前的季后赛没有正负值——写成 0 的话，"谁领先"
 * 会把没有数据判成落后，条形图也会画出一条假的满格差距。
 */
const statVal = (r, k) => {
  const v = r?.[k]
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/** 对战台内的选人位：搜索 / 按球队（赛季→球队→当季阵容）双模式 Modal */
function PlayerPick({ value, onChange, side, photo }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('search')
  const [opts, setOpts] = useState([])
  const [rosterSeason, setRosterSeason] = useState(LATEST_SEASON)
  const [team, setTeam] = useState(null)
  const [roster, setRoster] = useState(null)
  const timer = useRef()
  const color = side === 'A' ? A_COLOR : B_COLOR
  const tint = side === 'A' ? A_TINT : B_TINT
  const mirror = side === 'B' // B 方内容贴右、镜像排列

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

  // 球队 + 赛季 → 当季阵容（按交易链最后一站归队，与球队页同规则）
  useEffect(() => {
    if (!open || mode !== 'team' || !team) return
    let alive = true
    setRoster(null)
    // 阵容列表只显示号码和名字（名字/号码/照片来自 join，不受裁剪影响）
    playerApi.listSeasonStats({ page: 1, limit: 200, seasonNum: rosterSeason, playerTeam: team, fields: 'playerTeam' })
      .then((r) => { if (alive) setRoster(r.records || []) })
      .catch(() => { if (alive) setRoster([]) })
    return () => { alive = false }
  }, [open, mode, team, rosterSeason])

  const close = () => {
    setOpen(false)
    setOpts([])
    setTeam(null)
    setRoster(null)
  }

  const pick = (player, seasonUsed) => {
    onChange(player, seasonUsed)
    close()
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, cursor: 'pointer', minWidth: 0,
          flexDirection: mirror ? 'row-reverse' : 'row', textAlign: mirror ? 'right' : 'left',
        }}
      >
        {value ? (
          <>
            {/* 有照片就顶上照片（超管在球员管理里上传），没有照片仍是球衣号圆牌 */}
            {photo ? (
              <img
                src={photo}
                alt={value.name || ''}
                style={{
                  width: isMobile ? 38 : 52, height: isMobile ? 38 : 52, borderRadius: '50%',
                  objectFit: 'cover', objectPosition: 'top center', background: 'rgba(255,255,255,.95)',
                  flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,.18)',
                }}
              />
            ) : (
              <div
                style={{
                  width: isMobile ? 38 : 52, height: isMobile ? 38 : 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,.95)', color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900,
                  fontSize: isMobile ? 12 : 15,
                  flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,.18)',
                }}
              >
                #{value.number ?? '-'}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              {/* 手机上名字允许换到两行整名展示——截断成「勒布…」没法看 */}
              <div
                style={{
                  fontWeight: 900, fontSize: isMobile ? 14 : 21, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,.25)',
                  ...(isMobile
                    ? { lineHeight: 1.25 }
                    : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                }}
              >
                {value.name}
              </div>
              <div style={{ fontSize: isMobile ? 11 : 12, color: 'rgba(255,255,255,.78)' }}>点击更换球员</div>
            </div>
          </>
        ) : (
          <div
            style={{
              border: '1.5px dashed rgba(255,255,255,.65)', color: '#fff', borderRadius: 12,
              padding: isMobile ? '10px 14px' : '14px 24px', fontWeight: 700, background: 'rgba(255,255,255,.10)',
              whiteSpace: 'nowrap',
            }}
          >
            + 选择球员 {side}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onCancel={close}
        footer={null}
        closable={false}
        width={480}
        style={{ top: 90 }}
        destroyOnClose
        styles={{ content: { padding: 0, overflow: 'hidden', borderRadius: 14 } }}
      >
        <div style={{ padding: '12px 14px 0' }}>
          <Segmented
            block
            value={mode}
            onChange={(m) => { setMode(m); setOpts([]); setTeam(null); setRoster(null) }}
            options={[{ label: '搜索球员', value: 'search' }, { label: '按球队选', value: 'team' }]}
          />
        </div>

        {mode === 'search' && (
          <>
            <Input
              autoFocus
              size="large"
              variant="borderless"
              placeholder={`搜索球员 ${side}…`}
              onChange={(e) => search(e.target.value)}
              style={{ padding: '12px 18px', fontSize: 15, borderBottom: '1px solid #f0f0f0', borderRadius: 0 }}
            />
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: opts.length ? 6 : 0 }}>
              {!opts.length && (
                <div style={{ textAlign: 'center', color: '#bbb', padding: '28px 0', fontSize: 13 }}>输入球员姓名搜索</div>
              )}
              {opts.map((pp) => (
                <div
                  key={pp.playerId}
                  onClick={() => pick({ id: pp.playerId, name: pp.playerName, number: pp.playerNumber, photo: pp.photo })}
                  style={rowStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tint }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Tag color="volcano" style={{ marginInlineEnd: 0 }}>#{pp.playerNumber ?? '-'}</Tag>
                  <b>{pp.playerName}</b>
                </div>
              ))}
            </div>
          </>
        )}

        {mode === 'team' && (
          <div style={{ padding: '12px 14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#888', fontSize: 13 }}>赛季</span>
              <SeasonPicker value={rosterSeason} onChange={(v) => { setRosterSeason(v); setRoster(null) }} includeCareer={false} />
              {team && (
                <Tag color="volcano" style={{ marginInlineEnd: 0, cursor: 'pointer' }} onClick={() => { setTeam(null); setRoster(null) }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <TeamLogo code={team} size={14} /> {NBA_TEAM_NAMES[team]} ✕
                  </span>
                </Tag>
              )}
            </div>
            {!team ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {Object.entries(NBA_TEAM_NAMES).map(([code, name]) => (
                  <div
                    key={code}
                    onClick={() => setTeam(code)}
                    style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '7px 0', textAlign: 'center', cursor: 'pointer', fontSize: 12 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = tint }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <TeamLogo code={code} size={26} style={{ margin: '0 auto 2px', display: 'block' }} />
                    <div style={{ color: '#888' }}>{name}</div>
                  </div>
                ))}
              </div>
            ) : roster === null ? (
              <Spin style={{ display: 'block', margin: '40px auto' }} />
            ) : !roster.length ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${NBA_TEAM_NAMES[team]}该赛季暂无球员数据`} />
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {roster.map((r) => (
                  <div
                    key={r.playerId}
                    onClick={() => pick({ id: r.playerId, name: r.playerName, number: r.playerNumber, photo: r.photo }, rosterSeason)}
                    style={rowStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = tint }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.playerName}</b>
                    <span style={{ color: '#999', fontSize: 12 }}>{fmtNum(r.playerAvgScore)} 分</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

/** 领先项数拔河条：数一遍对位项里 A/B 各赢几项 */
function ScoreStrip({ rowA, rowB, stats }) {
  if (!rowA || !rowB) return null
  let wa = 0
  let wb = 0
  stats.forEach((s) => {
    // 两边都得有数才算一项（缺失不该被判成落后）
    const av = statVal(rowA, s.key)
    const bv = statVal(rowB, s.key)
    if (av == null || bv == null || av === bv) return
    if (s.asc ? av < bv : av > bv) wa += 1
    else wb += 1
  })
  const total = wa + wb || 1
  return (
    <div style={{ margin: '0 0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
        <span style={{ color: A_COLOR }}>{wa} 项领先</span>
        <span style={{ color: '#bbb', fontWeight: 400 }}>数据对位</span>
        <span style={{ color: B_COLOR }}>{wb} 项领先</span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#f0f0f0', gap: wa && wb ? 2 : 0 }}>
        <div style={{ width: `${(wa / total) * 100}%`, background: 'linear-gradient(90deg, #ff9c6e, #fa541c)', transition: 'width .45s' }} />
        <div style={{ width: `${(wb / total) * 100}%`, background: 'linear-gradient(90deg, #2f54eb, #85a5ff)', transition: 'width .45s' }} />
      </div>
    </div>
  )
}

/** 对位行：A 数值(+排名) | 双向渐变条形+项目名药丸 | B 数值(+排名)。
 * 两侧排名各对各的联盟池（leagueA/leagueB），跨时代对比时各自成立。 */
function CompareRows({ rowA, rowB, stats, leagueA, leagueB, rankPrefix = '联盟第', fmtOverride, po = false }) {
  const chip = (rank, align, unqualified) =>
    unqualified ? (
      <div style={{ fontSize: 11, fontWeight: 600, color: '#d46b08', textAlign: align, marginTop: 1 }}>{unqualified}</div>
    ) : rank && (
      <div style={{ fontSize: 11, fontWeight: 600, color: rank <= 3 ? MEDAL[rank - 1] : '#bbb', textAlign: align, marginTop: 1 }}>
        {rankPrefix}{rank}
      </div>
    )
  return (
    <div>
      <style>{'.cmp-row { transition: background .15s; border-radius: 8px; } .cmp-row:hover { background: #fafafa; }'}</style>
      {stats.map((s) => {
        const av = statVal(rowA, s.key)
        const bv = statVal(rowB, s.key)
        const digits = s.digits ?? 1
        const better = av == null || bv == null || av === bv ? 0
          : (s.asc ? av < bv : av > bv) ? 1 : -1 // 1=A 优
        const max = Math.max(Math.abs(av ?? 0), Math.abs(bv ?? 0)) || 1
        const wA = Math.max(4, (Math.abs(av ?? 0) / max) * 100)
        const wB = Math.max(4, (Math.abs(bv ?? 0) / max) * 100)
        const fmtV = (v) => (v == null ? ADV_EMPTY
          : fmtOverride ? fmtOverride(v, s)
          : s.pct || s.rate ? fmtAdv(v, s)
          : fmtNum(v, digits))
        return (
          <div key={s.key} className="cmp-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px' }}>
            <div style={{ width: 82, textAlign: 'right' }}>
              <div
                style={{
                  fontVariantNumeric: 'tabular-nums', fontSize: better === 1 ? 17 : 14,
                  fontWeight: better === 1 ? 800 : 400, color: better === 1 ? A_COLOR : '#999', lineHeight: 1.3,
                }}
              >
                {fmtV(av)}
              </div>
              {av != null && chip(rankIn(leagueA, s.key, av, s.asc, po), 'right', !po && leagueA?.length && rowA && !qualifiedFor(leagueA, s.key, rowA) ? unqualifiedReason(s.key) : null)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', marginBottom: 5 }}>
                <span
                  style={{
                    display: 'inline-block', background: '#f6f6f6', borderRadius: 999,
                    padding: '1px 12px', fontSize: 12, color: '#777',
                  }}
                >
                  {s.label}
                  {s.note && <span style={{ marginLeft: 4, fontSize: 11, color: '#c0c0c0' }}>{s.note}</span>}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      width: `${wA}%`, height: 7, borderRadius: 4, transition: 'width .45s ease',
                      background: better === -1 ? '#ffd8c2' : 'linear-gradient(90deg, #ffbb96, #fa541c)',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: `${wB}%`, height: 7, borderRadius: 4, transition: 'width .45s ease',
                      background: better === 1 ? '#c6d4ff' : 'linear-gradient(90deg, #2f54eb, #85a5ff)',
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ width: 82, textAlign: 'left' }}>
              <div
                style={{
                  fontVariantNumeric: 'tabular-nums', fontSize: better === -1 ? 17 : 14,
                  fontWeight: better === -1 ? 800 : 400, color: better === -1 ? B_COLOR : '#999', lineHeight: 1.3,
                }}
              >
                {fmtV(bv)}
              </div>
              {bv != null && chip(rankIn(leagueB, s.key, bv, s.asc, po), 'left', !po && leagueB?.length && rowB && !qualifiedFor(leagueB, s.key, rowB) ? unqualifiedReason(s.key) : null)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 名字行（A vs B，色点 + 各自链到个人页）。
 * 手机上名字和标签挤一行会在名字中间折行、标签横插其间——改成每侧竖排：
 * 名字整行（放不下换整行，不截断），赛季/球队标签独立第二行。 */
function NamesBar({ a, b, extraA, extraB }) {
  const isMobile = useIsMobile()
  const dot = (color) => (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, verticalAlign: 2, flexShrink: 0 }} />
  )
  const vsBadge = (
    <span
      style={{
        margin: isMobile ? '0 8px' : '0 16px', color: '#c0c0c0', fontWeight: 900, fontStyle: 'italic',
        fontSize: isMobile ? 11 : 13,
        border: '1.5px solid #eee', borderRadius: '50%', width: isMobile ? 28 : 34, height: isMobile ? 28 : 34,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      VS
    </span>
  )
  if (isMobile) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
            {dot(A_COLOR)}
            <Link to={`/players/${a.id}`} style={{ color: A_COLOR, fontWeight: 800, fontSize: 15, marginLeft: 6 }}>{a.name}</Link>
          </div>
          {extraA && (
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 4 }}>{extraA}</div>
          )}
        </div>
        {vsBadge}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ lineHeight: 1.3 }}>
            <Link to={`/players/${b.id}`} style={{ color: B_COLOR, fontWeight: 800, fontSize: 15, marginRight: 6 }}>{b.name}</Link>
            {dot(B_COLOR)}
          </div>
          {extraB && <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>{extraB}</div>}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ flex: 1, textAlign: 'right' }}>
        {dot(A_COLOR)}
        <Link to={`/players/${a.id}`} style={{ color: A_COLOR, fontWeight: 800, fontSize: 17, margin: '0 0 0 8px' }}>{a.name}</Link>
        {extraA && <span style={{ marginLeft: 8 }}>{extraA}</span>}
      </div>
      {vsBadge}
      <div style={{ flex: 1 }}>
        {extraB && <span style={{ marginRight: 8 }}>{extraB}</span>}
        <Link to={`/players/${b.id}`} style={{ color: B_COLOR, fontWeight: 800, fontSize: 17, marginRight: 8 }}>{b.name}</Link>
        {dot(B_COLOR)}
      </div>
    </div>
  )
}

// 每侧一个赛季标签（含生涯档）
const seasonTag = (season, color) => (
  <Tag color={color} style={{ marginInlineEnd: 0 }}>{season === CAREER_SEASON ? '生涯' : seasonShort(season)}</Tag>
)

export default function PlayerCompare() {
  const isMobile = useIsMobile()
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [tab, setTab] = useState('profile')
  // 基础 16 项 + 高阶 21 项一起铺开要滚很久，跟数据表用同一套开关
  const [view, setView] = useState('basic')
  const statsOf = (base) => (view === 'adv' ? ADV_COMPARE_STATS : base)
  const [bundle, setBundle] = useState(null) // {careerA, careerB, poA, poB, honorsA, honorsB}
  // 两侧各自独立的赛季（CAREER_SEASON=生涯场均）；跨时代对比时各取各的年代
  const [seasonA, setSeasonA] = useState(null)
  const [seasonB, setSeasonB] = useState(null)
  const [lgA, setLgA] = useState({ reg: null, po: null }) // A 侧赛季的联盟池
  const [lgB, setLgB] = useState({ reg: null, po: null })
  const pendA = useRef(null) // 从"按球队选"带出的赛季，bundle 就绪后生效
  const pendB = useRef(null)

  useEffect(() => {
    if (!a || !b) return
    let alive = true
    setBundle(null)
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
      // 默认赛季：各自最近打过的赛季（按球队选人时优先用选队时的赛季）
      const latest = (rows) => {
        const played = rows.filter((r) => r.seasonNum < CAREER_SEASON).map((r) => r.seasonNum)
        return played.length ? Math.max(...played) : CAREER_SEASON
      }
      setSeasonA(pendA.current || latest(careerA))
      setSeasonB(pendB.current || latest(careerB))
      pendA.current = null
      pendB.current = null
    }).catch(() => {
      if (alive) {
        setBundle({ careerA: [], careerB: [], poA: [], poB: [], honorsA: {}, honorsB: {} })
        setSeasonA(LATEST_SEASON)
        setSeasonB(LATEST_SEASON)
      }
    })
    return () => { alive = false }
  }, [a, b])

  // 两侧各自赛季的联盟池（常规照资格线过滤，季后赛不设）
  const usePool = (season, setPool) => {
    useEffect(() => {
      if (!season) return
      let alive = true
      setPool({ reg: null, regQual: null, po: null })
      playerApi.listSeasonStats({ page: 1, limit: 2000, seasonNum: season, fields: PROFILE_FIELDS })
        .then((r) => {
          if (!alive) return
          // reg = 全体（排名用），regQual = 过 58 场线（雷达基准用）。见 SeasonProfile 里的说明
          const rows = r.records || []
          setPool((p) => ({ ...p, reg: rows, regQual: rows.filter(statQualified) }))
        })
        .catch(() => { if (alive) setPool((p) => ({ ...p, reg: [], regQual: [] })) })
      playerApi.listPlayoffSeasonStats({ page: 1, limit: 2000, seasonNum: season, fields: PROFILE_FIELDS })
        .then((r) => { if (alive) setPool((p) => ({ ...p, po: r.records || [] })) })
        .catch(() => { if (alive) setPool((p) => ({ ...p, po: [] })) })
      return () => { alive = false }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [season])
  }
  usePool(seasonA, setLgA)
  usePool(seasonB, setLgB)

  const ready = a && b && bundle && seasonA && seasonB

  const regRow = (rows, season) => rows?.find((r) => r.seasonNum === season)
  const rowA = useMemo(() => regRow(bundle?.careerA, seasonA), [bundle, seasonA])
  const rowB = useMemo(() => regRow(bundle?.careerB, seasonB), [bundle, seasonB])
  const poRowA = useMemo(() => regRow(bundle?.poA, seasonA), [bundle, seasonA])
  const poRowB = useMemo(() => regRow(bundle?.poB, seasonB), [bundle, seasonB])

  // 双侧雷达：各自对各自赛季的联盟池取百分位
  const radarSeries = (ra, rb, rowsA, rowsB) => {
    // 数据行切到高阶了，雷达还画基础六维会对不上号
    const AXES = view === 'adv' ? ADV_RADAR_AXES : RADAR_AXES
    const series = []
    if (ra && rowsA?.length) series.push({ color: A_COLOR, fill: A_FILL, data: AXES.map((x) => ({ label: x.label, value: percentileOf(rowsA, x.get, x.get(ra)) })) })
    if (rb && rowsB?.length) series.push({ color: B_COLOR, fill: B_FILL, data: AXES.map((x) => ({ label: x.label, value: percentileOf(rowsB, x.get, x.get(rb)) })) })
    return series
  }

  const missTag = (name, what) => <Tag style={{ color: '#999' }}>{name} {what}</Tag>

  const ring = (size, pos) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,.15)', ...pos,
  })

  const teamTagA = (r) => (seasonA === CAREER_SEASON ? <Tag>生涯</Tag> : <Tag color="volcano"><TeamChain value={r.playerTeam} size={14} /></Tag>)
  const teamTagB = (r) => (seasonB === CAREER_SEASON ? <Tag>生涯</Tag> : <Tag color="blue"><TeamChain value={r.playerTeam} size={14} /></Tag>)

  return (
    <>
      {/* 对战台：橙蓝对角撞色 + 内嵌选人 + 白色 VS 徽章 */}
      <div
        style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 16,
          background: 'linear-gradient(105deg, #ad2102 0%, #fa541c 49.75%, #2f54eb 50.25%, #10239e 100%)',
          boxShadow: '0 6px 22px rgba(0,0,0,.14)',
        }}
      >
        <div style={ring(210, { top: -90, left: -60 })} />
        <div style={ring(150, { bottom: -60, left: '30%' })} />
        <div style={ring(190, { top: -70, right: -50 })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, padding: isMobile ? '16px 12px' : '26px 28px', position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PlayerPick value={a} photo={a?.photo || bundle?.honorsA?.photo} onChange={(p, season) => { pendA.current = season || null; setA(p) }} side="A" />
          </div>
          <div
            style={{
              width: isMobile ? 42 : 54, height: isMobile ? 42 : 54, borderRadius: '50%', background: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontStyle: 'italic', fontWeight: 900, fontSize: isMobile ? 13 : 17, color: '#1f1f1f', letterSpacing: 1,
              boxShadow: '0 4px 14px rgba(0,0,0,.28)',
            }}
          >
            VS
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <PlayerPick value={b} photo={b?.photo || bundle?.honorsB?.photo} onChange={(p, season) => { pendB.current = season || null; setB(p) }} side="B" />
          </div>
        </div>
        {/* 两侧各自的赛季（跨时代对比：一人一个年代）。
            手机上两只紧凑版并排分居左右（原样两只 200px 宽放不下会叠成两行），提示文案只在桌面出 */}
        {a && b && seasonA && seasonB && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 6 : 10,
              flexWrap: 'wrap', rowGap: 8, padding: isMobile ? '0 12px 14px' : '0 28px 18px', position: 'relative',
            }}
          >
            <SeasonPicker value={seasonA} onChange={setSeasonA} compact={isMobile} />
            {!isMobile && <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 12 }}>两侧赛季各自独立</span>}
            <SeasonPicker value={seasonB} onChange={setSeasonB} compact={isMobile} />
          </div>
        )}
      </div>

      {!a || !b ? (
        <Card style={{ borderRadius: 16 }} styles={{ body: { padding: '70px 20px' } }}>
          <Empty description="从上方对战台选择两名球员（可搜索，也可按球队+赛季挑人），开始数据对位" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : !ready ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} size="large" />
      ) : (
        <>
          <PillTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'profile', icon: <IdcardOutlined />, label: '赛季资料卡' },
              { value: 'career', icon: <BarChartOutlined />, label: '常规赛对位' },
              { value: 'playoffs', icon: <FireOutlined />, label: '季后赛对位' },
              { value: 'honors', icon: <TrophyOutlined />, label: '荣誉对位' },
            ]}
          />

          {/* ===== 赛季资料卡对比 ===== */}
          {tab === 'profile' && (
            <>
              <Card
                title="常规赛对位"
                style={{ marginBottom: 16, borderRadius: 16 }}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <NamesBar
                  a={a} b={b}
                  extraA={<>{seasonTag(seasonA, 'volcano')}{rowA ? teamTagA(rowA) : missTag('', '未出战')}</>}
                  extraB={<>{rowB ? teamTagB(rowB) : missTag('', '未出战')}{seasonTag(seasonB, 'blue')}</>}
                />
                <StatViewSwitch value={view} onChange={setView} />
                <ScoreStrip rowA={rowA} rowB={rowB} stats={statsOf(GRID_STATS)} />
                <Row gutter={[20, 20]}>
                  <Col xs={24} lg={10}>
                    {lgA.reg === null || lgB.reg === null
                      ? <Spin style={{ display: 'block', margin: '90px auto' }} />
                      : <RadarChart series={radarSeries(rowA, rowB, lgA.regQual, lgB.regQual)} />}
                    <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>常规赛 · 各自赛季的联盟百分位</div>
                  </Col>
                  <Col xs={24} lg={14}>
                    <CompareRows rowA={rowA} rowB={rowB} stats={statsOf(GRID_STATS)} leagueA={lgA.reg} leagueB={lgB.reg} />
                  </Col>
                </Row>
              </Card>
              <Card title="季后赛对位" style={{ borderRadius: 16 }} styles={{ body: { padding: '18px 20px' } }}>
                {!poRowA && !poRowB ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="两人所选赛季都未进季后赛" />
                ) : (
                  <>
                    <NamesBar
                      a={a} b={b}
                      extraA={poRowA
                        ? <>{seasonTag(seasonA, 'volcano')}{seasonA === CAREER_SEASON ? <Tag>生涯</Tag> : <Tag color={PLAYOFF_TAG[poRowA.playoffResult] || 'default'}>{poRowA.playoffResult}</Tag>}</>
                        : missTag(a.name, '未进季后赛')}
                      extraB={poRowB
                        ? <>{seasonB === CAREER_SEASON ? <Tag>生涯</Tag> : <Tag color={PLAYOFF_TAG[poRowB.playoffResult] || 'default'}>{poRowB.playoffResult}</Tag>}{seasonTag(seasonB, 'blue')}</>
                        : missTag(b.name, '未进季后赛')}
                    />
                    <StatViewSwitch value={view} onChange={setView} />
                    <ScoreStrip rowA={poRowA} rowB={poRowB} stats={statsOf(GRID_STATS)} />
                    <Row gutter={[20, 20]}>
                      <Col xs={24} lg={10}>
                        {lgA.po === null || lgB.po === null
                          ? <Spin style={{ display: 'block', margin: '90px auto' }} />
                          : <RadarChart series={radarSeries(poRowA, poRowB, lgA.po, lgB.po)} />}
                        <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>季后赛 · 各自赛季的季后赛球员百分位</div>
                      </Col>
                      <Col xs={24} lg={14}>
                        <CompareRows rowA={poRowA} rowB={poRowB} stats={statsOf(GRID_STATS)} leagueA={lgA.po} leagueB={lgB.po} rankPrefix="季后赛第" po />
                      </Col>
                    </Row>
                  </>
                )}
              </Card>
            </>
          )}

          {/* ===== 常规赛对位（各自赛季 / 生涯场均） ===== */}
          {tab === 'career' && (
            <Card
              title="常规赛对位"
              style={{ borderRadius: 16 }}
              styles={{ body: { padding: '18px 20px' } }}
            >
              <NamesBar
                a={a} b={b}
                extraA={<>{seasonTag(seasonA, 'volcano')}{seasonA === CAREER_SEASON
                  ? <Tag>{bundle.careerA.filter((r) => r.seasonNum < CAREER_SEASON).length} 个赛季</Tag>
                  : rowA ? teamTagA(rowA) : missTag('', '未出战')}</>}
                extraB={<>{seasonB === CAREER_SEASON
                  ? <Tag>{bundle.careerB.filter((r) => r.seasonNum < CAREER_SEASON).length} 个赛季</Tag>
                  : rowB ? teamTagB(rowB) : missTag('', '未出战')}{seasonTag(seasonB, 'blue')}</>}
              />
              {!rowA && !rowB
                ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="两人所选赛季都未出战" />
                : (
                  <>
                    <StatViewSwitch value={view} onChange={setView} />
                    <ScoreStrip rowA={rowA} rowB={rowB} stats={statsOf(CAREER_STATS)} />
                    <CompareRows rowA={rowA} rowB={rowB} stats={statsOf(CAREER_STATS)} leagueA={lgA.reg} leagueB={lgB.reg} />
                  </>
                )}
            </Card>
          )}

          {/* ===== 季后赛对位（各自赛季 / 生涯场均） ===== */}
          {tab === 'playoffs' && (
            <Card
              title="季后赛对位"
              style={{ borderRadius: 16 }}
              styles={{ body: { padding: '18px 20px' } }}
            >
              {!poRowA && !poRowB ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="两人所选赛季都未进季后赛" />
              ) : (
                <>
                  <NamesBar
                    a={a} b={b}
                    extraA={poRowA
                      ? <>{seasonTag(seasonA, 'volcano')}{seasonA === CAREER_SEASON
                          ? <Tag>{bundle.poA.filter((r) => r.seasonNum < CAREER_SEASON).length} 次季后赛</Tag>
                          : <Tag color={PLAYOFF_TAG[poRowA.playoffResult] || 'default'}>{poRowA.playoffResult}</Tag>}</>
                      : missTag(a.name, seasonA === CAREER_SEASON ? '未进过季后赛' : '未进季后赛')}
                    extraB={poRowB
                      ? <>{seasonB === CAREER_SEASON
                          ? <Tag>{bundle.poB.filter((r) => r.seasonNum < CAREER_SEASON).length} 次季后赛</Tag>
                          : <Tag color={PLAYOFF_TAG[poRowB.playoffResult] || 'default'}>{poRowB.playoffResult}</Tag>}{seasonTag(seasonB, 'blue')}</>
                      : missTag(b.name, seasonB === CAREER_SEASON ? '未进过季后赛' : '未进季后赛')}
                  />
                  <StatViewSwitch value={view} onChange={setView} />
                  <ScoreStrip rowA={poRowA} rowB={poRowB} stats={statsOf(CAREER_STATS)} />
                  <CompareRows rowA={poRowA} rowB={poRowB} stats={statsOf(CAREER_STATS)} leagueA={lgA.po} leagueB={lgB.po} rankPrefix="季后赛第" po />
                </>
              )}
            </Card>
          )}

          {/* ===== 荣誉对位（各自赛季 / 生涯合计） ===== */}
          {tab === 'honors' && (() => {
            const countOf = (h, aw, season) => {
              const arr = h?.[aw.key]
              if (!arr?.length) return 0
              if (season === CAREER_SEASON) return arr.length
              const hit = aw.key === 'champion'
                ? arr.some((e) => Number(e.season) === season)
                : arr.some((x) => Number(x) === season)
              return hit ? 1 : 0
            }
            const rows = CAREER_AWARDS
              .map((aw) => ({ aw, ca: countOf(bundle.honorsA, aw, seasonA), cb: countOf(bundle.honorsB, aw, seasonB) }))
              .filter((r) => r.ca || r.cb)
            // 单赛季附加：MVP/DPOY 票选名次对位（名次小者胜；任一侧为生涯档则不列）
            const voteRows = (seasonA === CAREER_SEASON || seasonB === CAREER_SEASON) ? [] : [
              { label: 'MVP 票选名次', va: Number(rowA?.mvpRank) || null, vb: Number(rowB?.mvpRank) || null },
              { label: 'DPOY 票选名次', va: Number(rowA?.dpoyRank) || null, vb: Number(rowB?.dpoyRank) || null },
            ].filter((r) => r.va || r.vb)
            const cell = (v, mine, other, color, tint, career) => {
              const win = mine != null && mine > 0 && (other == null || mine > other)
              const disp = career ? (v ? `×${v}` : '—') : (v ? '✓' : '—')
              return (
                <span
                  style={{
                    display: 'inline-block', minWidth: 46, textAlign: 'center',
                    padding: '2px 12px', borderRadius: 999, fontSize: 16, fontVariantNumeric: 'tabular-nums',
                    fontWeight: win ? 800 : 400, color: win ? color : '#999',
                    background: win ? tint : 'transparent',
                  }}
                >
                  {disp}
                </span>
              )
            }
            return (
              <Card
                title="荣誉对位"
                style={{ borderRadius: 16 }}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <NamesBar
                  a={a} b={b}
                  extraA={seasonTag(seasonA, 'volcano')}
                  extraB={seasonTag(seasonB, 'blue')}
                />
                <div>
                  <style>{'.hon-row { transition: background .15s; border-radius: 8px; } .hon-row:hover { background: #fafafa; }'}</style>
                  {rows.map(({ aw, ca, cb }) => (
                    <div key={aw.key} className="hon-row" style={{ display: 'flex', alignItems: 'center', padding: '9px 8px' }}>
                      <div style={{ flex: 1, textAlign: 'right' }}>{cell(ca, ca, cb, A_COLOR, A_TINT, seasonA === CAREER_SEASON)}</div>
                      <div style={{ width: isMobile ? 120 : 190, textAlign: 'center', fontWeight: aw.gold ? 700 : 500 }}>
                        <span style={{ marginRight: 6 }}>{aw.icon}</span>{aw.label}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>{cell(cb, cb, ca, B_COLOR, B_TINT, seasonB === CAREER_SEASON)}</div>
                    </div>
                  ))}
                  {voteRows.map((r) => {
                    const aWin = r.va != null && (r.vb == null || r.va < r.vb)
                    const bWin = r.vb != null && (r.va == null || r.vb < r.va)
                    const pill = (win, color, tint, text) => (
                      <span
                        style={{
                          display: 'inline-block', minWidth: 46, textAlign: 'center',
                          padding: '2px 12px', borderRadius: 999, fontSize: 14,
                          fontWeight: win ? 800 : 400, color: win ? color : '#999',
                          background: win ? tint : 'transparent',
                        }}
                      >
                        {text}
                      </span>
                    )
                    return (
                      <div key={r.label} className="hon-row" style={{ display: 'flex', alignItems: 'center', padding: '9px 8px' }}>
                        <div style={{ flex: 1, textAlign: 'right' }}>{pill(aWin, A_COLOR, A_TINT, r.va ? `第 ${r.va}` : '—')}</div>
                        <div style={{ width: isMobile ? 120 : 190, textAlign: 'center', color: '#666', fontSize: 13 }}>{r.label}</div>
                        <div style={{ flex: 1, textAlign: 'left' }}>{pill(bWin, B_COLOR, B_TINT, r.vb ? `第 ${r.vb}` : '—')}</div>
                      </div>
                    )
                  })}
                  {!rows.length && !voteRows.length && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="所选赛季两人都没有主要荣誉" />
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
