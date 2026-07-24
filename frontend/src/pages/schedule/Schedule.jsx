import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Button, Calendar, Card, DatePicker, Drawer, Empty, Input, InputNumber, Modal, Popconfirm, Popover, Select, Tag, message } from 'antd'
import {
  CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, EditOutlined, FieldTimeOutlined, LeftOutlined, PlusOutlined, RetweetOutlined, RightOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { scheduleApi } from '../../api/schedule'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'
import TimeField, { TimeClear } from '../../components/TimeField'

/**
 * 日程表（/schedule，登录）。月视图日历 + 选中日面板（移动端在下方）。
 * 事件时刻是**区间**（开始–结束）；「截止任务」跨天：区间左端=开始日的开始时间、右端=截止日的截止时间。
 * 超过截止时刻仍未完成 → 全站标红；到下一个早八点仍未完成才发一次性超时提醒（后端 8 点任务）。
 * 任务可选类型（工作/学习/课程/生活/娱乐），日历胶囊/面板色条/小标签按类型配色。
 */

const TEAL = '#13c2c2'
const TEAL_DARK = '#08979c'
const RED = '#ff4d4f'
const RED_DARK = '#cf1322'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
// 任务类型 → 主题色（无类型回退青色）；超时/完成的状态色优先于类型色
const CATS = { 工作: '#2f54eb', 学习: '#722ed1', 课程: '#d48806', 生活: '#52c41a', 娱乐: '#eb2f96' }
const catColor = (e) => CATS[e.category] || TEAL
const key = (d) => d.format('YYYY-MM-DD')

const ring = (size, pos) => ({
  position: 'absolute', width: size, height: size, borderRadius: '50%',
  background: 'rgba(255,255,255,.10)', ...pos,
})

/** 超时判定：未完成 且 截止时刻已过。循环任务按"这一次"（occDate）判，单次任务按截止日/开始日判 */
const isOverdue = (e) => {
  if (e.done) return false
  const d = e.recur ? (e.occDate || e.date) : (e.endDate || e.date)
  return dayjs(`${d} ${e.endTime || '23:59'}`, 'YYYY-MM-DD HH:mm').isBefore(dayjs())
}

/** 循环标签："每日 · 至 8/15" / "每周四 · 至 9/10" */
const recurLabel = (e) => {
  if (!e.recur) return null
  const end = dayjs(e.recurEnd).format('M/D')
  return e.recur === 'day' ? `每日 · 至 ${end}` : `每周${WEEK[dayjs(e.date).day()]} · 至 ${end}`
}

/** 循环延续弹层：上限约束的是**总时长**（开始日→新截止日 ≤180 天/24 周），按剩余额度限制输入 */
function ExtendPop({ e, onExtend }) {
  const daily = e.recur === 'day'
  const spanDays = dayjs(e.recurEnd).diff(dayjs(e.date), 'day')
  const remain = daily ? 180 - spanDays : Math.floor((168 - spanDays) / 7)
  const [n, setN] = useState(Math.min(daily ? 7 : 4, Math.max(1, remain)))
  if (remain <= 0) {
    return <span style={{ fontSize: 12, color: '#999' }}>该循环总时长已达上限（{daily ? '180 天' : '24 周'}），不能再延续</span>
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#666' }}>延长</span>
      <InputNumber size="small" min={1} max={remain} value={n} onChange={setN} style={{ width: 74 }} />
      <span style={{ fontSize: 12, color: '#666' }}>{daily ? `天（还可延 ${remain} 天）` : `周（还可延 ${remain} 周）`}</span>
      <Button size="small" type="primary" onClick={() => n && onExtend(e, n)}>确定</Button>
    </div>
  )
}

/** 时间标签：截止任务="7/25 09:00 → 7/28 18:00"；单日区间="09:00 – 11:30"；只有开始="09:00" */
const timeLabel = (e) => {
  if (e.endDate) {
    return `${dayjs(e.date).format('M/D')}${e.time ? ` ${e.time}` : ''} → ${dayjs(e.endDate).format('M/D')}${e.endTime ? ` ${e.endTime}` : ''}`
  }
  if (e.time && e.endTime) return `${e.time} – ${e.endTime}`
  return e.time || null
}

export default function Schedule() {
  const { user, dn } = useAuth()
  const isMobile = useIsMobile()
  const [params] = useSearchParams()
  const paramDate = params.get('date')
  const [selected, setSelected] = useState(() => {
    const d = paramDate ? dayjs(paramDate, 'YYYY-MM-DD', true) : null
    return d && d.isValid() ? d : dayjs()
  })
  const [events, setEvents] = useState([])
  // 当天详情弹层（PC 弹窗 / 移动端底部抽屉）；从消息深链带 ?date= 进来时自动打开
  const [detailOpen, setDetailOpen] = useState(() => !!(paramDate && dayjs(paramDate, 'YYYY-MM-DD', true).isValid()))
  const navigate = useNavigate()
  const [assignees, setAssignees] = useState([])
  // 新增表单
  const [taskType, setTaskType] = useState('day') // day 单日 | deadline 截止任务 | rday 每日循环 | rweek 每周循环
  const [category, setCategory] = useState(undefined) // 类型：工作/学习/课程/生活/娱乐
  const [title, setTitle] = useState('')
  const [timeRange, setTimeRange] = useState(null) // ['HH:mm'|null, 'HH:mm'|null]（原生时间输入直接给字符串）
  const [deadline, setDeadline] = useState(null) // 截止日期（截止任务）
  const [assignee, setAssignee] = useState(undefined)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  // 编辑态：非空=表单在改这个事件（复用同一套表单字段）；非循环任务可挪日期（editDate）
  const [editingEvent, setEditingEvent] = useState(null)
  const [editDate, setEditDate] = useState(null)
  const uidRef = useRef(params.get('userInformationId') || null)

  const monthKey = selected.format('YYYY-MM')
  const load = useCallback(async () => {
    try {
      const uid = uidRef.current
      uidRef.current = null
      const rows = await scheduleApi.month(monthKey, uid || undefined)
      setEvents(Array.isArray(rows) ? rows : [])
      if (uid) window.dispatchEvent(new Event('unread-changed'))
    } catch { /* 拦截器已提示 */ }
  }, [monthKey])
  useEffect(() => { load() }, [load])
  useEffect(() => { scheduleApi.assignees().then((r) => setAssignees(Array.isArray(r) ? r : [])).catch(() => {}) }, [])

  // 跨天任务铺满起止之间的每一天；循环任务按步长展开（日=1、周=7），每次发生带 occDate + 按次完成态
  const byDate = useMemo(() => {
    const m = {}
    for (const e of events) {
      if (e.recur) {
        const start = dayjs(e.date)
        const end = dayjs(e.recurEnd)
        const step = e.recur === 'day' ? 1 : 7
        let d = start
        let guard = 0
        while (!d.isAfter(end, 'day') && guard++ < 200) {
          const k = key(d)
          ;(m[k] = m[k] || []).push({ ...e, occDate: k, done: (e.doneDates || []).includes(k) })
          d = d.add(step, 'day')
        }
        continue
      }
      const start = dayjs(e.date)
      const end = e.endDate ? dayjs(e.endDate) : start
      let d = start
      let guard = 0
      while (!d.isAfter(end, 'day') && guard++ < 62) {
        (m[key(d)] = m[key(d)] || []).push(e)
        d = d.add(1, 'day')
      }
    }
    return m
  }, [events])
  const dayEvents = byDate[key(selected)] || []
  const todayList = byDate[key(dayjs())] || []

  const resetForm = () => {
    setTitle('')
    setTimeRange(null)
    setDeadline(null)
    setCategory(undefined)
    setAssignee(undefined)
    setNote('')
  }

  const startEdit = (e) => {
    setEditingEvent(e)
    setTaskType(e.recur === 'day' ? 'rday' : e.recur === 'week' ? 'rweek' : e.endDate ? 'deadline' : 'day')
    setTitle(e.title || '')
    setCategory(e.category || undefined)
    setNote(e.note || '')
    setAssignee(e.assigneeId || undefined)
    setTimeRange([e.time || null, e.endTime || null])
    setDeadline(e.endDate ? dayjs(e.endDate) : null)
    setEditDate(dayjs(e.date))
  }

  const cancelEdit = () => {
    setEditingEvent(null)
    setEditDate(null)
    setTaskType('day')
    resetForm()
  }

  const saveEdit = async () => {
    const e = editingEvent
    const t = title.trim()
    if (!t) return message.warning('先写点标题')
    if (taskType === 'deadline' && !deadline) return message.warning('截止任务要选一个截止日期')
    setSaving(true)
    try {
      await scheduleApi.update({
        eventId: e.eventId,
        date: e.recur ? undefined : key(editDate || dayjs(e.date)),
        title: t,
        time: timeRange?.[0] || undefined,
        endTime: timeRange?.[1] || undefined,
        endDate: !e.recur && taskType === 'deadline' && deadline ? key(deadline) : undefined,
        category: category || undefined,
        note: note.trim() || undefined,
        assigneeId: assignee || undefined,
      })
      message.success('已保存')
      cancelEdit()
      load()
    } catch { /* 拦截器已提示 */ } finally {
      setSaving(false)
    }
  }

  const addEvent = async () => {
    const t = title.trim()
    if (!t) return message.warning('先写点标题')
    if (taskType === 'deadline' && !deadline) return message.warning('截止任务要选一个截止日期')
    const recurring = taskType === 'rday' || taskType === 'rweek'
    if (recurring) {
      if (!deadline) return message.warning('循环任务必须设置循环截止日期')
      const span = deadline.diff(selected, 'day')
      if (taskType === 'rday' && span > 180) return message.warning('每日循环最长 180 天')
      if (taskType === 'rweek' && span > 168) return message.warning('每周循环最长 24 周')
    }
    setSaving(true)
    try {
      await scheduleApi.create({
        date: key(selected),
        title: t,
        time: timeRange?.[0] || undefined,
        endTime: timeRange?.[1] || undefined,
        endDate: taskType === 'deadline' && deadline ? key(deadline) : undefined,
        recur: recurring ? (taskType === 'rday' ? 'day' : 'week') : undefined,
        recurEnd: recurring && deadline ? key(deadline) : undefined,
        category: category || undefined,
        note: note.trim() || undefined,
        assigneeId: assignee || undefined,
      })
      message.success('已添加')
      setTitle('')
      setTimeRange(null)
      setDeadline(null)
      setCategory(undefined)
      setAssignee(undefined)
      setNote('')
      load()
    } catch { /* 拦截器已提示 */ } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (e) => {
    try {
      const res = await scheduleApi.toggleDone(e.eventId, e.recur ? e.occDate : undefined)
      if (e.recur) {
        // 循环任务按次打勾：更新该事件的 doneDates 集合
        setEvents((list) => list.map((x) => (x.eventId === e.eventId
          ? { ...x, doneDates: res ? [...(x.doneDates || []), e.occDate] : (x.doneDates || []).filter((d) => d !== e.occDate) }
          : x)))
      } else {
        setEvents((list) => list.map((x) => (x.eventId === e.eventId ? { ...x, done: !!res } : x)))
      }
    } catch { /* 拦截器已提示 */ }
  }

  const extendRecur = async (e, amount) => {
    try {
      const newEnd = await scheduleApi.extend(e.eventId, amount)
      setEvents((list) => list.map((x) => (x.eventId === e.eventId ? { ...x, recurEnd: newEnd } : x)))
      message.success(`已延续至 ${newEnd}`)
    } catch { /* 拦截器已提示 */ }
  }

  const del = async (e) => {
    try {
      await scheduleApi.remove(e.eventId)
      message.success('已删除')
      setEvents((list) => list.filter((x) => x.eventId !== e.eventId))
    } catch { /* 拦截器已提示 */ }
  }

  // 日历格：桌面=事件小条（最多 2 条 + 计数），移动端=小圆点；超时未完成一律红
  const cellRender = (current, info) => {
    if (info.type !== 'date') return info.originNode
    const list = byDate[key(current)]
    if (!list?.length) return null
    if (isMobile) {
      return (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 1 }}>
          {list.slice(0, 3).map((e) => (
            <span
              key={e.eventId}
              style={{
                width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                background: isOverdue(e) ? RED : e.done ? '#d9d9d9' : catColor(e),
              }}
            />
          ))}
          {list.length > 3 && <span style={{ fontSize: 9, color: '#999', lineHeight: '5px' }}>+</span>}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.slice(0, 4).map((e) => {
          const od = isOverdue(e)
          const c = od ? RED : e.done ? '#bfbfbf' : catColor(e)
          return (
            <div
              key={e.eventId}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, lineHeight: '17px', padding: '1px 8px', borderRadius: 999,
                background: od ? '#fff1f0' : e.done ? '#f5f5f5' : `${c}14`,
                border: `1px solid ${od ? '#ffccc7' : e.done ? '#ececec' : `${c}38`}`,
                color: od ? RED_DARK : e.done ? '#bfbfbf' : c,
                overflow: 'hidden', whiteSpace: 'nowrap',
                textDecoration: e.done ? 'line-through' : 'none',
                fontWeight: od ? 600 : 500,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.recur ? '🔁 ' : e.endDate ? '⏳ ' : e.time ? `${e.time} ` : ''}{e.title}
              </span>
            </div>
          )
        })}
        {list.length > 4 && <div style={{ fontSize: 11, color: '#999', paddingLeft: 6 }}>+{list.length - 4} 项</div>}
      </div>
    )
  }

  const selfId = user?.userId

  return (
    <>
      {/* 横幅：青色渐变 */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16, color: '#fff',
          padding: isMobile ? '16px 14px' : '22px 28px', marginBottom: 16,
          background: 'linear-gradient(120deg, #006d75 0%, #08979c 55%, #13c2c2 100%)',
        }}
      >
        <div style={ring(170, { top: -70, right: 100 })} />
        <div style={ring(110, { bottom: -45, right: 260 })} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
            <CalendarOutlined style={{ marginRight: 8 }} />日程
          </div>
          <div style={{ opacity: 0.88, marginTop: 6, fontSize: 13 }}>
            点一天，安排一件事；带负责人的事件当天早上 8 点自动提醒，超时未完成会标红并提醒
            {todayList.length > 0 && <span style={{ marginLeft: 10, fontWeight: 700 }}>· 今天 {todayList.filter((e) => !e.done).length}/{todayList.length} 件待办</span>}
          </div>
        </div>
      </div>

      {/* 大日历占满整行：一眼看清每天的大致安排；点日期格子弹出当天详情 */}
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? '10px 8px' : '14px 18px' } }}>
            {/* 自绘月份头：‹ 2026年7月 › + 回到今天（青色胶囊） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 10px' }}>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setSelected((s) => s.subtract(1, 'month'))} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>{selected.format('YYYY 年 M 月')}</span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setSelected((s) => s.add(1, 'month'))} />
              <span style={{ flex: 1 }} />
              <span
                onClick={() => setSelected(dayjs())}
                style={{
                  cursor: 'pointer', userSelect: 'none', padding: '3px 14px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600, color: TEAL_DARK, background: '#e6fffb',
                  border: `1px solid ${TEAL}66`, transition: 'all .15s', whiteSpace: 'nowrap',
                }}
              >
                回到今天
              </span>
            </div>
            <style>{`
              .schedule-cal .ant-picker-cell-selected .ant-picker-calendar-date { background: #e6fffb !important; }
              .schedule-cal .ant-picker-calendar-date-today { border-color: ${TEAL} !important; }
              .schedule-cal .ant-picker-cell-selected .ant-picker-calendar-date-value { color: ${TEAL_DARK} !important; font-weight: 700; }
              /* 桌面端把格子拉高：默认 ~86px 太局促，反正整页可滚，给足空间放 4 条胶囊 */
              @media (min-width: 768px) {
                .schedule-cal .ant-picker-calendar-date-content { height: 132px !important; }
              }
            `}</style>
            <div className="schedule-cal">
              <Calendar
                fullscreen={!isMobile}
                value={selected}
                onSelect={(d, info) => { setSelected(d); if (info?.source === 'date') setDetailOpen(true) }}
                headerRender={() => null}
                cellRender={cellRender}
              />
            </div>
          </Card>

      {/* 移动端日历下方的「接下来 7 天」速览：填补原面板留下的空档，点某天直接开抽屉。
          事件数据来自当前加载的月份，所以只在浏览本月时展示（翻到别的月份就收起） */}
      {isMobile && monthKey === dayjs().format('YYYY-MM') && (
        <Card style={{ borderRadius: 16, marginTop: 16 }} styles={{ body: { padding: '12px 14px' } }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEAL_DARK, marginBottom: 8 }}>
            <FieldTimeOutlined style={{ marginRight: 6 }} />接下来 7 天
          </div>
          {(() => {
            const days = Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day'))
            const rows = days.filter((d) => (byDate[key(d)] || []).length > 0)
            if (rows.length === 0) {
              return <div style={{ color: '#9bd4d0', fontSize: 13, padding: '6px 0' }}>未来 7 天没有安排，点上面日历的某一天加一件</div>
            }
            return rows.map((d) => {
              const list = byDate[key(d)] || []
              const undone = list.filter((e) => !e.done).length
              return (
                <div
                  key={key(d)}
                  onClick={() => { setSelected(d); setDetailOpen(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderTop: '1px solid #f5f5f5', cursor: 'pointer' }}
                >
                  <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: d.isSame(dayjs(), 'day') ? TEAL_DARK : '#262626' }}>
                      {d.isSame(dayjs(), 'day') ? '今天' : d.format('M/D')}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>周{WEEK[d.day()]}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {list.slice(0, 3).map((e) => (
                      <div key={`${e.eventId}-${e.occDate || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, lineHeight: 1.9, minWidth: 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isOverdue(e) ? RED : e.done ? '#d9d9d9' : catColor(e) }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: e.done ? '#bbb' : '#595959', textDecoration: e.done ? 'line-through' : 'none' }}>
                          {e.time ? `${e.time} ` : ''}{e.title}
                        </span>
                      </div>
                    ))}
                    {list.length > 3 && <div style={{ fontSize: 12, color: '#999' }}>还有 {list.length - 3} 项…</div>}
                  </div>
                  <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0 }}>{undone ? `${undone} 待办` : '全部完成'}</span>
                  <RightOutlined style={{ fontSize: 10, color: '#ccc', flexShrink: 0 }} />
                </div>
              )
            })
          })()}
        </Card>
      )}

      {/* 当天详情：PC=居中弹窗、移动端=底部抽屉（拇指顺手、和 PC 交互一致）。
          detailBody 是普通 JSX 变量而非内部组件——内部组件会因身份变化整树重挂、输入框丢焦点（Burning 踩过） */}
      {(() => {
        const detailTitle = (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{selected.format('M月D日')}</span>
            <span style={{ fontSize: 13, color: '#999', fontWeight: 400 }}>
              周{WEEK[selected.day()]}{dayEvents.length ? ` · ${dayEvents.length} 件事` : ''}
            </span>
          </span>
        )
        const detailBody = (
          <>

            {/* 当天事件列表 */}
            {dayEvents.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {dayEvents.map((e) => {
                  const od = isOverdue(e)
                  const assignedToMe = e.assigneeId === selfId && !e.mine
                  const canToggle = e.mine || e.assigneeId === selfId
                  const bar = od ? RED : e.done ? '#d9d9d9' : assignedToMe ? '#fa8c16' : catColor(e)
                  const bg = od ? '#fff1f0' : e.done ? '#fafafa' : assignedToMe ? '#fff9f0' : `${catColor(e)}0d`
                  const tl = timeLabel(e)
                  return (
                    <div
                      key={e.eventId}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px',
                        borderRadius: 12, background: bg, border: 'none',
                        borderLeft: `4px solid ${bar}`, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                        opacity: e.done ? 0.62 : 1, transition: 'all .15s',
                      }}
                    >
                      {canToggle && (
                        <span
                          onClick={() => toggleDone(e)}
                          title={e.done ? '取消完成' : '标记完成'}
                          style={{ cursor: 'pointer', fontSize: 19, color: e.done ? '#52c41a' : '#c9c9c9', marginTop: 1, flexShrink: 0 }}
                        >
                          {e.done ? <CheckCircleFilled /> : <CheckCircleOutlined />}
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontWeight: 650, fontSize: 14, wordBreak: 'break-all',
                              textDecoration: e.done ? 'line-through' : 'none', color: e.done ? '#999' : od ? RED_DARK : '#262626',
                            }}
                          >
                            {e.title}
                          </span>
                          {e.category && (
                            <span style={{ fontSize: 11, lineHeight: '17px', padding: '0 7px', borderRadius: 999, background: `${catColor(e)}14`, color: catColor(e), border: `1px solid ${catColor(e)}38`, flexShrink: 0 }}>
                              {e.category}
                            </span>
                          )}
                          {od && <Tag color="red" style={{ marginInlineEnd: 0, lineHeight: '18px' }}>已超时</Tag>}
                        </div>
                        {(tl || e.recur) && (
                          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {tl && (
                              <span
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                                  color: od ? RED_DARK : TEAL_DARK, background: od ? '#ffd8d6' : '#e0f7f5',
                                  borderRadius: 6, padding: '1px 8px',
                                }}
                              >
                                {e.endDate ? <FieldTimeOutlined /> : <ClockCircleOutlined />}
                                {tl}
                              </span>
                            )}
                            {e.recur && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#531dab', background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: 6, padding: '0 8px' }}>
                                <RetweetOutlined />{recurLabel(e)}
                              </span>
                            )}
                            {e.recur && e.mine && (
                              <Popover trigger="click" content={<ExtendPop e={e} onExtend={extendRecur} />}>
                                <a style={{ fontSize: 12 }}>延续</a>
                              </Popover>
                            )}
                          </div>
                        )}
                        {e.note && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.note}</div>}
                        {(e.assigneeId || !e.mine) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                            {e.assigneeId && (
                              <span
                                onClick={() => navigate(`/users/${e.assigneeId}`)}
                                title="进入个人主页"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666', cursor: 'pointer', background: '#fff', border: '1px solid #ececec', borderRadius: 999, padding: '1px 9px 1px 2px' }}
                              >
                                <Avatar size={18} src={e.assigneeAvatar || undefined}>{String(dn(e.assigneeId, e.assigneeName) || '?')[0]}</Avatar>
                                {dn(e.assigneeId, e.assigneeName)}{e.assigneeId === selfId ? '（我）' : ''}
                              </span>
                            )}
                            {!e.mine && <span style={{ fontSize: 11, color: '#bbb' }}>来自 {dn(e.ownerId, e.ownerName)}</span>}
                          </div>
                        )}
                      </div>
                      {e.mine && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3, flexShrink: 0 }}>
                          <EditOutlined title="编辑" style={{ color: '#bbb', cursor: 'pointer' }} onClick={() => startEdit(e)} />
                          <Popconfirm title="删除这个事件？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => del(e)}>
                            <DeleteOutlined style={{ color: '#ccc', cursor: 'pointer' }} />
                          </Popconfirm>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这天还没有安排" style={{ margin: '18px 0' }} />
            )}

            {/* 新增表单 */}
            <div style={{ background: '#f6fffd', border: `1px dashed ${TEAL}55`, borderRadius: 12, padding: '12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: TEAL_DARK, marginBottom: 8 }}>
                {editingEvent
                  ? <><EditOutlined style={{ marginRight: 5 }} />编辑「{String(editingEvent.title || '').slice(0, 12)}」</>
                  : <><PlusOutlined style={{ marginRight: 5 }} />给 {selected.format('M月D日')} 添加</>}
                <span style={{ flex: 1 }} />
                {editingEvent && <a style={{ fontSize: 12, fontWeight: 400 }} onClick={cancelEdit}>取消编辑</a>}
              </div>
              {/* 任务类型：青色胶囊组（选中实心、未选描边），替代方块 Segmented */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[['day', '单日'], ['deadline', '截止任务'], ['rday', '每日循环'], ['rweek', '每周循环']].map(([v, label]) => {
                  const active = taskType === v
                  return (
                    <span
                      key={v}
                      onClick={() => { if (!editingEvent) setTaskType(v) }}
                      style={{
                        cursor: editingEvent ? 'not-allowed' : 'pointer', userSelect: 'none', padding: '3px 13px', borderRadius: 999,
                        opacity: editingEvent && !active ? 0.35 : 1,
                        fontSize: 12, fontWeight: active ? 700 : 400, whiteSpace: 'nowrap',
                        color: active ? '#fff' : TEAL_DARK,
                        background: active ? TEAL_DARK : '#fff',
                        border: `1px solid ${active ? TEAL_DARK : `${TEAL}55`}`,
                        boxShadow: active ? '0 2px 6px rgba(8,151,156,.25)' : 'none',
                        transition: 'all .15s',
                      }}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input
                  placeholder="要做什么？"
                  maxLength={50}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPressEnter={addEvent}
                />
                {editingEvent && !editingEvent.recur && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>日期</span>
                    <DatePicker value={editDate} onChange={setEditDate} allowClear={false} inputReadOnly style={{ width: 140 }} />
                    <span style={{ fontSize: 11, color: '#9bd4d0' }}>可以把这件事挪到别的日子</span>
                  </div>
                )}
                {editingEvent && editingEvent.recur && (
                  <div style={{ fontSize: 12, color: '#9bd4d0' }}>循环任务的日期与循环范围不可改；要延长循环用事件卡上的「延续」</div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Select
                    allowClear
                    placeholder="类型"
                    value={category}
                    onChange={setCategory}
                    style={{ width: 92, flexShrink: 0 }}
                    options={Object.entries(CATS).map(([name, c]) => ({
                      value: name,
                      label: (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{name}
                        </span>
                      ),
                    }))}
                  />
                  {/* 原生 time 输入（TimeField）：移动端弹系统时间轮、页面不再跟着滚；各自带清空 ✕ */}
                  <span style={{ flex: 1, minWidth: 190, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <TimeField value={timeRange?.[0] || null} onChange={(v) => setTimeRange((r) => [v, r?.[1] || null])} style={{ flex: 1 }} />
                    <span style={{ color: '#bbb', flexShrink: 0 }}>{taskType === 'deadline' ? '→' : '–'}</span>
                    <TimeField value={timeRange?.[1] || null} onChange={(v) => setTimeRange((r) => [r?.[0] || null, v])} style={{ flex: 1 }} />
                    <TimeClear visible={!!(timeRange?.[0] || timeRange?.[1])} onClear={() => setTimeRange(null)} />
                  </span>
                  {taskType !== 'day' && !(editingEvent && editingEvent.recur) && (
                    <DatePicker
                      placeholder={taskType === 'deadline' ? '截止日期' : '循环截止'}
                      value={deadline}
                      onChange={setDeadline}
                      disabledDate={(d) => {
                        const base = editingEvent ? (editDate || dayjs(editingEvent.date)) : selected
                        return d.isBefore(taskType === 'deadline' ? base : base.add(1, 'day'), 'day')
                          || (taskType === 'rday' && d.diff(base, 'day') > 180)
                          || (taskType === 'rweek' && d.diff(base, 'day') > 168)
                      }}
                      style={{ width: 130, flexShrink: 0 }}
                      inputReadOnly
                    />
                  )}
                </div>
                <Select
                  allowClear
                  placeholder="负责人(可选)"
                  value={assignee}
                  onChange={setAssignee}
                  style={{ width: '100%' }}
                  options={assignees.map((a) => ({
                    value: a.userId,
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Avatar size={18} src={a.avatar || undefined}>{String(dn(a.userId, a.userNickname) || '?')[0]}</Avatar>
                        {dn(a.userId, a.userNickname)}
                      </span>
                    ),
                  }))}
                />
                <Input
                  placeholder="备注(可选)"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onPressEnter={addEvent}
                />
                <Button type="primary" loading={saving} onClick={editingEvent ? saveEdit : addEvent} style={{ background: TEAL_DARK, borderColor: TEAL_DARK, borderRadius: 8 }}>
                  {editingEvent ? '保存修改' : '添加'}
                </Button>
              </div>
              <div style={{ fontSize: 11, color: '#9bd4d0', marginTop: 8 }}>
                {taskType === 'deadline'
                  ? '截止任务：从这天开始、到截止日期为止（开始时间落在开始日、截止时间落在截止日）；超时未完成会标红并提醒'
                  : taskType === 'rday' || taskType === 'rweek'
                    ? `${taskType === 'rday' ? '每天重复（最长 180 天）' : `每周${WEEK[selected.day()]}重复（最长 24 周）`}，必须设循环截止日；每一次单独打勾；结束前一天早 8 点会提醒延续`
                    : '时间段可选；负责人只能是"我自己或关注我的人"，有负责人的事件当天早 8 点自动提醒'}
              </div>
            </div>
          </>
        )
        return isMobile ? (
          <Drawer
            placement="bottom"
            height="82%"
            open={detailOpen}
            onClose={() => { setDetailOpen(false); cancelEdit() }}
            title={detailTitle}
            styles={{ body: { padding: '12px 14px' } }}
          >
            {detailBody}
          </Drawer>
        ) : (
          <Modal open={detailOpen} onCancel={() => { setDetailOpen(false); cancelEdit() }} footer={null} title={detailTitle} width={640}>
            {detailBody}
          </Modal>
        )
      })()}
    </>
  )
}
