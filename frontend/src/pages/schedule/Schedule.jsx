import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Button, Calendar, Card, Col, Empty, Input, Popconfirm, Row, Select, TimePicker, message } from 'antd'
import {
  CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { scheduleApi } from '../../api/schedule'
import { useAuth } from '../../auth/AuthContext'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 日程表（/schedule，登录）。月视图日历 + 右侧（移动端为下方）选中日面板。
 * 日历 = 我创建的 + 指派给我的事件；负责人只能选"我自己 + 关注我的人"；
 * 有负责人的事件当天早 8 点站内消息提醒（后端定时任务）。青色主题与其他模块区分。
 */

const TEAL = '#13c2c2'
const TEAL_DARK = '#08979c'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const key = (d) => d.format('YYYY-MM-DD')

const ring = (size, pos) => ({
  position: 'absolute', width: size, height: size, borderRadius: '50%',
  background: 'rgba(255,255,255,.10)', ...pos,
})

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
  const [title, setTitle] = useState('')
  const [time, setTime] = useState(null)
  const [assignee, setAssignee] = useState(undefined)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  // 消息深链带的 userInformationId 只消费一次（随首次月数据请求标已读）
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

  const byDate = useMemo(() => {
    const m = {}
    for (const e of events) {
      (m[e.date] = m[e.date] || []).push(e)
    }
    return m
  }, [events])
  const dayEvents = byDate[key(selected)] || []
  const todayList = byDate[key(dayjs())] || []

  const addEvent = async () => {
    const t = title.trim()
    if (!t) return message.warning('先写点标题')
    setSaving(true)
    try {
      await scheduleApi.create({
        date: key(selected),
        title: t,
        time: time ? time.format('HH:mm') : undefined,
        note: note.trim() || undefined,
        assigneeId: assignee || undefined,
      })
      message.success('已添加')
      setTitle('')
      setTime(null)
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

  // 日历格：桌面=事件小条（最多 2 条 + 计数），移动端=小圆点
  const cellRender = (current, info) => {
    if (info.type !== 'date') return info.originNode
    const list = byDate[key(current)]
    if (!list?.length) return null
    if (isMobile) {
      return (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 1 }}>
          {list.slice(0, 3).map((e) => (
            <span key={e.eventId} style={{ width: 5, height: 5, borderRadius: '50%', background: e.done ? '#d9d9d9' : TEAL, display: 'inline-block' }} />
          ))}
          {list.length > 3 && <span style={{ fontSize: 9, color: '#999', lineHeight: '5px' }}>+</span>}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.slice(0, 2).map((e) => (
          <div
            key={e.eventId}
            style={{
              fontSize: 11, lineHeight: '16px', padding: '0 6px', borderRadius: 4,
              background: e.done ? '#f5f5f5' : '#e6fffb', color: e.done ? '#bfbfbf' : TEAL_DARK,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: e.done ? 'line-through' : 'none',
            }}
          >
            {e.time ? `${e.time} ` : ''}{e.title}
          </div>
        ))}
        {list.length > 2 && <div style={{ fontSize: 11, color: '#999', paddingLeft: 6 }}>+{list.length - 2} 项</div>}
      </div>
    )
  }

  const selfId = user?.userId

  return (
    <>
      {/* 横幅：青色渐变，与百家说橙/新闻蓝区分 */}
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
            点一天，安排一件事；带负责人的事件当天早上 8 点自动提醒
            {todayList.length > 0 && <span style={{ marginLeft: 10, fontWeight: 700 }}>· 今天 {todayList.filter((e) => !e.done).length}/{todayList.length} 件待办</span>}
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? '10px 8px' : '14px 18px' } }}>
            {/* 自绘月份头：‹ 2026年7月 › + 回到今天 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 10px' }}>
              <Button size="small" type="text" icon={<LeftOutlined />} onClick={() => setSelected((s) => s.subtract(1, 'month'))} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>{selected.format('YYYY 年 M 月')}</span>
              <Button size="small" type="text" icon={<RightOutlined />} onClick={() => setSelected((s) => s.add(1, 'month'))} />
              <span style={{ flex: 1 }} />
              <Button size="small" onClick={() => setSelected(dayjs())} style={{ borderRadius: 8 }}>今天</Button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {dayEvents.map((e) => {
                  const assignedToMe = e.assigneeId === selfId && !e.mine
                  const canToggle = e.mine || e.assigneeId === selfId
                  return (
                    <div
                      key={e.eventId}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        borderRadius: 10, background: '#fff', border: '1px solid #f0f0f0',
                        borderLeft: `3px solid ${e.done ? '#d9d9d9' : assignedToMe ? '#fa8c16' : TEAL}`,
                        opacity: e.done ? 0.62 : 1, transition: 'opacity .15s',
                      }}
                    >
                      {canToggle && (
                        <span
                          onClick={() => toggleDone(e)}
                          title={e.done ? '取消完成' : '标记完成'}
                          style={{ cursor: 'pointer', fontSize: 18, color: e.done ? '#52c41a' : '#d9d9d9', marginTop: 1, flexShrink: 0 }}
                        >
                          {e.done ? <CheckCircleFilled /> : <CheckCircleOutlined />}
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {e.time && (
                            <span style={{ fontSize: 12, color: TEAL_DARK, background: '#e6fffb', borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>
                              <ClockCircleOutlined style={{ marginRight: 3 }} />{e.time}
                            </span>
                          )}
                          <span
                            style={{
                              fontWeight: 600, fontSize: 14, wordBreak: 'break-all',
                              textDecoration: e.done ? 'line-through' : 'none', color: e.done ? '#999' : '#262626',
                            }}
                          >
                            {e.title}
                          </span>
                        </div>
                        {e.note && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 3, whiteSpace: 'pre-wrap' }}>{e.note}</div>}
                        {(e.assigneeId || !e.mine) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                            {e.assigneeId && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 999, padding: '1px 8px 1px 2px' }}>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: TEAL_DARK, marginBottom: 8 }}>
                <PlusOutlined style={{ marginRight: 5 }} />给 {selected.format('M月D日')} 添加事件
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Input
                  placeholder="要做什么？"
                  maxLength={50}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPressEnter={addEvent}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <TimePicker
                    placeholder="时刻(可选)"
                    format="HH:mm"
                    minuteStep={5}
                    value={time}
                    onChange={setTime}
                    style={{ width: 130, flexShrink: 0 }}
                  />
                  <Select
                    allowClear
                    placeholder="负责人(可选)"
                    value={assignee}
                    onChange={setAssignee}
                    style={{ flex: 1, minWidth: 0 }}
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
                </div>
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
                负责人可选"我自己或关注我的人"；有负责人的事件当天早 8 点自动提醒对方
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  )
}
