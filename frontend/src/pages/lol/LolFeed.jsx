import { useCallback, useEffect, useState } from 'react'
import { AutoComplete, Button, Card, Empty, Input, Segmented, Space, Spin, Tag } from 'antd'
import { CalendarOutlined, CloseCircleFilled, SearchOutlined } from '@ant-design/icons'
import { DAYS_OPTIONS, POSITION_LABEL, queueName } from '../../api/lol'
import { lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import DateMarkPicker from '../../components/DateMarkPicker'
import LolUserAvatar from './LolUserAvatar'
import { kdaText, mmss } from './lolFormat'
import LolMatchDetail from './LolMatchDetail'

/**
 * 战绩流：最近的对局，每场列出这一场里的自己人。
 *
 * ## 和 OP.GG 那类工具的区别
 *
 * 那些站是**一个人一条时间线**，它们不知道你们几个是不是同一局。
 * 这里反过来：以**对局**为单位，一眼看出「这一把我们上了几个、谁打什么、赢没赢」。
 * 这正是公共平台给不了的东西，也是整个模块存在的理由。
 *
 * ## 重开局照显
 *
 * 榜单会把重开局排除（三分钟的局算进胜率会把数字打歪），但**战绩流不过滤**——
 * 「昨晚有两把重开」本身就是想知道的事，藏起来只会让人觉得少了几局。
 *
 * ## 两种时间筛选是互斥的
 *
 * 「看某一天」和「看最近 N 天」同时生效只会互相削，所以选了日期就把时间窗收起来。
 * 玩家搜索是叠加的——它筛的是「哪些场次」，和时间范围不冲突。
 */
export default function LolFeed() {
  const isMobile = useIsMobile()
  const [days, setDays] = useUrlState('days', 30, true)
  const [date, setDate] = useUrlState('date', '')
  const [player, setPlayer] = useUrlState('player', '')
  const [rows, setRows] = useState(null)
  // 点开的那一场。用局部 state 而不是 URL：和站里其它弹层一致
  // （日程的当天详情也是这样），换成路由的话从详情返回会退出整个分区
  const [openId, setOpenId] = useState(null)
  const [calOpen, setCalOpen] = useState(false)
  const [options, setOptions] = useState([])
  // 输入框跟着 URL 走，但打字过程中不能每敲一个字就查一次
  const [draft, setDraft] = useState(player)

  useEffect(() => { setDraft(player) }, [player])

  useEffect(() => {
    lolApi.searchOptions()
      .then((d) => {
        // 昵称和游戏 ID 都能搜，所以两样都放进候选
        const opts = []
        for (const o of d || []) {
          if (o.nickname) opts.push({ value: o.nickname })
          if (o.gameName) opts.push({ value: o.gameName })
        }
        setOptions(opts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setRows(null)
    // date 非空时后端会忽略 days，这里不必再判一次
    lolApi.feed({ days, date: date || undefined, player: player || undefined })
      .then((d) => alive && setRows(Array.isArray(d) ? d : []))
      .catch(() => alive && setRows([]))
    return () => { alive = false }
  }, [days, date, player])

  const loadMonth = useCallback((month) => lolApi.dates(month), [])

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 选了具体日期就把时间窗收起来——两个同时摆着会让人以为它们能叠加 */}
        {!date && <Segmented value={days} onChange={setDays} options={DAYS_OPTIONS} />}

        <Button
          icon={<CalendarOutlined />}
          onClick={() => setCalOpen(true)}
          type={date ? 'primary' : 'default'}
          style={{ position: 'relative' }}
        >
          {date || '按日期'}
          {/* 日历藏在按钮底下：DatePicker 换不掉自己的输入框，缩成零尺寸只当弹层锚点。
              有对局的日子会被标出来，标注按**面板显示中的月份**取（见 DateMarkPicker） */}
          <DateMarkPicker
            open={calOpen}
            onOpenChange={setCalOpen}
            value={date || null}
            onChange={(v) => { setCalOpen(false); setDate(v) }}
            loadMonth={loadMonth}
            style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, padding: 0, border: 'none', visibility: 'hidden' }}
          />
        </Button>
        {date && <Button type="text" onClick={() => setDate('')}>清除日期</Button>}

        <AutoComplete
          value={draft}
          options={options}
          onChange={setDraft}
          onSelect={(v) => setPlayer(v)}
          filterOption={(input, opt) => String(opt?.value || '').toLowerCase().includes(input.toLowerCase())}
          style={{ width: isMobile ? '100%' : 220 }}
        >
          <Input
            placeholder="搜昵称或游戏 ID"
            prefix={<SearchOutlined style={{ color: '#aaa' }} />}
            allowClear={{ clearIcon: <CloseCircleFilled style={{ color: '#ccc' }} /> }}
            // 回车或失焦才真的去查：边打边查会为每个字母打一次请求，
            // 而这条搜索是几百场对局上的联表 exists 查询
            onPressEnter={() => setPlayer(draft.trim())}
            onBlur={() => setPlayer(draft.trim())}
            onChange={(e) => { if (!e.target.value) setPlayer('') }}
            style={{ height: 32, borderRadius: 16, background: '#f5f5f5' }}
          />
        </AutoComplete>
      </div>

      {rows === null ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : rows.length === 0 ? (
        <Empty description={date || player ? '这个条件下没有对局' : '这段时间没有对局。先去「绑定账号」把 Riot ID 填上'} />
      ) : (
        <>
          <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
            {rows.length} 场
            {date && ` · ${date}`}
            {player && ` · 含「${player}」`}
          </div>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {rows.map((m) => (
              <MatchCard key={m.matchId} m={m} isMobile={isMobile} onOpen={() => setOpenId(m.matchId)} />
            ))}
          </Space>
        </>
      )}

      <LolMatchDetail matchId={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </>
  )
}

/**
 * 一场对局。
 *
 * 胜负按**自己人这一队**算：一场里我们的人必定同队或分属两队，
 * 后者在自定义局里才可能出现，所以直接取第一个人的结果作为这张卡的基调，
 * 真出现分属两队的情况，每个人自己那一行仍然是对的。
 */
function MatchCard({ m, isMobile, onOpen }) {
  const players = m.players || []
  const remake = players.some((p) => p.earlySurr === '1')
  const won = players[0]?.win === '1'
  const when = new Date(m.gameStart)
  const stamp = `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`

  return (
    <Card
      size="small"
      hoverable
      onClick={onOpen}
      style={{
        borderRadius: 14,
        // 左边一条色带就够表达胜负了，整张卡染色在深浅屏下都难看
        borderLeft: `4px solid ${remake ? '#d9d9d9' : won ? '#52c41a' : '#ff7875'}`,
        cursor: 'pointer',
      }}
      styles={{ body: { padding: isMobile ? '10px 12px' : '12px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: remake ? '#999' : won ? '#52c41a' : '#ff7875' }}>
          {remake ? '重开' : won ? '胜' : '负'}
        </span>
        <Tag>{queueName(m.queueId)}</Tag>
        <span style={{ color: '#999', fontSize: 12 }}>{stamp}</span>
        <span style={{ color: '#999', fontSize: 12 }}>{mmss(m.gameDuration)}</span>
        {players.length >= 2 && <Tag color="purple">{players.length} 人开黑</Tag>}
        <span style={{ marginLeft: 'auto', color: '#ccc', fontSize: 12 }}>点开看十人详情 ›</span>
      </div>

      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {players.map((p) => (
          <div key={p.puuid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LolUserAvatar name={p.nickname} src={p.avatar} size={26} />
            <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.nickname || '（未知）'}
            </span>
            <span style={{ color: '#666', fontSize: 13 }}>{p.championName}</span>
            {p.teamPosition && (
              <span style={{ color: '#bbb', fontSize: 12 }}>{POSITION_LABEL[p.teamPosition] || p.teamPosition}</span>
            )}
            <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
              {kdaText(p)}
              <span style={{ color: '#aaa', marginLeft: 6 }}>{p.cs} 补</span>
            </span>
          </div>
        ))}
      </Space>
    </Card>
  )
}
