import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Button, Calendar, Card, Col, DatePicker, Empty, Input, Popconfirm, Row, Segmented, Select, Tag, TimePicker, message } from 'antd'
import {
  CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, FieldTimeOutlined, LeftOutlined, PlusOutlined, RightOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { scheduleApi } from '../../api/schedule'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'

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

/** 超时判定：未完成 且 (截止日 或 开始日)+(截止时刻 或 23:59) 已过 */
const isOverdue = (e) => {
  if (e.done) return false
  return dayjs(`${e.endDate || e.date} ${e.endTime || '23:59'}`, 'YYYY-MM-DD HH:mm').isBefore(dayjs())
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
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [params] = useSearchParams()
  const paramDate = params.get('date')
  const [selected, setSelected] = useState(() => {
    const d = paramDate ? dayjs(paramDate, 'YYYY-MM-DD', true) : null
    return d && d.isValid() ? d : dayjs()
  })
  const [events, setEvents] = useState([])
  const [assignees, setAssignees] = useState([])
  // 新增表单
  const [taskType, setTaskType] = useState('day') // 'day' 单日 | 'deadline' 截止任务
  const [category, setCategory] = useState(undefined) // 类型：工作/学习/课程/生活/娱乐
  const [title, setTitle] = useState('')
  const [timeRange, setTimeRange] = useState(null) // [dayjs|null, dayjs|null]
  const [deadline, setDeadline] = useState(null) // 截止日期（截止任务）
  const [assignee, setAssignee] = useState(undefined)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
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

  // 跨天任务铺满起止之间的每一天（防御性上限 62 天）
  const byDate = useMemo(() => {
    const m = {}
    for (const e of events) {
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

  const addEvent = async () => {
    const t = title.trim()
    if (!t) return message.warning('先写点标题')
    if (taskType === 'deadline' && !deadline) return message.warning('截止任务要选一个截止日期')
    setSaving(true)
    try {
      await scheduleApi.create({
        date: key(selected),
        title: t,
        time: timeRange?.[0] ? timeRange[0].format('HH:mm') : undefined,
        endTime: timeRange?.[1] ? timeRange[1].format('HH:mm') : undefined,
        endDate: taskType === 'deadline' && deadline ? key(deadline) : undefined,
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
      const res = await scheduleApi.toggleDone(e.eventId)
      setEvents((list) => list.map((x) => (x.eventId === e.eventId ? { ...x, done: !!res } : x)))
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
        {list.slice(0, 2).map((e) => {
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
                {e.endDate ? '⏳ ' : e.time ? `${e.time} ` : ''}{e.title}
              </span>
            </div>
          )
        })}
        {list.length > 2 && <div style={{ fontSize: 11, color: '#999', paddingLeft: 6 }}>+{list.length - 2} 项</div>}
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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
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
            `}</style>
            <div className="schedule-cal">
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
            {/* 选中日头部 */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{selected.format('M月D日')}</span>
              <span style={{ fontSize: 13, color: '#999' }}>周{WEEK[selected.day()]}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: '#999' }}>{dayEvents.length ? `${dayEvents.length} 件事` : ''}</span>
            </div>

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
                        {tl && (
                          <div style={{ marginTop: 5 }}>
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
                          </div>
                        )}
                        {e.note && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.note}</div>}
                        {(e.assigneeId || !e.mine) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                            {e.assigneeId && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666', background: '#fff', border: '1px solid #ececec', borderRadius: 999, padding: '1px 9px 1px 2px' }}>
                                <Avatar size={18} src={e.assigneeAvatar || undefined}>{String(e.assigneeName || '?')[0]}</Avatar>
                                {e.assigneeId === selfId ? '我负责' : `${e.assigneeName} 负责`}
                              </span>
                            )}
                            {!e.mine && <span style={{ fontSize: 11, color: '#bbb' }}>来自 {e.ownerName}</span>}
                          </div>
                        )}
                      </div>
                      {e.mine && (
                        <Popconfirm title="删除这个事件？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => del(e)}>
                          <DeleteOutlined style={{ color: '#ccc', cursor: 'pointer', marginTop: 3 }} />
                        </Popconfirm>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEAL_DARK }}>
                  <PlusOutlined style={{ marginRight: 5 }} />给 {selected.format('M月D日')} 添加
                </span>
                <span style={{ flex: 1 }} />
                <Segmented
                  size="small"
                  value={taskType}
                  onChange={setTaskType}
                  options={[{ label: '单日', value: 'day' }, { label: '截止任务', value: 'deadline' }]}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input
                  placeholder="要做什么？"
                  maxLength={50}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPressEnter={addEvent}
                />
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
                  <TimePicker.RangePicker
                    placeholder={taskType === 'deadline' ? ['开始时间', '截止时间'] : ['开始', '结束']}
                    format="HH:mm"
                    minuteStep={5}
                    order={taskType !== 'deadline'}
                    allowEmpty={[true, true]}
                    value={timeRange}
                    onChange={setTimeRange}
                    style={{ flex: 1, minWidth: 170 }}
                  />
                  {taskType === 'deadline' && (
                    <DatePicker
                      placeholder="截止日期"
                      value={deadline}
                      onChange={setDeadline}
                      disabledDate={(d) => d.isBefore(selected, 'day')}
                      style={{ width: 130, flexShrink: 0 }}
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
                        <Avatar size={18} src={a.avatar || undefined}>{String(a.userNickname || '?')[0]}</Avatar>
                        {a.userNickname}
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
                <Button type="primary" loading={saving} onClick={addEvent} style={{ background: TEAL_DARK, borderColor: TEAL_DARK, borderRadius: 8 }}>
                  添加
                </Button>
              </div>
              <div style={{ fontSize: 11, color: '#9bd4d0', marginTop: 8 }}>
                {taskType === 'deadline'
                  ? '截止任务：从这天开始、到截止日期为止（开始时间落在开始日、截止时间落在截止日）；超时未完成会标红并提醒'
                  : '时间段可选；负责人只能是"我自己或关注我的人"，有负责人的事件当天早 8 点自动提醒'}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  )
}
