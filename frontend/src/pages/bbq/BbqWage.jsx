import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar, Button, Calendar, Card, Col, Empty, Input, InputNumber, Modal, Popconfirm, Row, Select, Spin, Switch, TimePicker, message,
} from 'antd'
import {
  DeleteOutlined, DollarOutlined, EditOutlined, FireOutlined, LeftOutlined, PlusOutlined, RightOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { bbqApi } from '../../api/bbq'
import { Link } from 'react-router-dom'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 耿阿姨烤串 · 薪资计算（店长专属）。日历记账：点一天 → 右侧看当天所有人的记录，
 * 「记一笔」弹窗录入：店员（时薪默认取 TA 上一次的数字）、上下班时刻（结束早于开始=干到次日）、
 * 吃饭扣 15 分钟、其他扣款（必须写原因）、穿串（按串价设置的价目选，价格进快照）。
 * 当日合计后端算，前端同步演算做实时预览。可按店员多选筛选。
 */

const AMBER = '#d48806'
const AMBER_DARK = '#ad6800'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

const money = (n) => `$${Number(n || 0).toFixed(2)}`
const toMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0)
/** raw shift minutes; end<=start means past midnight */
const shiftMin = (start, end) => {
  let d = toMin(end) - toMin(start)
  if (d <= 0) d += 24 * 60
  return d
}
const fmtDur = (min) => `${Math.floor(min / 60)}小时${min % 60 ? `${min % 60}分` : ''}`
const overnight = (start, end) => toMin(end) <= toMin(start)

export default function BbqWage() {
  const isMobile = useIsMobile()
  const [selected, setSelected] = useState(dayjs())
  const [monthRecords, setMonthRecords] = useState([])
  const [dayRecords, setDayRecords] = useState(null)
  const [staff, setStaff] = useState([])
  const [types, setTypes] = useState([])
  const [filterIds, setFilterIds] = useState([])

  // ===== 弹窗表单状态 =====
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null) // 编辑中的记录（null=新增）
  const [fUser, setFUser] = useState(null)
  const [fRate, setFRate] = useState(null)
  const [fStart, setFStart] = useState(null) // dayjs
  const [fEnd, setFEnd] = useState(null)
  const [fMeal, setFMeal] = useState(false)
  const [fDeduct, setFDeduct] = useState(null)
  const [fReason, setFReason] = useState('')
  const [fLines, setFLines] = useState([]) // [{key, typeId, num}]
  const [saving, setSaving] = useState(false)
  // 编辑旧记录时，行里可能引用已删除/已改价的串——快照价按这里回显
  const [snapPrices, setSnapPrices] = useState({})
  // 结清：预览列表（确认弹窗），null=关闭
  const [settleRows, setSettleRows] = useState(null)
  const [settling, setSettling] = useState(false)

  const dateStr = selected.format('YYYY-MM-DD')
  const monthStr = selected.format('YYYY-MM')

  const loadMonth = useCallback(() => {
    bbqApi.wageMonth(monthStr).then((r) => setMonthRecords(Array.isArray(r) ? r : [])).catch(() => setMonthRecords([]))
  }, [monthStr])
  const loadDay = useCallback(() => {
    setDayRecords(null)
    bbqApi.wageDay(dateStr).then((r) => setDayRecords(Array.isArray(r) ? r : [])).catch(() => setDayRecords([]))
  }, [dateStr])

  useEffect(() => { loadMonth() }, [loadMonth])
  useEffect(() => { loadDay() }, [loadDay])
  useEffect(() => {
    bbqApi.staffList().then((r) => setStaff(Array.isArray(r) ? r : [])).catch(() => setStaff([]))
    bbqApi.skewerList().then((r) => setTypes(Array.isArray(r) ? r : [])).catch(() => setTypes([]))
  }, [])

  const byDate = useMemo(() => {
    const map = {}
    monthRecords
      .filter((r) => filterIds.length === 0 || filterIds.includes(r.userId))
      .forEach((r) => { (map[r.date] = map[r.date] || []).push(r) })
    return map
  }, [monthRecords, filterIds])

  const visibleDay = useMemo(
    () => (dayRecords || []).filter((r) => filterIds.length === 0 || filterIds.includes(r.userId)),
    [dayRecords, filterIds],
  )
  const dayTotal = visibleDay.reduce((s, r) => s + Number(r.total || 0), 0)

  // ===== 表单打开/预填 =====
  const openCreate = () => {
    setEditing(null)
    setFUser(null)
    setFRate(null)
    setFStart(null)
    setFEnd(null)
    setFMeal(false)
    setFDeduct(null)
    setFReason('')
    setFLines([])
    setSnapPrices({})
    setOpen(true)
  }
  const openEdit = (r) => {
    setEditing(r)
    setFUser(r.userId)
    setFRate(Number(r.hourlyRate))
    setFStart(dayjs(`2000-01-01 ${r.startTime}`))
    setFEnd(dayjs(`2000-01-01 ${r.endTime}`))
    setFMeal(!!r.meal)
    setFDeduct(Number(r.deduct) > 0 ? Number(r.deduct) : null)
    setFReason(r.deductReason || '')
    setFLines((r.skewers || []).map((s, i) => ({ key: `${i}`, typeId: s.typeId, num: s.num })))
    const snaps = {}
    ;(r.skewers || []).forEach((s) => { if (s.typeId) snaps[s.typeId] = { name: s.name, price: Number(s.price) } })
    setSnapPrices(snaps)
    setOpen(true)
  }

  // 选人时时薪自动带上 TA 上一次的数字（可改）
  const pickUser = (uid) => {
    setFUser(uid)
    const s = staff.find((x) => x.userId === uid)
    if (s?.lastRate != null) setFRate(Number(s.lastRate))
  }

  // ===== 穿串行 =====
  const addLine = () => setFLines((ls) => [...ls, { key: `${Date.now()}-${ls.length}`, typeId: null, num: null }])
  const setLine = (key, patch) => setFLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const rmLine = (key) => setFLines((ls) => ls.filter((l) => l.key !== key))

  // 价格：现价目里有 → 现价（编辑中的旧行优先快照价）；只在快照里 → 快照价
  const priceOf = (typeId) => {
    if (!typeId) return 0
    if (snapPrices[typeId] != null) return snapPrices[typeId].price
    const t = types.find((x) => x.typeId === typeId)
    return t ? Number(t.unitPrice) : 0
  }
  const typeOptions = useMemo(() => {
    const opts = types.map((t) => ({ value: t.typeId, label: `${t.name}（${money(t.unitPrice)}/串）` }))
    Object.entries(snapPrices).forEach(([id, s]) => {
      if (!types.some((t) => t.typeId === id)) opts.push({ value: id, label: `${s.name}（${money(s.price)}/串 · 旧价目）` })
    })
    return opts
  }, [types, snapPrices])

  // ===== 实时预览（后端为准，这里同步演算） =====
  const preview = useMemo(() => {
    if (!fRate || !fStart || !fEnd) return null
    const raw = shiftMin(fStart.format('HH:mm'), fEnd.format('HH:mm'))
    const paid = Math.max(0, raw - (fMeal ? 15 : 0))
    const base = Math.round((fRate * paid) / 60 * 100) / 100
    const skewer = fLines.reduce((s, l) => s + (l.typeId && l.num ? priceOf(l.typeId) * l.num : 0), 0)
    const ded = Number(fDeduct || 0)
    return { raw, paid, base, skewer, ded, total: base + skewer - ded }
  }, [fRate, fStart, fEnd, fMeal, fDeduct, fLines, types, snapPrices]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 保存/删除 =====
  const doSave = async () => {
    if (!fUser) return message.info('先选店员')
    if (!(fRate > 0)) return message.info('时薪要大于 0')
    if (!fStart || !fEnd) return message.info('把上下班时刻填完整')
    if (fDeduct > 0 && !fReason.trim()) return message.info('有扣款必须写明原因')
    const badLine = fLines.find((l) => !l.typeId || !(l.num > 0))
    if (badLine) return message.info('穿串每行都要选串并填串数（不需要的行请删掉）')
    setSaving(true)
    try {
      await bbqApi.wageSave({
        recordId: editing?.recordId,
        userId: fUser,
        workDate: dateStr,
        startTime: fStart.format('HH:mm'),
        endTime: fEnd.format('HH:mm'),
        hourlyRate: Number(fRate).toFixed(2),
        meal: fMeal ? '1' : '0',
        deduct: fDeduct > 0 ? Number(fDeduct).toFixed(2) : undefined,
        deductReason: fDeduct > 0 ? fReason.trim() : undefined,
        skewers: fLines.length ? JSON.stringify(fLines.map((l) => ({ typeId: l.typeId, num: l.num }))) : undefined,
      })
      message.success('已保存')
      setOpen(false)
      loadMonth()
      loadDay()
      bbqApi.staffList().then((r) => setStaff(Array.isArray(r) ? r : [])).catch(() => {}) // 刷新"上一次时薪"
    } catch { /* 已提示 */ } finally { setSaving(false) }
  }

  const doDelete = async (r) => {
    try {
      await bbqApi.wageDelete(r.recordId)
      message.success('已删除')
      loadMonth()
      loadDay()
    } catch { /* 已提示 */ }
  }

  // ===== 结清：按当前筛选（不筛选=全部有未结清账的人，含已离店的），先预览确认再执行 =====
  const scopeIds = filterIds.length ? JSON.stringify(filterIds) : undefined
  const openSettle = async () => {
    try {
      const rows = await bbqApi.settlePreview(scopeIds)
      if (!Array.isArray(rows) || rows.length === 0) return message.info('没有可结清的记录')
      setSettleRows(rows)
    } catch { /* 已提示 */ }
  }
  const doSettle = async () => {
    setSettling(true)
    try {
      const r = await bbqApi.settleConfirm(scopeIds)
      message.success(`已结清 ${r?.users ?? ''} 人，共 ${money(r?.amount)}`)
      setSettleRows(null)
      loadMonth()
      loadDay()
    } catch { /* 已提示 */ } finally { setSettling(false) }
  }

  // ===== 日历格子：桌面=姓名+金额胶囊（最多 2 条），移动端=小圆点（格子太小装不下胶囊） =====
  const cellRender = (date, info) => {
    if (info.type !== 'date') return info.originNode
    const list = byDate[date.format('YYYY-MM-DD')] || []
    if (!list.length) return null
    if (isMobile) {
      return (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 1 }}>
          {list.slice(0, 3).map((r) => (
            <span key={r.recordId} style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: AMBER }} />
          ))}
          {list.length > 3 && <span style={{ fontSize: 9, color: '#999', lineHeight: '5px' }}>+</span>}
        </div>
      )
    }
    const shown = 2
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
        {list.slice(0, shown).map((r) => (
          <div
            key={r.recordId}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, lineHeight: '17px', padding: '1px 8px', borderRadius: 999,
              background: r.settled ? '#f5f5f5' : '#fffbe6',
              border: `1px solid ${r.settled ? '#e8e8e8' : '#ffe58f'}`,
              color: r.settled ? '#999' : AMBER_DARK,
              overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.settled ? '#bfbfbf' : AMBER, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.userNickname} {money(r.total)}</span>
          </div>
        ))}
        {list.length > shown && <div style={{ fontSize: 11, color: '#999', paddingLeft: 6 }}>+{list.length - shown} 条</div>}
      </div>
    )
  }

  const ring = (size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,.16)', ...pos })

  return (
    <>
      {/* 横幅：炭火琥珀 */}
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
            <FireOutlined style={{ marginRight: 8 }} />耿阿姨烤串 · 薪资计算
          </div>
          <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
            点一天记账：时薪 × 工时（吃饭扣 15 分钟）− 扣款 + 穿串。结束早于开始 = 干到次日。
          </div>
        </div>
      </div>

      {/* 店员筛选（多选，默认全部）+ 结清按钮（结清范围跟随筛选） */}
      <Card style={{ borderRadius: 16, marginBottom: 16 }} styles={{ body: { padding: '10px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#666', fontWeight: 600, flexShrink: 0 }}>筛选店员</span>
          <Select
            mode="multiple"
            allowClear
            style={{ flex: 1, minWidth: 200 }}
            placeholder="默认显示全部成员的记录"
            value={filterIds}
            onChange={setFilterIds}
            optionFilterProp="label"
            options={staff.map((s) => ({ value: s.userId, label: s.userNickname }))}
          />
          <Button icon={<DollarOutlined />} onClick={openSettle} style={{ color: AMBER_DARK, borderColor: '#ffd666', background: '#fffbe6', fontWeight: 600 }}>
            结清薪资{filterIds.length > 0 ? '（按筛选）' : ''}
          </Button>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? '10px 8px' : '14px 18px' } }}>
            {/* 自绘月份头：‹ 2026年7月 › + 回到今天（琥珀胶囊） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 10px' }}>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setSelected((s) => s.subtract(1, 'month'))} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>{selected.format('YYYY 年 M 月')}</span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setSelected((s) => s.add(1, 'month'))} />
              <span style={{ flex: 1 }} />
              <span
                onClick={() => setSelected(dayjs())}
                style={{
                  cursor: 'pointer', userSelect: 'none', padding: '3px 14px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600, color: AMBER_DARK, background: '#fffbe6',
                  border: '1px solid #ffe58f', whiteSpace: 'nowrap',
                }}
              >
                回到今天
              </span>
            </div>
            <style>{`
              .bbq-cal .ant-picker-cell-selected .ant-picker-calendar-date { background: #fffbe6 !important; }
              .bbq-cal .ant-picker-calendar-date-today { border-color: ${AMBER} !important; }
              .bbq-cal .ant-picker-cell-selected .ant-picker-calendar-date-value { color: ${AMBER_DARK} !important; font-weight: 700; }
            `}</style>
            <div className="bbq-cal">
              <Calendar
                fullscreen={!isMobile}
                value={selected}
                onSelect={(d) => setSelected(d)}
                headerRender={() => null}
                cellRender={cellRender}
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? '14px 14px' : '16px 18px' } }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{selected.format('M月D日')}</span>
              <span style={{ fontSize: 13, color: '#999' }}>周{WEEK[selected.day()]}</span>
              <span style={{ flex: 1 }} />
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ background: AMBER }}>
                记一笔
              </Button>
            </div>

            {dayRecords === null ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : visibleDay.length === 0 ? (
              <Empty description="这天还没有记录" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '18px 0' }} />
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visibleDay.map((r) => (
                    <div
                      key={r.recordId}
                      style={{
                        padding: '11px 13px', borderRadius: 12, background: r.settled ? '#fafafa' : '#fffdf5',
                        borderLeft: `4px solid ${r.settled ? '#d9d9d9' : AMBER}`, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar size={24} src={r.avatar || undefined} icon={r.avatar ? undefined : <UserOutlined />} />
                        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.userNickname}
                        </span>
                        {r.settled && <span style={{ fontSize: 11, color: '#999', background: '#f0f0f0', borderRadius: 999, padding: '1px 8px', flexShrink: 0 }}>已结清</span>}
                        <span style={{ fontWeight: 800, fontSize: 15, color: r.settled ? '#8c8c8c' : AMBER_DARK, flexShrink: 0 }}>{money(r.total)}</span>
                        {/* 已结清的记录锁定：不给编辑/删除入口（后端也拒） */}
                        {!r.settled && (
                          <span style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 2 }}>
                            <EditOutlined style={{ color: '#999', cursor: 'pointer' }} onClick={() => openEdit(r)} />
                            <Popconfirm title="删除这条记录？" onConfirm={() => doDelete(r)} okText="删除" cancelText="取消">
                              <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} />
                            </Popconfirm>
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 6, lineHeight: 1.8 }}>
                        {r.startTime}–{overnight(r.startTime, r.endTime) ? `次日${r.endTime}` : r.endTime}
                        （{fmtDur(shiftMin(r.startTime, r.endTime))}）
                        · 时薪 {money(r.hourlyRate)}
                        {r.meal && <span> · 吃饭 −15分钟</span>}
                        {Number(r.skewerPay) > 0 && (
                          <div style={{ color: AMBER_DARK }}>
                            穿串 +{money(r.skewerPay)}
                            <span style={{ color: '#b8b8b8' }}>（{(r.skewers || []).map((s) => `${s.name}×${s.num}`).join('、')}）</span>
                          </div>
                        )}
                        {Number(r.deduct) > 0 && (
                          <div style={{ color: '#cf1322' }}>扣款 −{money(r.deduct)}（{r.deductReason}）</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px dashed #f0f0f0' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>当日合计{filterIds.length > 0 ? '（已筛选）' : ''}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontWeight: 800, fontSize: 17, color: AMBER_DARK }}>{money(dayTotal)}</span>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* 记账弹窗 */}
      <Modal
        title={`${editing ? '改一笔' : '记一笔'} · ${selected.format('M月D日')}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={doSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
        width={isMobile ? '100%' : 560}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>店员</div>
            <Select
              style={{ width: '100%' }}
              placeholder={staff.length ? '选择店员' : '还没有成员，先到「成员管理」添加'}
              value={fUser}
              onChange={pickUser}
              disabled={!!editing}
              showSearch
              optionFilterProp="label"
              options={staff.map((s) => ({ value: s.userId, label: `${s.userNickname}${s.role === 'manager' ? '（店长）' : ''}` }))}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>时薪（$/小时）</div>
              <InputNumber value={fRate} onChange={setFRate} min={0.01} max={999.99} step={0.5} precision={2} prefix="$" style={{ width: 140 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>上班 – 下班</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TimePicker value={fStart} onChange={setFStart} format="HH:mm" minuteStep={5} placeholder="开始" style={{ width: 96 }} />
                <span style={{ color: '#bbb' }}>–</span>
                <TimePicker value={fEnd} onChange={setFEnd} format="HH:mm" minuteStep={5} placeholder="结束" style={{ width: 96 }} />
              </div>
              {fStart && fEnd && overnight(fStart.format('HH:mm'), fEnd.format('HH:mm')) && (
                <div style={{ fontSize: 12, color: AMBER_DARK, marginTop: 4 }}>结束早于开始，按「干到次日」计算</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#666' }}>吃饭</span>
            <Switch checked={fMeal} onChange={setFMeal} size="small" />
            <span style={{ fontSize: 12, color: '#999' }}>吃了扣 15 分钟工时</span>
          </div>

          <div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>其他扣款（可空）</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <InputNumber value={fDeduct} onChange={setFDeduct} min={0} max={99999.99} step={1} precision={2} prefix="$" placeholder="0.00" style={{ width: 140 }} />
              <Input
                value={fReason}
                onChange={(e) => setFReason(e.target.value)}
                placeholder={fDeduct > 0 ? '扣款原因（必填）' : '扣款原因'}
                maxLength={100}
                style={{ flex: 1, minWidth: 180 }}
                status={fDeduct > 0 && !fReason.trim() ? 'warning' : undefined}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#666' }}>穿串工资</span>
              {types.length === 0 && Object.keys(snapPrices).length === 0 ? (
                <span style={{ fontSize: 12, color: '#999' }}>
                  价目表还是空的，先到 <Link to="/bbq/skewers" style={{ color: AMBER }}>串价设置</Link> 添加
                </span>
              ) : (
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addLine}>加一行</Button>
              )}
            </div>
            {fLines.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fLines.map((l) => (
                  <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Select
                      style={{ flex: 1, minWidth: 0 }}
                      placeholder="选串"
                      value={l.typeId}
                      onChange={(v) => setLine(l.key, { typeId: v })}
                      showSearch
                      optionFilterProp="label"
                      options={typeOptions.filter((o) => o.value === l.typeId || !fLines.some((x) => x.typeId === o.value))}
                    />
                    <InputNumber value={l.num} onChange={(v) => setLine(l.key, { num: v })} min={1} max={99999} precision={0} placeholder="串数" style={{ width: 100 }} />
                    <DeleteOutlined style={{ color: '#bbb', cursor: 'pointer' }} onClick={() => rmLine(l.key)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 实时预览（以后端计算为准） */}
          {preview && (
            <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#8c6d1f', lineHeight: 1.9 }}>
              工时 {fmtDur(preview.raw)}{fMeal ? `（吃饭 −15分钟，按 ${fmtDur(preview.paid)} 计）` : ''} → 基本 {money(preview.base)}
              {preview.skewer > 0 && <> + 穿串 {money(preview.skewer)}</>}
              {preview.ded > 0 && <span style={{ color: '#cf1322' }}> − 扣款 {money(preview.ded)}</span>}
              <span style={{ fontWeight: 800, marginLeft: 8 }}>= {money(preview.total)}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* 结清确认弹窗：罗列要结清的人与金额，确认后记录锁死 */}
      <Modal
        title="确定结清这些人的薪资？"
        open={!!settleRows}
        onCancel={() => setSettleRows(null)}
        onOk={doSettle}
        okText="确认结清"
        cancelText="取消"
        confirmLoading={settling}
        width={isMobile ? '100%' : 480}
      >
        <div style={{ color: '#999', fontSize: 13, marginBottom: 10 }}>
          结算范围：{filterIds.length > 0 ? '当前筛选的店员' : '所有有未结清账的人（含已离店的）'}，
          从上次结清后（没结过就从最早记录）到今天。<b>结清后这些记录将锁定，不能再改、不能删。</b>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(settleRows || []).map((s, i) => (
            <div key={s.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderTop: i === 0 ? 'none' : '1px solid #f5f5f5' }}>
              <Avatar size={26} src={s.avatar || undefined} icon={s.avatar ? undefined : <UserOutlined />} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.userNickname}</div>
                <div style={{ color: '#999', fontSize: 12 }}>{s.fromDate === s.toDate ? s.fromDate : `${s.fromDate} ~ ${s.toDate}`} · {s.recordCount} 条</div>
              </div>
              <span style={{ fontWeight: 800, color: AMBER_DARK, flexShrink: 0 }}>{money(s.amount)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #f0f0f0' }}>
          <span style={{ fontSize: 13, color: '#666' }}>合计 {(settleRows || []).length} 人</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontWeight: 800, fontSize: 17, color: AMBER_DARK }}>
            {money((settleRows || []).reduce((sum, s) => sum + Number(s.amount || 0), 0))}
          </span>
        </div>
      </Modal>
    </>
  )
}
