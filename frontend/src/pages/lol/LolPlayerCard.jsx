import { useEffect, useMemo, useState } from 'react'
import { Drawer, Empty, Modal, Progress, Segmented, Space, Spin, Table, Tag, Tooltip } from 'antd'
import { POSITION_LABEL, queueName } from '../../api/lol'
import { lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import LolUserAvatar from './LolUserAvatar'
import LolMatchDetail from './LolMatchDetail'
import { k, mmss, num1, pct, rate, rateColor, tierColor, tierText } from './lolFormat'

/**
 * 一个人的资料卡：从榜单点昵称进来。
 *
 * ## 为什么值得单独有这一页
 *
 * 榜单回答「谁强」，资料卡回答「他是什么样的玩家」——玩什么英雄、打什么位置、
 * 和谁一起打、每一把打成什么样。这些在榜上摆不下（一行放不了十二个英雄），
 * 但恰恰是队友之间真正会聊的内容。
 *
 * ## 这里刻意不设最低场次门槛
 *
 * 榜单要门槛，是为了「别让 1 场 100% 胜率的人霸榜」。
 * 而资料卡是**主动点进来看某个人**的，他只打过两把也该如实显示——
 * 显示一个空页面反而像坏了。
 *
 * ## 小号可以勾选，默认只勾「最近在玩的那个」
 *
 * 有小号的人，「大号什么水平」和「所有号加起来」是两个不同的问题，都得答得出来。
 * 所以上面那排账号是可点的开关，**至少留一个**——一个都不选的话下面全空，
 * 那不是一种有意义的状态，而是一次误操作。
 *
 * 默认不是全选，而是**最近有对局的那一个**：全选会把半年前弃用的小号混进胜率里，
 * 而人们打开资料卡想看的是「他现在什么水平」。判据用最后一场对局的时间，
 * 不能用 `LAST_SYNC`——那是我们上次去问 Riot 的时刻，每个号每轮都在变。
 *
 * 从账号榜点进来时会带 `initialPuuid`，那就直接勾它——榜上那一行就是那个号的数据，
 * 点开却看到另一个号的统计，对不上。
 */
/**
 * 默认勾哪个号：**最后一场对局最近的那一个**。
 *
 * 放在组件外是因为它不碰任何组件状态；顺带也躲开了「在声明前引用」——
 * 原来它写在使用它的 effect 后面，运行时侥幸没事（effect 在函数体跑完之后才执行），
 * 但那是靠时序，不是靠结构。
 *
 * 都没打过（刚绑还没回填）时退回第一个：总得勾一个，
 * 一个不勾的话页面是空的，看着像坏了。
 */
const defaultPick = (list) => {
  const played = list.filter((a) => a.lastPlayed)
  if (!played.length) return list.length ? [list[0].puuid] : []
  const newest = played.reduce((best, a) =>
    (new Date(a.lastPlayed) > new Date(best.lastPlayed) ? a : best))
  return [newest.puuid]
}

export default function LolPlayerCard({ userId, initialPuuid, days, open, onClose }) {
  const isMobile = useIsMobile()
  const [data, setData] = useState(null)
  const [accounts, setAccounts] = useState([])     // 这个人所有的号（第一次拿到后固定）
  const [picked, setPicked] = useState([])         // 勾中的 PUUID
  const [tab, setTab] = useState('champions')
  // 点某个英雄 → 只看这个英雄的对局。放在这一层而不是 Body 里：
  // 切页签时它要留着（从英雄池点进来，落到战绩页仍然带着筛选）
  const [champ, setChamp] = useState(null)
  // 从战绩行点进单局详情。和战绩流里点卡片是同一个弹层
  const [openMatch, setOpenMatch] = useState(null)

  // 换人（或换号）时把勾选和页签都清掉，否则会带着上一次的选择去查新的
  useEffect(() => {
    setAccounts([])
    setPicked([])
    setTab('champions')
    setChamp(null)
  }, [userId, initialPuuid])

  const puuidsParam = useMemo(
    // 全选等同于不筛，传空串让后端走那条更简单的分支
    () => (picked.length && picked.length < accounts.length ? picked.join(',') : ''),
    [picked, accounts.length],
  )

  useEffect(() => {
    if (!open || !userId) return undefined
    let alive = true
    setData(null)
    lolApi.player(userId, days, puuidsParam)
      .then((d) => {
        if (!alive) return
        setData(d || false)
        // 账号列表只在第一次填：它不随勾选变化，重复设置会让勾选被自己重置掉
        if (d && d.accounts && accounts.length === 0) {
          setAccounts(d.accounts)
          // 从账号榜点进来时带着具体是哪个号——那一行就是那个号的数据，
          // 打开资料卡却默认显示另一个号会对不上。没带就退回「最近在玩的」
          const wanted = initialPuuid && d.accounts.some((a) => a.puuid === initialPuuid)
            ? [initialPuuid]
            : defaultPick(d.accounts)
          setPicked(wanted)
        }
      })
      .catch(() => alive && setData(false))
    return () => { alive = false }
  }, [open, userId, days, puuidsParam])   // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (puuid) => {
    setPicked((prev) => {
      if (prev.includes(puuid)) {
        // 至少留一个：全不选的话下面一片空白，那是误操作不是一种视图
        return prev.length === 1 ? prev : prev.filter((x) => x !== puuid)
      }
      return [...prev, puuid]
    })
  }

  const who = data && data.user
  const title = who ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LolUserAvatar name={who.nickname} src={who.avatar} size={26} />
      <span>{who.nickname}</span>
    </span>
  ) : '玩家资料'

  const body = (
    <>
      {/* 账号开关。只有一个号时也照常显示——那时它就是一枚说明「这是谁」的标签 */}
      {accounts.length > 0 && (
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          {accounts.map((a) => {
            const on = picked.includes(a.puuid)
            return (
              <Tag
                key={a.accountId}
                onClick={() => accounts.length > 1 && toggle(a.puuid)}
                style={{
                  padding: '3px 9px', margin: 0,
                  cursor: accounts.length > 1 ? 'pointer' : 'default',
                  borderColor: on ? '#fa541c' : undefined,
                  background: on ? '#fff2e8' : '#fafafa',
                  opacity: on ? 1 : 0.5,
                }}
              >
                <b>{a.gameName}</b>
                <span style={{ color: '#bbb' }}>#{a.tagLine}</span>
                {a.tier && (
                  <Tooltip title="当前段位，不是某一场时的段位">
                    <span style={{ color: tierColor(a.tier), fontWeight: 700, marginLeft: 6 }}>
                      {tierText(a.tier, a.rankDiv)}
                      {a.leaguePoint != null && ` ${a.leaguePoint}LP`}
                    </span>
                  </Tooltip>
                )}
              </Tag>
            )
          })}
          {accounts.length > 1 && (
            <span style={{ color: '#ccc', fontSize: 11 }}>
              默认只看最近在玩的号，点账号可切换 / 多选
            </span>
          )}
        </Space>
      )}

      {data === null
        ? <Spin style={{ display: 'block', margin: '60px auto' }} />
        : data === false
          ? <Empty description="拿不到这个人的数据" />
          : (
            <Body
              d={data}
              isMobile={isMobile}
              tab={tab}
              setTab={setTab}
              champ={champ}
              setChamp={setChamp}
              onOpenMatch={setOpenMatch}
            />
          )}
    </>
  )

  // 单局详情叠在资料卡之上。两层弹层看着重，但比「先关掉资料卡再开详情」好——
  // 后者关掉之后回不来，而看完一局往往还要接着看下一局
  const detail = (
    <LolMatchDetail matchId={openMatch} open={!!openMatch} onClose={() => setOpenMatch(null)} />
  )

  return isMobile ? (
    <>
      <Drawer placement="bottom" height="90%" open={open} onClose={onClose} title={title}
        styles={{ body: { padding: '10px 12px 16px' } }}>
        {body}
      </Drawer>
      {detail}
    </>
  ) : (
    <>
      <Modal open={open} onCancel={onClose} footer={null} title={title} width={860}>
        {body}
      </Modal>
      {detail}
    </>
  )
}

function Body({ d, isMobile, tab, setTab, champ, setChamp, onOpenMatch }) {
  const s = d.summary || {}
  const games = Number(s.games || 0)
  if (!games) {
    return <Empty description="这段时间没有对局" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  const wins = Number(s.wins || 0)

  return (
    <>
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

      {/* 英雄筛选只作用在战绩上，所以计数也要跟着变，否则页签上的数字和表里的行数对不上 */}
      {(() => {
        const all = d.matches || []
        const shown = champ ? all.filter((m) => m.championName === champ) : all
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'champions', label: `英雄池 (${(d.champions || []).length})` },
                  { value: 'matches', label: `战绩 (${shown.length})` },
                ]}
              />
              {champ && (
                <Tag
                  closable
                  onClose={() => setChamp(null)}
                  color="orange"
                  style={{ margin: 0 }}
                >
                  只看 {champ}
                </Tag>
              )}
            </div>

            {tab === 'champions'
              ? (
                <ChampionTable
                  rows={d.champions || []}
                  active={champ}
                  // 点英雄 = 只看这个英雄的对局，并直接跳到战绩页——
                  // 留在英雄池上的话，点了之后画面毫无变化，会以为没生效
                  onPick={(name) => { setChamp(name === champ ? null : name); setTab('matches') }}
                />
              )
              : <MatchTable rows={shown} onOpen={onOpenMatch} />}
          </>
        )
      })()}

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

function ChampionTable({ rows, active, onPick }) {
  return (
    <Table
      className="stat-compact"
      size="small"
      rowKey="championName"
      pagination={false}
      scroll={{ x: 'max-content' }}
      dataSource={rows}
      style={{ marginBottom: 14 }}
      onRow={(r) => ({ onClick: () => onPick(r.championName), style: { cursor: 'pointer' } })}
      rowClassName={(r) => (r.championName === active ? 'lol-mine' : '')}
      columns={[
        { title: '英雄', dataIndex: 'championName', width: 108,
          render: (v) => (
            <span style={{ fontWeight: 600, color: v === active ? '#fa541c' : undefined }}>
              {v}
            </span>
          ) },
        { title: '场次', dataIndex: 'games', width: 58, align: 'right' },
        {
          title: '胜率',
          key: 'rate',
          width: 132,
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
        { title: 'KDA', dataIndex: 'avgKda', width: 62, align: 'right', render: (v) => num1(v) },
        { title: '伤害占比', dataIndex: 'avgDmgShare', width: 78, align: 'right', render: (v) => rate(v) },
      ]}
    />
  )
}

/**
 * 这个人自己的每一把。和战绩流不同：那里以对局为单位，这里以他为单位。
 *
 * 行可点，打开的是**同一个**单局详情弹层——从哪里点进去看到的应该是同一样东西。
 */
function MatchTable({ rows, onOpen }) {
  return (
    <Table
      className="stat-compact"
      size="small"
      rowKey="matchId"
      pagination={false}
      scroll={{ x: 'max-content', y: 360 }}
      dataSource={rows}
      style={{ marginBottom: 14 }}
      onRow={(r) => ({ onClick: () => onOpen(r.matchId), style: { cursor: 'pointer' } })}
      locale={{ emptyText: '这个筛选下没有对局' }}
      columns={[
        {
          title: '结果',
          key: 'win',
          width: 58,
          render: (_, r) => (
            r.earlySurr === '1'
              ? <span style={{ color: '#999' }}>重开</span>
              : <span style={{ color: r.win === '1' ? '#52c41a' : '#ff7875', fontWeight: 700 }}>
                {r.win === '1' ? '胜' : '负'}
              </span>
          ),
        },
        {
          title: '时间',
          key: 'when',
          width: 92,
          render: (_, r) => {
            const t = new Date(r.gameStart)
            return (
              <span style={{ color: '#999', fontSize: 12 }}>
                {t.getMonth() + 1}/{t.getDate()} {String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}
              </span>
            )
          },
        },
        { title: '队列', dataIndex: 'queueId', width: 88, render: (v) => <span style={{ fontSize: 12 }}>{queueName(v)}</span> },
        {
          title: '英雄',
          key: 'champ',
          width: 104,
          render: (_, r) => (
            <span>
              <span style={{ fontWeight: 600 }}>{r.championName}</span>
              {r.teamPosition && (
                <span style={{ color: '#bbb', fontSize: 11, marginLeft: 4 }}>
                  {POSITION_LABEL[r.teamPosition] || r.teamPosition}
                </span>
              )}
            </span>
          ),
        },
        {
          title: 'KDA',
          key: 'kda',
          width: 96,
          align: 'right',
          render: (_, r) => (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {r.kills}/{r.deaths}/{r.assists}
              <span style={{ color: '#bbb', fontSize: 11, marginLeft: 5 }}>{num1(r.kda)}</span>
            </span>
          ),
        },
        { title: '参团', dataIndex: 'killPart', width: 58, align: 'right', render: (v) => rate(v) },
        { title: '输出占比', dataIndex: 'dmgShare', width: 74, align: 'right', render: (v) => rate(v) },
        { title: '补刀', dataIndex: 'cs', width: 54, align: 'right' },
        { title: '输出', dataIndex: 'dmgChamp', width: 62, align: 'right', render: (v) => k(v) },
        { title: '视野', dataIndex: 'vision', width: 54, align: 'right' },
        { title: '时长', dataIndex: 'gameDuration', width: 62, align: 'right', render: (v) => mmss(v) },
      ]}
    />
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
