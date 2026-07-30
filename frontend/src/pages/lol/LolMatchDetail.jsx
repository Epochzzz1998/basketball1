import { useEffect, useState } from 'react'
import { Drawer, Empty, Modal, Spin, Table, Tag, Tooltip } from 'antd'
import { POSITION_LABEL, queueName, lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import { k, mmss, num1, rate, spellName, tierColor, tierText } from './lolFormat'

/**
 * 单局详情：这一场**十个人**的完整数据。
 *
 * ## 数据从哪来
 *
 * 从库里那份原始 JSON 解出来的，**一次 Riot 请求都不花**。
 * `lol_match_player` 按设计只存自己人，所以另外五个路人只能来自原文——
 * 这是当初坚持存 `RAW_GZ` 的第三个回报。真去 Riot 补的话，
 * 每点开一次详情就是一次 API 调用，几个人随手点几下就把配额吃光了。
 *
 * ## 为什么手机也用同一套列
 *
 * 早先手机只留四列，理由是「屏幕放不下」。但表格本来就能横向滚，
 * 而少给的那几列（伤害占比、承伤、视野）恰恰是判断一局打得怎么样最要紧的东西——
 * 为了省下横滑的动作，把信息砍掉一半，这个交换不划算。
 *
 * ## 主表 + 展开
 *
 * 一行摊平所有指标会有三十多列，那不叫详细叫看不清。
 * 主表放能横向对比的（各种率、经济、输出），展开行放属于个人的细节
 * （伤害构成、对线期、视野细分、多杀、目标参与）。
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
        {data.gameVersion && (
          <span style={{ color: '#ccc', fontSize: 11, fontWeight: 400 }}>
            v{String(data.gameVersion).split('.').slice(0, 2).join('.')}
          </span>
        )}
      </span>
    )
    : '对局详情'

  const body = data === null
    ? <Spin style={{ display: 'block', margin: '60px auto' }} />
    : data === false
      ? <Empty description="这场对局的详细数据没有存下来" />
      : (
        <>
          {(data.teams || []).map((t) => <TeamBlock key={t.teamId} team={t} />)}
          <div style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>
            段位是**当前**段位，不是打这一场时的——对局数据里没有段位字段
          </div>
        </>
      )

  return isMobile ? (
    <Drawer
      placement="bottom"
      height="90%"
      open={open}
      onClose={onClose}
      title={title}
      styles={{ body: { padding: '10px 10px 16px' } }}
    >
      {body}
    </Drawer>
  ) : (
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={1080}>
      {body}
    </Modal>
  )
}

/** 一支队伍：胜负条 + 五个人 */
function TeamBlock({ team }) {
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
        <span style={{ color: '#999', fontSize: 12 }}>{k(team.gold)} 经济</span>
        <span style={{ color: '#999', fontSize: 12 }}>{k(team.dmgChamp)} 输出</span>
        {/* 只列拿到过的目标：全列出来的话一排零看着像坏了 */}
        {o.tower > 0 && <span style={{ color: '#999', fontSize: 12 }}>塔 {o.tower}</span>}
        {o.dragon > 0 && <span style={{ color: '#999', fontSize: 12 }}>龙 {o.dragon}</span>}
        {o.baron > 0 && <span style={{ color: '#999', fontSize: 12 }}>大龙 {o.baron}</span>}
        {o.riftHerald > 0 && <span style={{ color: '#999', fontSize: 12 }}>先锋 {o.riftHerald}</span>}
        {o.inhibitor > 0 && <span style={{ color: '#999', fontSize: 12 }}>水晶 {o.inhibitor}</span>}
      </div>
      <Table
        className="stat-compact"
        size="small"
        rowKey="puuid"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={team.players || []}
        columns={COLUMNS}
        expandable={{ expandedRowRender: (r) => <PlayerExtra p={r} />, expandRowByClick: true }}
        // 站内成员那几行加个底色：一场里自己人和路人混在一起，
        // 而游戏 ID 和站内昵称常常对不上，光读名字认不出来
        rowClassName={(r) => (r.nickname ? 'lol-mine' : '')}
      />
    </div>
  )
}

/** 主表的列。手机和桌面**同一套**，窄屏靠横向滚动 */
const COLUMNS = [
  {
    title: '英雄',
    key: 'champ',
    fixed: 'left',
    width: 96,
    render: (_, r) => (
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontWeight: 600 }}>{r.championName}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>
          Lv{r.champLevel}
          {(r.spell1 || r.spell2) && (
            <span style={{ marginLeft: 4 }}>{spellName(r.spell1)}·{spellName(r.spell2)}</span>
          )}
        </div>
      </div>
    ),
  },
  {
    title: '玩家',
    key: 'who',
    width: 168,
    render: (_, r) => (
      <div style={{ lineHeight: 1.3 }}>
        <div>
          {/* 站内成员显示昵称并标色，路人显示游戏 ID */}
          {r.nickname
            ? <span style={{ fontWeight: 700, color: '#fa541c' }}>{r.nickname}</span>
            : <span style={{ color: '#666' }}>{r.riotId}</span>}
          {r.teamPosition && (
            <span style={{ color: '#bbb', fontSize: 11, marginLeft: 6 }}>
              {POSITION_LABEL[r.teamPosition] || r.teamPosition}
            </span>
          )}
        </div>
        <div style={{ color: '#ccc', fontSize: 11 }}>
          {r.nickname ? r.riotId : null}
          {r.tier && (
            <Tooltip title="当前段位，不是这一场时的段位">
              <span style={{ color: tierColor(r.tier), fontWeight: 700, marginLeft: r.nickname ? 6 : 0 }}>
                {tierText(r.tier, r.rankDiv)}
                {r.leaguePoint != null && ` ${r.leaguePoint}LP`}
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    ),
  },
  {
    title: 'KDA',
    key: 'kda',
    width: 92,
    align: 'right',
    render: (_, r) => (
      <div style={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        <div>{r.kills}/{r.deaths}/{r.assists}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>{num1(r.kda)}</div>
      </div>
    ),
  },
  { title: '参团率', key: 'kp', width: 66, align: 'right', render: (_, r) => rate(r.killPart) },
  {
    title: '补刀',
    key: 'cs',
    width: 74,
    align: 'right',
    render: (_, r) => (
      <div style={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        <div>{r.cs}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>
          {r.timePlayed ? (r.cs / (r.timePlayed / 60)).toFixed(1) : '—'}/分
        </div>
      </div>
    ),
  },
  {
    title: '经济',
    key: 'gold',
    width: 80,
    align: 'right',
    render: (_, r) => (
      <div style={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        <div>{k(r.gold)}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>{Math.round(r.gpm || 0)}/分</div>
      </div>
    ),
  },
  {
    title: '输出',
    key: 'dmg',
    width: 84,
    align: 'right',
    render: (_, r) => (
      <div style={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        <div>{k(r.dmgChamp)}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>{Math.round(r.dpm || 0)}/分</div>
      </div>
    ),
  },
  { title: '输出占比', key: 'ds', width: 76, align: 'right', render: (_, r) => rate(r.dmgShare) },
  {
    // 每 1 金币打出多少对英雄伤害。Riot 没这个字段，是自己算的——
    // 同样 12k 经济，打出 25k 伤害和打出 8k 是两回事
    title: <Tooltip title="伤害转化：每 1 金币打出多少对英雄伤害">伤转</Tooltip>,
    key: 'dpg',
    width: 62,
    align: 'right',
    render: (_, r) => num1(r.dmgPerGold),
  },
  {
    title: '承伤',
    key: 'taken',
    width: 84,
    align: 'right',
    render: (_, r) => (
      <div style={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        <div>{k(r.dmgTaken)}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>{rate(r.takenShare)}</div>
      </div>
    ),
  },
  {
    title: '视野',
    key: 'vision',
    width: 74,
    align: 'right',
    render: (_, r) => (
      <div style={{ lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        <div>{r.vision}</div>
        <div style={{ color: '#bbb', fontSize: 11 }}>{num1(r.vpm)}/分</div>
      </div>
    ),
  },
]

/**
 * 展开行：属于个人的细节。
 *
 * 这些放不进主表——横着比没有意义（谁的物理伤害更高说明不了什么），
 * 但看单个人时很有用。全是原始 JSON 里现成的，一分钱没多花。
 */
function PlayerExtra({ p }) {
  const multi = [
    p.pentaKills > 0 && `五杀 ${p.pentaKills}`,
    p.quadraKills > 0 && `四杀 ${p.quadraKills}`,
    p.tripleKills > 0 && `三杀 ${p.tripleKills}`,
    p.doubleKills > 0 && `双杀 ${p.doubleKills}`,
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 26px', padding: '4px 2px', fontSize: 12 }}>
      <Group title="伤害构成" items={[
        ['物理', k(p.dmgPhysical)],
        ['魔法', k(p.dmgMagic)],
        ['真实', k(p.dmgTrue)],
        ['对防御塔', k(p.dmgTurret)],
        ['对野怪/目标', k(p.dmgObjective)],
      ]} />
      <Group title="对线期" items={[
        ['前 10 分钟补刀', p.cs10 || 0],
        ['等级领先对位', p.levelLead || 0],
        ['单杀', p.soloKills || 0],
        ['一血', p.firstBlood === '1' ? '是' : '否'],
      ]} />
      <Group title="视野" items={[
        ['插眼', p.wardsPlaced || 0],
        ['排眼', p.wardsKilled || 0],
        ['控制守卫', p.controlWards || 0],
      ]} />
      <Group title="目标参与" items={[
        ['推塔', p.turretTakedowns || 0],
        ['镀层', p.turretPlates || 0],
        ['小龙', p.dragonTakedowns || 0],
        ['大龙', p.baronTakedowns || 0],
      ]} />
      <Group title="其它" items={[
        ['最高连杀', p.killingSpree || 0],
        ['控制敌人次数', p.immobilizations || 0],
        ['治疗队友', k(p.healTeam)],
        ['护盾队友', k(p.shieldTeam)],
        ['阵亡时长', mmss(p.deadTime)],
        ...(multi.length ? [['多杀', multi.join('、')]] : []),
      ]} />
    </div>
  )
}

function Group({ title, items }) {
  return (
    <div>
      <div style={{ color: '#999', fontWeight: 700, marginBottom: 2 }}>{title}</div>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', minWidth: 132 }}>
          <span style={{ color: '#aaa' }}>{label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
