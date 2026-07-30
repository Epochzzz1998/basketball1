import { useEffect, useState } from 'react'
import { Drawer, Empty, Modal, Spin, Table, Tag } from 'antd'
import { lolApi, POSITION_LABEL, mmss, queueName } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 单局详情：这一场**十个人**的数据，不只是自己人。
 *
 * ## 数据从哪来
 *
 * 从库里那份原始 JSON 解出来的，**一次 Riot 请求都不花**。
 * `lol_match_player` 按设计只存自己人，所以详情要的另外五个路人只能来自原文——
 * 这是当初坚持存 `RAW_GZ` 的第三个回报。真去 Riot 补的话，
 * 每点开一次详情就是一次 API 调用，几个人随手点几下就把配额吃光了。
 *
 * ## 为什么是弹层不是新页面
 *
 * 跟站里已有的做法一致（日程的当天详情就是这样：桌面 Modal、手机底部抽屉）。
 * 换成新路由的话，从详情返回会退出整个分区，还要再点一次才回到战绩流。
 */
export default function LolMatchDetail({ matchId, open, onClose }) {
  const isMobile = useIsMobile()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!open || !matchId) return undefined
    let alive = true
    setData(null)
    lolApi.matchDetail(matchId)
      .then((d) => alive && setData(d || false))
      .catch(() => alive && setData(false))
    return () => { alive = false }
  }, [open, matchId])

  const title = data
    ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>对局详情</span>
        <Tag>{queueName(data.queueId)}</Tag>
        <span style={{ color: '#999', fontSize: 12, fontWeight: 400 }}>{mmss(data.gameDuration)}</span>
      </span>
    )
    : '对局详情'

  const body = data === null
    ? <Spin style={{ display: 'block', margin: '60px auto' }} />
    : data === false
      ? <Empty description="这场对局的详细数据没有存下来" />
      : (data.teams || []).map((t) => <TeamBlock key={t.teamId} team={t} isMobile={isMobile} />)

  return isMobile ? (
    <Drawer
      placement="bottom"
      height="86%"
      open={open}
      onClose={onClose}
      title={title}
      styles={{ body: { padding: '10px 12px' } }}
    >
      {body}
    </Drawer>
  ) : (
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={820}>
      {body}
    </Modal>
  )
}

/** 一支队伍：胜负条 + 五个人 */
function TeamBlock({ team, isMobile }) {
  const won = team.win === '1'
  const o = team.objectives || {}
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '6px 10px', marginBottom: 6, borderRadius: 8,
          background: won ? 'rgba(82,196,26,.10)' : 'rgba(255,120,117,.10)',
        }}
      >
        <span style={{ fontWeight: 700, color: won ? '#52c41a' : '#ff7875' }}>
          {won ? '胜方' : '败方'}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {team.kills}/{team.deaths}/{team.assists}
        </span>
        <span style={{ color: '#999', fontSize: 12 }}>{(team.gold / 1000).toFixed(1)}k 经济</span>
        {/* 只列拿到过的目标：全列出来的话一排零看着像坏了 */}
        {o.tower > 0 && <span style={{ color: '#999', fontSize: 12 }}>塔 {o.tower}</span>}
        {o.dragon > 0 && <span style={{ color: '#999', fontSize: 12 }}>龙 {o.dragon}</span>}
        {o.baron > 0 && <span style={{ color: '#999', fontSize: 12 }}>大龙 {o.baron}</span>}
        {o.inhibitor > 0 && <span style={{ color: '#999', fontSize: 12 }}>水晶 {o.inhibitor}</span>}
      </div>
      <Table
        className="stat-compact"
        size="small"
        rowKey="puuid"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={team.players || []}
        columns={columns(isMobile)}
        // 站内成员那几行加个底色：一场里自己人和路人混在一起，
        // 光看名字认不出来——游戏 ID 和站内昵称常常对不上
        rowClassName={(r) => (r.nickname ? 'lol-mine' : '')}
      />
    </div>
  )
}

function columns(isMobile) {
  const base = [
    {
      title: '英雄',
      key: 'champ',
      render: (_, r) => (
        <span>
          <span style={{ fontWeight: 600 }}>{r.championName}</span>
          <span style={{ color: '#bbb', fontSize: 12, marginLeft: 4 }}>Lv{r.champLevel}</span>
        </span>
      ),
    },
    {
      title: '玩家',
      key: 'who',
      render: (_, r) => (
        <span>
          {/* 站内成员显示昵称（并标出来），路人显示游戏 ID */}
          {r.nickname
            ? <><span style={{ fontWeight: 700, color: '#fa541c' }}>{r.nickname}</span>
              <span style={{ color: '#ccc', fontSize: 11, marginLeft: 4 }}>{r.riotId}</span></>
            : <span style={{ color: '#666' }}>{r.riotId}</span>}
          {r.teamPosition && (
            <span style={{ color: '#bbb', fontSize: 11, marginLeft: 6 }}>
              {POSITION_LABEL[r.teamPosition] || r.teamPosition}
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'KDA',
      key: 'kda',
      width: 84,
      align: 'right',
      render: (_, r) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.kills}/{r.deaths}/{r.assists}</span>
      ),
    },
    { title: '补刀', dataIndex: 'cs', width: 60, align: 'right' },
  ]
  if (isMobile) return base
  return [
    ...base,
    { title: '经济', key: 'gold', width: 76, align: 'right', render: (_, r) => `${(r.gold / 1000).toFixed(1)}k` },
    { title: '输出', key: 'dmg', width: 76, align: 'right', render: (_, r) => `${(r.dmgChamp / 1000).toFixed(1)}k` },
    { title: '承伤', key: 'taken', width: 76, align: 'right', render: (_, r) => `${(r.dmgTaken / 1000).toFixed(1)}k` },
    { title: '视野', dataIndex: 'vision', width: 62, align: 'right' },
    { title: '阵亡', key: 'dead', width: 68, align: 'right', render: (_, r) => mmss(r.deadTime) },
  ]
}
