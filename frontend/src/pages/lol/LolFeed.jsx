import { useEffect, useState } from 'react'
import { Card, Empty, Segmented, Space, Spin, Tag } from 'antd'
import { DAYS_OPTIONS, POSITION_LABEL, mmss, queueName } from '../../api/lol'
import { lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import { UserAvatar, kdaText } from './lolCommon'

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
 */
export default function LolFeed() {
  const isMobile = useIsMobile()
  const [days, setDays] = useUrlState('days', 30, true)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    lolApi.feed(days)
      .then((d) => alive && setRows(Array.isArray(d) ? d : []))
      .catch(() => alive && setRows([]))
    return () => { alive = false }
  }, [days])

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Segmented
          value={days}
          onChange={setDays}
          options={DAYS_OPTIONS}
        />
      </div>

      {rows === null ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : rows.length === 0 ? (
        <Empty description="这段时间没有对局。先去「绑定账号」把 Riot ID 填上" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {rows.map((m) => <MatchCard key={m.matchId} m={m} isMobile={isMobile} />)}
        </Space>
      )}
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
function MatchCard({ m, isMobile }) {
  const players = m.players || []
  const remake = players.some((p) => p.earlySurr === '1')
  const won = players[0]?.win === '1'
  const when = new Date(m.gameStart)
  const stamp = `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`

  return (
    <Card
      size="small"
      style={{
        borderRadius: 14,
        // 左边一条色带就够表达胜负了，整张卡染色在深浅屏下都难看
        borderLeft: `4px solid ${remake ? '#d9d9d9' : won ? '#52c41a' : '#ff7875'}`,
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
      </div>

      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {players.map((p) => (
          <div key={p.puuid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserAvatar name={p.nickname} src={p.avatar} size={26} />
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
