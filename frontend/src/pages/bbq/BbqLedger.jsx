import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Card, Col, Empty, Row, Spin, Tag } from 'antd'
import { FireOutlined, LeftOutlined, RightOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { bbqApi } from '../../api/bbq'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 耿阿姨烤串 · 薪资台账。数字全由后端算好，这里只画（自绘 SVG，零图表库依赖，同雷达图思路）。
 * - 视图可切「按月 / 按周」（周 = 周一到周日；后端同一接口，月传 month、周传 from/to）；
 * - 店长：全店——统计条 + 每日支出柱状图 + 员工占比环形图 + 薪资结构环形图 + 每人聚合行；
 * - 店员：只有自己——统计条 + 自己的每日柱状 + 结构环形 + 逐条记录明细（含已结清标记）。
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

/** 柱状图：竖条 + 底部刻度（bars: [{label, value, showLabel}]）+ 最大值虚线；hover 有 <title> 提示 */
function BarChart({ bars, isMobile }) {
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
      <text x={W} y={y(max) - 4} textAnchor="end" fontSize={10} fill="#bbb">{money(max)}</text>
      {bars.map((d, i) => {
        const x = i * (barW + gap)
        const zero = d.value <= 0
        return (
          <g key={d.label}>
            <rect
              x={x} y={zero ? H - 26 : y(d.value)} width={barW} rx={Math.min(3, barW / 2)}
              height={zero ? 2 : Math.max(2, H - 24 - y(d.value))}
              fill={zero ? '#f5f5f5' : AMBER} opacity={zero ? 1 : 0.85}
            >
              <title>{`${d.title || d.label}：${money(d.value)}`}</title>
            </rect>
            {/* 周视图条少，柱顶直接标金额 */}
            {n <= 7 && !zero && (
              <text x={x + barW / 2} y={y(d.value) - 5} textAnchor="middle" fontSize={10} fill={AMBER_DARK} fontWeight={700}>
                {money(d.value)}
              </text>
            )}
            {d.showLabel && (
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize={n <= 7 ? 11 : 9} fill={n <= 7 ? '#8c8c8c' : '#bbb'}>{d.label}</text>
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
  const [mode, setMode] = useState('month') // 'month' | 'week'
  const [month, setMonth] = useState(dayjs())
  const [week, setWeek] = useState(mondayOf(dayjs())) // 周一锚点
  const [data, setData] = useState(null)

  const monthStr = month.format('YYYY-MM')
  const weekFrom = week.format('YYYY-MM-DD')
  const weekTo = week.add(6, 'day').format('YYYY-MM-DD')

  useEffect(() => {
    setData(null)
    const params = mode === 'month' ? { month: monthStr } : { from: weekFrom, to: weekTo }
    bbqApi.ledger(params).then(setData).catch(() => setData(undefined))
  }, [mode, monthStr, weekFrom, weekTo])

  // 柱状图条目：月=当月每天（稀疏刻度），周=周一到周日（每条带标签+柱顶金额）
  const bars = useMemo(() => {
    const map = {}
    ;(data?.daily || []).forEach((d) => { map[d.date] = Number(d.total) })
    if (mode === 'month') {
      const n = month.daysInMonth()
      return Array.from({ length: n }, (_, i) => {
        const day = i + 1
        const date = month.date(day).format('YYYY-MM-DD')
        return { label: `${day}`, title: `${day} 日`, value: map[date] || 0, showLabel: i === 0 || day % 5 === 0 || i === n - 1 }
      })
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = week.add(i, 'day')
      const date = d.format('YYYY-MM-DD')
      return { label: `${WEEK[d.day()]} ${d.date()}`, title: d.format('M月D日'), value: map[date] || 0, showLabel: true }
    })
  }, [data, mode, month, week])

  const manager = data?.role === 'manager'
  const periodLabel = mode === 'month' ? '本月' : '本周'
  const userPie = useMemo(() => {
    if (!data) return []
    const rows = (data.users || []).map((u, i) => ({ label: u.userNickname, value: Number(u.total), color: PALETTE[i % PALETTE.length] }))
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
  const pill = (active) => ({
    cursor: 'pointer', userSelect: 'none', padding: '3px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
    color: active ? '#fff' : AMBER_DARK, background: active ? AMBER : 'transparent', transition: 'all .15s', whiteSpace: 'nowrap',
  })

  return (
    <>
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
            <FireOutlined style={{ marginRight: 8 }} />耿阿姨烤串 · 薪资台账
          </div>
          <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
            {manager === false ? '你的工资明细，只读。有疑问找店长核对。' : '全店薪资的分布与结构；结清在「薪资计算」页操作。'}
          </div>
        </div>
      </div>

      {/* 视图切换（月/周）+ 时段导航 */}
      <Card style={{ borderRadius: 16, marginBottom: 16 }} styles={{ body: { padding: '10px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 999, padding: 2 }}>
            <span style={pill(mode === 'month')} onClick={() => setMode('month')}>按月</span>
            <span style={pill(mode === 'week')} onClick={() => setMode('week')}>按周</span>
          </span>
          <span style={{ flex: isMobile ? '1 1 100%' : 1 }} />
          {mode === 'month' ? (
            <>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setMonth((m) => m.subtract(1, 'month'))} />
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{month.format('YYYY 年 M 月')}</span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setMonth((m) => m.add(1, 'month'))} />
              <span
                onClick={() => setMonth(dayjs())}
                style={{ cursor: 'pointer', userSelect: 'none', padding: '3px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: AMBER_DARK, background: '#fffbe6', border: '1px solid #ffe58f', whiteSpace: 'nowrap' }}
              >
                回到本月
              </span>
            </>
          ) : (
            <>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setWeek((w) => w.subtract(7, 'day'))} />
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {week.format('M月D日')} ~ {week.add(6, 'day').format('M月D日')}
              </span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setWeek((w) => w.add(7, 'day'))} />
              <span
                onClick={() => setWeek(mondayOf(dayjs()))}
                style={{ cursor: 'pointer', userSelect: 'none', padding: '3px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: AMBER_DARK, background: '#fffbe6', border: '1px solid #ffe58f', whiteSpace: 'nowrap' }}
              >
                回到本周
              </span>
            </>
          )}
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
            <Stat label={manager ? `${periodLabel}总支出` : `${periodLabel}合计`} value={money(data.monthTotal)} />
            <Stat label="工时工资" value={money(data.baseSum)} />
            <Stat label="穿串工资" value={money(data.skewerSum)} />
            <Stat label="扣款" value={`−${money(data.deductSum)}`} tone="#cf1322" />
            <Stat label="未结清累计（全部）" value={money(data.unsettledTotal)} tone="#d4380d" />
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={manager ? 14 : 24}>
              <Card
                title={`每日支出（${mode === 'month' ? month.format('M 月') : '本周'}）`}
                style={{ borderRadius: 16 }}
                styles={{ body: { padding: isMobile ? '12px 10px' : '16px 18px' } }}
              >
                <BarChart bars={bars} isMobile={isMobile} />
              </Card>
            </Col>
            <Col xs={24} lg={manager ? 10 : 24}>
              <Card title="薪资结构" style={{ borderRadius: 16, marginBottom: manager ? 16 : 0 }} styles={{ body: { padding: '14px 16px' } }}>
                <Donut data={structPie} centerLabel={periodLabel} centerValue={money(data.monthTotal)} isMobile={isMobile} />
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
                      <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.userNickname}</span>
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
            <Card title={`我的记录（${mode === 'month' ? month.format('M 月') : '本周'}）`} style={{ borderRadius: 16, marginTop: 16 }} styles={{ body: { padding: isMobile ? '10px 12px' : '12px 18px' } }}>
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
                        {r.startTime}–{toMin(r.endTime) <= toMin(r.startTime) ? `次日${r.endTime}` : r.endTime}
                        （{fmtDur(shiftMin(r.startTime, r.endTime))}）
                        · 时薪 {money(r.hourlyRate)}
                        {r.meal && <span> · 吃饭 −15分钟</span>}
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
    </>
  )
}
