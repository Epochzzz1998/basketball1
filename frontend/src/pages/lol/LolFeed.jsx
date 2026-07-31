import { useCallback, useEffect, useState } from 'react'
import { AutoComplete, Button, Card, Empty, Input, Segmented, Select, Space, Spin, Tag } from 'antd'
import { CalendarOutlined, CloseCircleFilled, SearchOutlined } from '@ant-design/icons'
import { DAYS_OPTIONS, POSITION_LABEL, QUEUE_OPTIONS, queueName } from '../../api/lol'
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
 * 玩家搜索和队列筛选都是叠加的——它们筛的是「哪些场次」，和时间范围不冲突。
 *
 * ## 队列筛选和榜单共用同一组选项
 *
 * 后端 `feed` 一直支持 `queueId`，只是这里从没传过。共用 `QUEUE_OPTIONS` 是为了
 * 让「战绩流里的大乱斗」和「榜单里的大乱斗」永远是同一个东西——各写一份的话，
 * 哪天加了新模式只改一处，两边就会对不上。
 */
export default function LolFeed() {
  const isMobile = useIsMobile()
  const [days, setDays] = useUrlState('days', 30, true)
  const [date, setDate] = useUrlState('date', '')
  const [player, setPlayer] = useUrlState('player', '')
  const [queue, setQueue] = useUrlState('queue', 0, true)
  const [rows, setRows] = useState(null)
  // 点开的那一场。**写进 URL**（?match=）而不是纯局部 state：
  // 「@ 了你」的通知点进来要能直接展开那一局，而对局详情是个浮层、没有自己的路由，
  // 只能靠这个参数告诉战绩流开哪一场。顺带也就能把某一局的链接发给别人了。
  const [openId, setOpenId] = useUrlState('match', '')
  const [calOpen, setCalOpen] = useState(false)
  const [options, setOptions] = useState([])
  // 输入框跟着 URL 走，但打字过程中不能每敲一个字就查一次
  const [draft, setDraft] = useState(player)

  useEffect(() => { setDraft(player) }, [player])

  useEffect(() => {
    lolApi.searchOptions()
      .then((d) => {
        // 昵称和游戏 ID 都能搜，所以两样都放进候选。
        //
        // **必须去重**：接口返回的是「每个绑定账号一行」，一个人绑了四个号
        // 他的昵称就出现四次。而且昵称和游戏 ID 偶尔会撞名，也要合并掉。
        //
        // 顺带标出这一条是昵称还是游戏 ID——两种都在同一个下拉里，
        // 不标的话看到一串名字根本分不出搜的是谁
        const seen = new Map()
        for (const o of d || []) {
          if (o.nickname && !seen.has(o.nickname)) seen.set(o.nickname, '站内昵称')
          if (o.gameName && !seen.has(o.gameName)) seen.set(o.gameName, '游戏 ID')
        }
        setOptions([...seen].map(([value, kind]) => ({
          value,
          label: (
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{value}</span>
              <span style={{ color: '#bbb', fontSize: 11 }}>{kind}</span>
            </span>
          ),
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setRows(null)
    // date 非空时后端会忽略 days，这里不必再判一次。queueId 用 0 表示「全部」
    lolApi.feed({ days, date: date || undefined, player: player || undefined, queueId: queue || undefined })
      .then((d) => alive && setRows(Array.isArray(d) ? d : []))
      .catch(() => alive && setRows([]))
    return () => { alive = false }
  }, [days, date, player, queue])

  const loadMonth = useCallback((month) => lolApi.dates(month), [])

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 选了具体日期就把时间窗收起来——两个同时摆着会让人以为它们能叠加 */}
        {!date && <Segmented value={days} onChange={setDays} options={DAYS_OPTIONS} />}

        {/* 队列用下拉而不是像时间窗那样铺成一排：选项有五个，铺开在手机上要占掉一整行 */}
        <Select
          value={queue}
          onChange={setQueue}
          options={QUEUE_OPTIONS}
          style={{ width: 120 }}
        />

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
          // label 现在是 JSX，只能按 value 过滤
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
        <Empty description={
          // 筛了队列却空，最常见的原因是时间窗太窄而不是「没这种局」——
          // 大乱斗就是这样：库里有 72 场，但都是去年七八月的，默认的 30 天根本够不着。
          // 只说「没有对局」会让人以为这类数据压根没抓
          queue && !date
            ? `最近 ${days} 天没有${queueName(queue)}。这类局可能更早，把时间窗放大到近一年试试`
            : date || player || queue
              ? '这个条件下没有对局'
              : '这段时间没有对局。先去「绑定账号」把 Riot ID 填上'}
        />
      ) : (
        <>
          <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
            {rows.length} 场
            {date && ` · ${date}`}
            {queue ? ` · ${queueName(queue)}` : ''}
            {player && ` · 含「${player}」`}
          </div>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {rows.map((m) => (
              <MatchCard key={m.matchId} m={m} isMobile={isMobile} onOpen={() => setOpenId(m.matchId)} />
            ))}
          </Space>
        </>
      )}

      <LolMatchDetail matchId={openId} open={!!openId} onClose={() => setOpenId('')} />
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
