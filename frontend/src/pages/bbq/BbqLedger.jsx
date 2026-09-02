import { useEffect, useMemo, useState } from 'react'
import { Avatar, Card, Col, DatePicker, Empty, Modal, Row, Spin, Tag } from 'antd'
import { FireOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { bbqApi } from '../../api/bbq'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'
import BbqTabs from './BbqTabs'

/**
 * 耿阿姨烤串 · 经营台账（店员视角叫「我的薪资」）。数字全由后端算好，这里只画（自绘 SVG，零依赖）。
 * - 时段是**任意起止日期**（后端 from/to，上限一年）；早先是「按月/按周」两个按钮，
 *   但真实需求是"看某一段"——发工资那几天、某个长周末、试营业头两周，没有一个卡在月或周的边界上；
 * - 店长可以用 `?staff={userId}` 把整页收窄到一个人（成员管理里的「薪资总览」按钮）；
 * - 店长：全店——统计条 + 每日支出/穿串统计柱状图 + 员工占比/薪资结构环形图 + 每人聚合行；
 * - 店员：只有自己——同一套图按自己的数据画 + 逐条记录明细（含已结清标记）。
 * 穿串统计：纵轴=串数（不是钱），横轴=该时段实际录入过的串种（按快照名聚合）。
 */

const AMBER = '#d48806'
const AMBER_DARK = '#ad6800'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const PALETTE = ['#d48806', '#fa8c16', '#ffc53d', '#ad6800', '#ffa940', '#873800', '#ffd666', '#d46b08']

const money = (n) => `$${Number(n || 0).toFixed(2)}`
const toMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0)
const shiftMin = (s, e) => { let d = toMin(e) - toMin(s); if (d <= 0) d += 24 * 60; return d }
const fmtDur = (min) => `${Math.floor(min / 60)}小时${min % 60 ? `${min % 60}分` : ''}`
const fmtHours = (min) => `${(min / 60).toFixed(1)}h`
/** 本周从周一起算（dayjs 默认周日为一周之首，手动折算） */
const mondayOf = (d) => d.subtract((d.day() + 6) % 7, 'day')

/** 柱状图：竖条 + 底部刻度（bars: [{key?, label, title?, value, showLabel}]）+ 最大值虚线；
 *  fmt 控制数值文案（默认金额；穿串统计传 "N 串"）；条数 ≤10 时柱顶直接标数值。
 *
 *  **key 是独立字段，不再拿 label 当唯一标识**：按月分桶时标签是「9月」这种，
 *  跨年区间里会出现两个「9月」，React 的 key 就撞了——症状是切换区间后有一根柱子
 *  停在上一次的高度不动。label 只管好看，key 只管唯一，两件事分开。 */
function BarChart({ bars, isMobile, fmt = money }) {
  const H = 170
  const max = Math.max(...bars.map((d) => d.value), 1)
  const n = bars.length
  const gap = n > 10 ? 3 : 10
  const W = isMobile ? 360 : 720
  const barW = (W - gap * (n - 1)) / n
  const y = (v) => H - 24 - (v / max) * (H - 44)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <line x1={0} x2={W} y1={y(max)} y2={y(max)} stroke="#f0f0f0" strokeDasharray="4 4" />
      <text x={W} y={y(max) - 4} textAnchor="end" fontSize={10} fill="#bbb">{fmt(max)}</text>
      {bars.map((d, i) => {
        const x = i * (barW + gap)
        const zero = d.value <= 0
        return (
          <g key={d.key || d.label}>
            <rect
              x={x} y={zero ? H - 26 : y(d.value)} width={barW} rx={Math.min(3, barW / 2)}
              height={zero ? 2 : Math.max(2, H - 24 - y(d.value))}
              fill={zero ? '#f5f5f5' : AMBER} opacity={zero ? 1 : 0.85}
            >
              <title>{`${d.title || d.label}：${fmt(d.value)}`}</title>
            </rect>
            {n <= 10 && !zero && (
              <text x={x + barW / 2} y={y(d.value) - 5} textAnchor="middle" fontSize={10} fill={AMBER_DARK} fontWeight={700}>
                {fmt(d.value)}
              </text>
            )}
            {d.showLabel && (
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize={n <= 10 ? 11 : 9} fill={n <= 10 ? '#8c8c8c' : '#bbb'}>{d.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** 环形图：分段圆环 + 中心汇总 + 图例（名称 · 金额 · 占比） */
function Donut({ data, centerLabel, centerValue, isMobile }) {
  const size = isMobile ? 150 : 170
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 14
  const stroke = 22
  const total = data.reduce((s, d) => s + d.value, 0)
  const polar = (ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]
  let acc = -Math.PI / 2
  const segs = total > 0
    ? data.filter((d) => d.value > 0).map((d) => {
        const frac = d.value / total
        const a0 = acc
        const a1 = acc + frac * Math.PI * 2
        acc = a1
        return { ...d, a0, a1, frac }
      })
    : []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f5" strokeWidth={stroke} />
        {segs.map((s) => {
          // 满圆弧 path 画不出来，退化成整圆
          if (s.frac > 0.999) return <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke} />
          const [x0, y0] = polar(s.a0)
          const [x1, y1] = polar(s.a1 - 0.03)
          return (
            <path
              key={s.label}
              d={`M ${x0} ${y0} A ${r} ${r} 0 ${s.a1 - s.a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`}
              fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="round"
            >
              <title>{`${s.label}：${money(s.value)}（${Math.round(s.frac * 100)}%）`}</title>
            </path>
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="#999">{centerLabel}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize={14} fontWeight={800} fill={AMBER_DARK}>{centerValue}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 }}>
        {segs.length === 0 && <span style={{ color: '#bbb', fontSize: 12 }}>该时段还没有数据</span>}
        {segs.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#595959', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ color: '#999', marginLeft: 'auto' }}>{money(s.value)} · {Math.round(s.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 统计小卡 */
function Stat({ label, value, tone }) {
  return (
    <div style={{ flex: '1 1 100px', minWidth: 100, background: '#fffdf5', border: '1px solid #ffe58f66', borderRadius: 12, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: '#999' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3, color: tone || AMBER_DARK }}>{value}</div>
    </div>
  )
}

export default function BbqLedger() {
  const isMobile = useIsMobile()
  const { dn } = useAuth()
  /*
   * 时段 = 一对起止日期，默认「本月 1 号 → 今天」。
   *
   * 原来这里是 mode('month'|'week') + month + week 三个状态，配一组「按月/按周」胶囊和
   * 左右翻页箭头。换成一个区间选择器之后三个状态塌成一个，**图表、标题、请求参数全部只看它**——
   * 早先每加一个视图，这三处都要各写一个 `mode === ...` 分支，而它们本该永远一致。
   *
   * 快捷项（本月/上月/近 7 天…）留在选择器自带的 presets 里：去掉的是"模式"这个概念，
   * 不是"一键选本月"这个便利。少了它，每次看本月都要点两次日历。
   */
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs()])
  /*
   * 选到一半时的那个端点。用来把「超过一年」的日子直接置灰，**在选择器里就不让选出来**，
   * 而不是等选完发一次注定失败的请求、再弹一句「跨度最多 366 天」。
   *
   * 这个 366 必须和后端 `LEDGER_MAX_DAYS` 对齐——两边各写一个数字迟早分叉，
   * 而分叉的表现是：界面允许选、后端拒绝，用户看到一个自己无法理解的失败。
   */
  const [picking, setPicking] = useState(null)
  const [data, setData] = useState(null)
  const [skewerDetailOpen, setSkewerDetailOpen] = useState(false)
  // 店长从成员管理点「薪资总览」进来时带的人；店员传了也没用（后端把店员钉死在自己身上）
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || undefined

  const from = range?.[0]?.format('YYYY-MM-DD')
  const to = range?.[1]?.format('YYYY-MM-DD')

  useEffect(() => {
    if (!from || !to) return
    setData(null)
    bbqApi.ledger({ from, to, userId: staffId }).then(setData).catch(() => setData(undefined))
  }, [from, to, staffId])

  /**
   * 柱状图分桶：区间可以是 1 天也可以是一整年，**一根柱子代表多久必须跟着跨度变**。
   *
   * 一天一根在一个月内正好，但选一整年就是 365 根一像素宽的线，什么都读不出来。所以：
   *
   * | 跨度 | 一根柱子 = | 为什么 |
   * |---|---|---|
   * | ≤ 31 天 | 一天 | 一个月以内，逐日是有信息的：哪天开工、哪天歇 |
   * | 32 ~ 92 天 | 一周（周一起算） | 三个月逐日是 90 根，趋势被噪音盖住；周是排班的自然周期 |
   * | > 92 天 | 一个月 | 半年以上只看月度走势 |
   *
   * **刻度标签的稀释是另一件事，按「根数」算，不按粒度算。** 两者混在一起写过一版，
   * 结果是改了粒度忘了改标签——90 根柱子每根都标，底下糊成一条黑线。
   */
  const bars = useMemo(() => {
    if (!from || !to) return []
    const map = {}
    ;(data?.daily || []).forEach((d) => { map[d.date] = Number(d.total) })
    const start = dayjs(from)
    const end = dayjs(to)
    const days = end.diff(start, 'day') + 1
    const grain = days <= 31 ? 'day' : days <= 92 ? 'week' : 'month'
    // 桶的起点要对齐到自然边界（周一 / 月初），否则「本周」会从区间的第一天起算，
    // 和店里排班的周对不上；首尾两个桶再被区间裁一刀
    const buckets = []
    let cur = grain === 'week' ? mondayOf(start) : grain === 'month' ? start.startOf('month') : start
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      const next = grain === 'day' ? cur.add(1, 'day')
        : grain === 'week' ? cur.add(7, 'day')
          : cur.add(1, 'month').startOf('month')
      let v = 0
      for (let d = cur.isBefore(start) ? start : cur; d.isBefore(next) && !d.isAfter(end); d = d.add(1, 'day')) {
        v += map[d.format('YYYY-MM-DD')] || 0
      }
      buckets.push({ at: cur, value: v })
      cur = next
    }
    const n = buckets.length
    const every = n <= 10 ? 1 : n <= 20 ? 2 : Math.ceil(n / 10)
    return buckets.map((b, i) => ({
      key: b.at.format('YYYY-MM-DD'),
      label: grain === 'day' ? `${b.at.date()}`
        : grain === 'week' ? b.at.format('M/D')
          : b.at.format('M月'),
      title: grain === 'day' ? b.at.format('M月D日')
        : grain === 'week' ? `${b.at.format('M月D日')} ~ ${b.at.add(6, 'day').format('M月D日')}`
          : b.at.format('YYYY 年 M 月'),
      value: b.value,
      showLabel: i === 0 || i === n - 1 || i % every === 0,
    }))
  }, [data, from, to])
  /** 一根柱子代表多久，写在图的标题里——不说的话读者会默认"一天一根"，跨度一大就读错 */
  const grainLabel = useMemo(() => {
    if (!from || !to) return ''
    const days = dayjs(to).diff(dayjs(from), 'day') + 1
    return days <= 31 ? '每日' : days <= 92 ? '每周' : '每月'
  }, [from, to])

  const manager = data?.role === 'manager'
  /*
   * 各处标题里那个「本月/本周」换成真实区间。写成 `9月1日~9月2日` 而不是「所选时段」——
   * 页面上同时挂着五张图，每张都标着"所选时段"等于都没标；看图的时候人不会回头去看
   * 顶上的选择器，而是就近读标题。同一年内不写年份，跨年才写。
   */
  const periodLabel = useMemo(() => {
    if (!from || !to) return ''
    const a = dayjs(from)
    const b = dayjs(to)
    if (a.isSame(b, 'day')) return a.format('M月D日')
    const sameYear = a.year() === b.year()
    return sameYear
      ? `${a.format('M月D日')} ~ ${b.format('M月D日')}`
      : `${a.format('YYYY年M月D日')} ~ ${b.format('YYYY年M月D日')}`
  }, [from, to])
  /* 收窄到一个人时（成员管理里的「薪资总览」），页面从「全店台账」变成「某人的薪资」 */
  const scopeName = data?.scopeUserName
  const scoped = manager && !!data?.scopeUserId
  // 穿串统计：纵轴=串数，横轴=该时段实际录入过的串种（后端按快照名聚合、多者在前）
  const skewerBars = useMemo(() => (data?.skewers || []).map((s) => ({
    label: String(s.name).length > 6 ? `${String(s.name).slice(0, 6)}…` : s.name,
    title: s.name,
    value: Number(s.num),
    showLabel: true,
  })), [data])
  const countFmt = (v) => `${v} 串`
  const userPie = useMemo(() => {
    if (!data) return []
    const rows = (data.users || []).map((u, i) => ({ label: dn(u.userId, u.userNickname), value: Number(u.total), color: PALETTE[i % PALETTE.length] }))
    if (rows.length <= 6) return rows
    const head = rows.slice(0, 5)
    const rest = rows.slice(5).reduce((s, r) => s + r.value, 0)
    return [...head, { label: '其他', value: rest, color: '#d9d9d9' }]
  }, [data])
  const structPie = useMemo(() => (data
    ? [
        { label: '工时工资', value: Number(data.baseSum), color: AMBER },
        { label: '穿串工资', value: Number(data.skewerSum), color: '#ffc53d' },
      ]
    : []), [data])

  const ring = (size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.16)', ...pos })

  return (
    <>
      <BbqTabs />
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '22px 28px', marginBottom: 16,
          background: 'linear-gradient(120deg, #613400 0%, #ad6800 55%, #d48806 100%)',
        }}
      >
        <div style={ring(170, { top: -70, right: 100 })} />
        <div style={ring(110, { bottom: -45, right: 260 })} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
            {/* 三种身份三个标题：店员看自己的、店长看全店的、店长点开某个人的 */}
            <FireOutlined style={{ marginRight: 8 }} />耿阿姨烤串 · {
              scoped ? `${scopeName} 的薪资总览` : manager === false ? '我的薪资' : '经营台账'
            }
          </div>
          <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
            {scoped
              ? 'TA 一个人的薪资明细与构成。改记录请到「薪资计算」。'
              : manager === false
                ? '你的工资明细，只读。有疑问找店长核对。'
                : '全店薪资的分布与结构；结清在「薪资计算」页操作。'}
          </div>
        </div>
      </div>

      {/* 时段：一个区间选择器，起止随便选（后端上限一年）。
          自带的 presets 覆盖了原来「按月/按周」两个按钮的便利，但不再是"模式"——
          选完就是一对普通的起止日期，图表和标题只认这一对值 */}
      <Card style={{ borderRadius: 16, marginBottom: 16 }} styles={{ body: { padding: '10px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#999', whiteSpace: 'nowrap' }}>时段</span>
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => { if (v && v[0] && v[1]) setRange(v) }}
            allowClear={false}
            inputReadOnly={isMobile}
            onCalendarChange={setPicking}
            onOpenChange={(open) => { if (!open) setPicking(null) }}
            disabledDate={(cur) => {
              const anchor = picking?.[0] || picking?.[1]
              // 没开始选、或者两端都已选完：不限制（限制了会把已选中的那一端也置灰）
              if (!anchor || (picking?.[0] && picking?.[1])) return false
              return Math.abs(cur.diff(anchor, 'day')) > 366
            }}
            style={{ flex: isMobile ? '1 1 100%' : '0 1 320px' }}
            presets={[
              { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
              { label: '上月', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
              { label: '本周', value: [mondayOf(dayjs()), dayjs()] },
              { label: '近 7 天', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: '近 30 天', value: [dayjs().subtract(29, 'day'), dayjs()] },
              { label: '近 90 天', value: [dayjs().subtract(89, 'day'), dayjs()] },
              { label: '今年', value: [dayjs().startOf('year'), dayjs()] },
            ]}
          />
          <span style={{ fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>最长一年</span>
        </div>
      </Card>

      {data === null ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : !data ? (
        <Card style={{ borderRadius: 16 }}><Empty description="加载失败" /></Card>
      ) : (
        <>
          {/* 统计条 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <Stat label={manager && !scoped ? '该时段总支出' : '该时段合计'} value={money(data.monthTotal)} />
            <Stat label="工时工资" value={money(data.baseSum)} />
            <Stat label="穿串工资" value={money(data.skewerSum)} />
            <Stat label="扣款" value={`−${money(data.deductSum)}`} tone="#cf1322" />
            <Stat label="未结清累计（全部）" value={money(data.unsettledTotal)} tone="#d4380d" />
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={manager ? 14 : 24}>
              <Card
                title={`${grainLabel}支出（${periodLabel}）`}
                style={{ borderRadius: 16 }}
                styles={{ body: { padding: isMobile ? '12px 10px' : '16px 18px' } }}
              >
                <BarChart bars={bars} isMobile={isMobile} />
              </Card>
              {/* 穿串统计：纵轴串数、横轴实际录入过的串种；右上角详情=数量+金额明细表 */}
              <Card
                title={`穿串统计（${periodLabel} · 串数）`}
                style={{ borderRadius: 16, marginTop: 16 }}
                styles={{ body: { padding: isMobile ? '12px 10px' : '16px 18px' } }}
                extra={skewerBars.length > 0 && (
                  <a onClick={() => setSkewerDetailOpen(true)} style={{ color: AMBER, fontSize: 13, fontWeight: 600 }}>详情</a>
                )}
              >
                {skewerBars.length === 0 ? (
                  <Empty description={`${periodLabel}还没有穿串记录`} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '10px 0' }} />
                ) : (
                  <BarChart bars={skewerBars} isMobile={isMobile} fmt={countFmt} />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={manager ? 10 : 24}>
              <Card title="薪资结构" style={{ borderRadius: 16, marginBottom: manager ? 16 : 0 }} styles={{ body: { padding: '14px 16px' } }}>
                <Donut data={structPie} centerLabel="该时段" centerValue={money(data.monthTotal)} isMobile={isMobile} />
                {Number(data.deductSum) > 0 && (
                  <div style={{ fontSize: 12, color: '#cf1322', textAlign: 'center', marginTop: 8 }}>另有扣款 −{money(data.deductSum)}（已从合计中扣除）</div>
                )}
              </Card>
              {manager && (
                <Card title="员工占比" style={{ borderRadius: 16 }} styles={{ body: { padding: '14px 16px' } }}>
                  <Donut data={userPie} centerLabel="人数" centerValue={`${(data.users || []).length}`} isMobile={isMobile} />
                </Card>
              )}
            </Col>
          </Row>

          {/* 店长：每人聚合行 */}
          {manager && (
            <Card title={`每人明细（${periodLabel}）`} style={{ borderRadius: 16, marginTop: 16 }} styles={{ body: { padding: isMobile ? '8px 12px' : '10px 18px' } }}>
              {(data.users || []).length === 0 ? (
                <Empty description={`${periodLabel}还没有记录`} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '14px 0' }} />
              ) : (
                (data.users || []).map((u, i) => (
                  <div key={u.userId} style={{ padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar size={30} src={u.avatar || undefined} icon={u.avatar ? undefined : <UserOutlined />} />
                      <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dn(u.userId, u.userNickname)}</span>
                      <span style={{ fontWeight: 800, color: AMBER_DARK, flexShrink: 0 }}>{money(u.total)}</span>
                    </div>
                    <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4, marginLeft: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{u.days} 天 · {fmtHours(u.minutes)}</span>
                      <span>工时 {money(u.base)}</span>
                      {Number(u.skewer) > 0 && <span>穿串 {money(u.skewer)}</span>}
                      {Number(u.deduct) > 0 && <span style={{ color: '#cf1322' }}>扣款 −{money(u.deduct)}</span>}
                      <span style={{ color: Number(u.unsettled) > 0 ? '#d4380d' : '#52c41a' }}>
                        未结清 {money(u.unsettled)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </Card>
          )}

          {/* 店员：自己的逐条记录 */}
          {!manager && (
            <Card title={`${scoped ? `${scopeName} 的记录` : '我的记录'}（${periodLabel}）`} style={{ borderRadius: 16, marginTop: 16 }} styles={{ body: { padding: isMobile ? '10px 12px' : '12px 18px' } }}>
              {(data.records || []).length === 0 ? (
                <Empty description={`${periodLabel}还没有记录`} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '14px 0' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(data.records || []).map((r) => (
                    <div
                      key={r.recordId}
                      style={{
                        padding: '11px 13px', borderRadius: 12, background: '#fffdf5',
                        borderLeft: `4px solid ${r.settled ? '#d9d9d9' : AMBER}`, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {dayjs(r.date).format('M月D日')}
                          <span style={{ color: '#999', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>周{WEEK[dayjs(r.date).day()]}</span>
                        </span>
                        {r.settled && <Tag style={{ marginInlineEnd: 0 }} color="default">已结清</Tag>}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontWeight: 800, fontSize: 15, color: AMBER_DARK }}>{money(r.total)}</span>
                      </div>
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 5, lineHeight: 1.8 }}>
                        {r.startTime ? (
                          <>
                            {r.startTime}–{toMin(r.endTime) <= toMin(r.startTime) ? `次日${r.endTime}` : r.endTime}
                            （{fmtDur(shiftMin(r.startTime, r.endTime))}）
                            · 时薪 {money(r.hourlyRate)}
                            {r.meal && <span> · 吃饭 −15分钟</span>}
                          </>
                        ) : (
                          <span>仅穿串（没有工时）</span>
                        )}
                        {Number(r.skewerPay) > 0 && (
                          <div style={{ color: AMBER_DARK }}>
                            穿串 +{money(r.skewerPay)}
                            <span style={{ color: '#b8b8b8' }}>（{(r.skewers || []).map((s) => `${s.name}×${s.num}`).join('、')}）</span>
                          </div>
                        )}
                        {Number(r.deduct) > 0 && <div style={{ color: '#cf1322' }}>扣款 −{money(r.deduct)}（{r.deductReason}）</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* 穿串详情：每种串的数量 + 金额（按录入时的快照价），底部合计 */}
      <Modal
        title={`穿串详情（${periodLabel}）`}
        open={skewerDetailOpen}
        onCancel={() => setSkewerDetailOpen(false)}
        footer={null}
        width={isMobile ? '100%' : 420}
      >
        <div style={{ display: 'flex', color: '#999', fontSize: 12, padding: '4px 2px 8px', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ flex: 1 }}>串</span>
          <span style={{ width: 90, textAlign: 'right' }}>串数</span>
          <span style={{ width: 100, textAlign: 'right' }}>金额</span>
        </div>
        {(data?.skewers || []).map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid #fafafa', fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: AMBER, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </span>
            <span style={{ width: 90, textAlign: 'right', fontWeight: 650 }}>{s.num} 串</span>
            <span style={{ width: 100, textAlign: 'right', color: AMBER_DARK, fontWeight: 700 }}>{money(s.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 2px 2px', fontWeight: 800 }}>
          <span style={{ flex: 1, fontSize: 13, color: '#666' }}>合计</span>
          <span style={{ width: 90, textAlign: 'right' }}>{(data?.skewers || []).reduce((s, x) => s + Number(x.num || 0), 0)} 串</span>
          <span style={{ width: 100, textAlign: 'right', color: AMBER_DARK }}>{money((data?.skewers || []).reduce((s, x) => s + Number(x.amount || 0), 0))}</span>
        </div>
      </Modal>
    </>
  )
}
