import { useEffect, useState } from 'react'
import { Drawer, Empty, Modal, Progress, Space, Spin, Table, Tag, Tooltip } from 'antd'
import { POSITION_LABEL, lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import LolUserAvatar from './LolUserAvatar'
import { k, num1, pct, rate, rateColor, tierText } from './lolFormat'

/**
 * 一个人的资料卡：从榜单点昵称进来。
 *
 * ## 为什么值得单独有这一页
 *
 * 榜单回答「谁强」，资料卡回答「他是什么样的玩家」——玩什么英雄、打什么位置、
 * 和谁一起打。后面这些在榜上摆不下（一行放不了十二个英雄），
 * 但恰恰是队友之间真正会聊的内容。
 *
 * ## 这里刻意不设最低场次门槛
 *
 * 榜单要门槛，是为了「别让 1 场 100% 胜率的人霸榜」。
 * 而资料卡是**主动点进来看某个人**的，他只打过两把也该如实显示——
 * 显示一个空页面反而像坏了。
 */
export default function LolPlayerCard({ userId, days, open, onClose }) {
  const isMobile = useIsMobile()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!open || !userId) return undefined
    let alive = true
    setData(null)
    lolApi.player(userId, days)
      .then((d) => alive && setData(d || false))
      .catch(() => alive && setData(false))
    return () => { alive = false }
  }, [open, userId, days])

  const who = data && data.user
  const title = who ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LolUserAvatar name={who.nickname} src={who.avatar} size={26} />
      <span>{who.nickname}</span>
    </span>
  ) : '玩家资料'

  const body = data === null
    ? <Spin style={{ display: 'block', margin: '60px auto' }} />
    : data === false
      ? <Empty description="拿不到这个人的数据" />
      : <Body d={data} isMobile={isMobile} />

  return isMobile ? (
    <Drawer placement="bottom" height="88%" open={open} onClose={onClose} title={title}
      styles={{ body: { padding: '10px 12px 16px' } }}>
      {body}
    </Drawer>
  ) : (
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={760}>
      {body}
    </Modal>
  )
}

function Body({ d, isMobile }) {
  const s = d.summary || {}
  const games = Number(s.games || 0)
  if (!games) {
    return <Empty description="这段时间没有对局" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  const wins = Number(s.wins || 0)

  return (
    <>
      {/* 绑定的号 + 段位。一个人可能有小号，段位按号分别显示——合并没有意义 */}
      <Space size={8} wrap style={{ marginBottom: 12 }}>
        {(d.accounts || []).map((a) => (
          <Tag key={a.accountId} style={{ padding: '3px 8px' }}>
            <b>{a.gameName}</b>
            <span style={{ color: '#bbb' }}>#{a.tagLine}</span>
            {a.tier && (
              <Tooltip title="当前段位，不是某一场时的段位">
                <span style={{ color: '#fa541c', marginLeft: 6 }}>
                  {tierText(a.tier, a.rankDiv)}
                  {a.leaguePoint != null && ` ${a.leaguePoint}LP`}
                </span>
              </Tooltip>
            )}
          </Tag>
        ))}
      </Space>

      <div style={{
        display: 'grid', gap: 8, marginBottom: 14,
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
      }}>
        <Stat label="场次" value={games} />
        <Stat label="胜率" value={pct(wins, games)} color={rateColor(wins / games)} />
        <Stat label="KDA" value={num1(s.avgKda)} />
        <Stat label="参团率" value={rate(s.avgKillPart)} />
        <Stat label="伤害占比" value={rate(s.avgDmgShare)} />
        <Stat label="场均伤害" value={k(s.avgDmg)} />
        <Stat label="每分补刀" value={num1(s.csPerMin)} />
        <Stat label="场均视野" value={num1(s.avgVision)} />
        <Stat label="单场最高击杀" value={s.maxKills ?? '—'} />
        <Stat label="总击杀" value={s.kills ?? 0} />
        <Stat label="总死亡" value={s.deaths ?? 0} />
        <Stat label="总助攻" value={s.assists ?? 0} />
      </div>

      <Section title="位置分布">
        <Space size={10} wrap>
          {(d.positions || []).map((p) => (
            <span key={p.pos} style={{ fontSize: 13 }}>
              <span style={{ color: '#666' }}>{POSITION_LABEL[p.pos] || '其它'}</span>
              <span style={{ fontWeight: 700, marginLeft: 5 }}>{p.games}</span>
              <span style={{ color: '#bbb', marginLeft: 4 }}>{pct(p.wins, p.games)}</span>
            </span>
          ))}
        </Space>
      </Section>

      <Section title="英雄池">
        <Table
          className="stat-compact"
          size="small"
          rowKey="championName"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={d.champions || []}
          columns={[
            { title: '英雄', dataIndex: 'championName', width: 108,
              render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
            { title: '场次', dataIndex: 'games', width: 58, align: 'right' },
            {
              title: '胜率',
              key: 'rate',
              width: 128,
              render: (_, r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Progress
                    percent={Math.round((r.wins / r.games) * 100)}
                    size="small"
                    showInfo={false}
                    strokeColor={rateColor(r.wins / r.games)}
                    style={{ width: 56, margin: 0 }}
                  />
                  <span style={{ color: rateColor(r.wins / r.games), fontWeight: 700 }}>
                    {pct(r.wins, r.games)}
                  </span>
                </span>
              ),
            },
            { title: 'KDA', dataIndex: 'avgKda', width: 62, align: 'right',
              render: (v) => num1(v) },
            { title: '伤害占比', dataIndex: 'avgDmgShare', width: 78, align: 'right',
              render: (v) => rate(v) },
          ]}
        />
      </Section>

      <Section title="常一起打的人">
        {(d.mates || []).length === 0
          ? <span style={{ color: '#bbb', fontSize: 13 }}>这段时间没有和别的成员同场</span>
          : (
            <Space size={10} wrap>
              {d.mates.map((m) => (
                <span key={m.userId} style={{ fontSize: 13 }}>
                  <span style={{ color: '#666' }}>{m.nickname || '（未知）'}</span>
                  <span style={{ fontWeight: 700, marginLeft: 5 }}>{m.games}</span>
                  <span style={{ color: rateColor(m.games ? m.wins / m.games : 0), marginLeft: 4 }}>
                    {pct(m.wins, m.games)}
                  </span>
                </span>
              ))}
            </Space>
          )}
      </Section>
    </>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#fafafa', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ color: '#999', fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: color || undefined }}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: '#666', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}
