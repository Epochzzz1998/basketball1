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
    /**
     * 玩家。**三行各司其职，不让它们挤在一行里换行**：
     * 昵称+位置 / 游戏 ID / 段位。
     *
     * 原来是两行——第二行塞了游戏 ID 和段位两样，中文段位名又长
     * （「英勇黄铜 I 97LP」），在窄列里会从中间断开，断点还不固定，
     * 看着像排版坏了。各自独占一行之后每行都短，宽度再窄也只是右侧留白。
     */
    title: '玩家',
    key: 'who',
    width: 186,
    render: (_, r) => (
      <div style={{ lineHeight: 1.35 }}>
        <div style={{ whiteSpace: 'nowrap' }}>
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
        {/* 成员才需要这一行：路人的游戏 ID 已经在第一行了 */}
        {r.nickname && (
          <div style={{ color: '#ccc', fontSize: 11, whiteSpace: 'nowrap' }}>{r.riotId}</div>
        )}
        <div style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {r.tier ? (
            <Tooltip title="当前段位，不是这一场时的段位">
              <span style={{ color: tierColor(r.tier), fontWeight: 700 }}>
                {tierText(r.tier, r.rankDiv)}
                {r.leaguePoint != null && ` ${r.leaguePoint}LP`}
              </span>
            </Tooltip>
          ) : r.rankPending === '1' ? (
            /* 「还没查到」和「未定级」是两回事，不能都显示成灰字。
               路人的段位是后台按最近出现过的顺序慢慢补的，几千个人要十几个小时 */
            <Tooltip title="段位还在后台补，最近的对局会先补上">
              <span style={{ color: '#ddd' }}>段位查询中</span>
            </Tooltip>
          ) : (
            <span style={{ color: '#ddd' }}>未定级</span>
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
 *
 * ## 为什么伤害构成用条形图而不是三个数字
 *
 * 物理/魔法/真实本质上是**一个比例**，而比例用数字表达要读者自己心算。
 * 一条堆叠条一眼就能看出「这是个纯 AD」还是「混伤」——
 * 而那正是看这一栏唯一想知道的事。
 *
 * ## 为什么零值要压暗
 *
 * 这里十几个指标里通常大半是 0（没推塔、没拿龙、不是辅助所以没治疗）。
 * 全用一样的颜色的话，眼睛得逐行扫过去才能找到有值的那几个。
 * 压暗之后，**非零的自己会跳出来**，这一栏才有「一眼看完」的可能。
 */
function PlayerExtra({ p }) {
  const multi = [
    p.pentaKills > 0 && `五杀 ×${p.pentaKills}`,
    p.quadraKills > 0 && `四杀 ×${p.quadraKills}`,
    p.tripleKills > 0 && `三杀 ×${p.tripleKills}`,
    p.doubleKills > 0 && `双杀 ×${p.doubleKills}`,
  ].filter(Boolean)

  return (
    <div style={{
      display: 'grid', gap: 10, padding: '2px 0',
      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    }}>
      <Panel title="伤害构成" accent="#e07b39">
        <DamageBar p={p} />
        <Row label="对防御塔" value={p.dmgTurret} fmt={k} />
        <Row label="对野怪 / 目标" value={p.dmgObjective} fmt={k} />
      </Panel>

      <Panel title="对线期" accent="#4a8fe0">
        <Row label="前 10 分钟补刀" value={p.cs10} />
        <Row label="等级领先对位" value={p.levelLead} signed />
        <Row label="单杀" value={p.soloKills} />
        <Row label="一血" value={p.firstBlood === '1' ? 1 : 0} fmt={(v) => (v ? '是' : '否')} />
      </Panel>

      <Panel title="视野" accent="#7c5cd6">
        <Row label="插眼" value={p.wardsPlaced} />
        <Row label="排眼" value={p.wardsKilled} />
        <Row label="控制守卫" value={p.controlWards} />
      </Panel>

      <Panel title="目标参与" accent="#d4a017">
        <Row label="推塔" value={p.turretTakedowns} />
        <Row label="镀层" value={p.turretPlates} />
        <Row label="小龙" value={p.dragonTakedowns} />
        <Row label="大龙" value={p.baronTakedowns} />
      </Panel>

      <Panel title="战斗 / 生存" accent="#d8443c">
        <Row label="最高连杀" value={p.killingSpree} />
        <Row label="控制敌人次数" value={p.immobilizations} />
        <Row label="治疗队友" value={p.healTeam} fmt={k} />
        <Row label="护盾队友" value={p.shieldTeam} fmt={k} />
        {/* 阵亡时长永远非零，用固定色；它也是这一栏里唯一"越小越好"的数 */}
        <Row label="阵亡时长" value={p.deadTime} fmt={mmss} always />
        {multi.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {multi.map((m) => <Tag key={m} color="volcano" style={{ margin: 0, fontSize: 11 }}>{m}</Tag>)}
          </div>
        )}
      </Panel>
    </div>
  )
}

/**
 * 伤害构成的堆叠条。
 *
 * 分母用三段之和而不是 `dmgChamp`：后者在个别对局里会和三段的和对不上
 * （Riot 那边的口径差异），除出来会超过 100%，条就画飞了。
 */
function DamageBar({ p }) {
  const parts = [
    { key: '物理', v: p.dmgPhysical || 0, color: '#e07b39' },
    { key: '魔法', v: p.dmgMagic || 0, color: '#4a8fe0' },
    { key: '真实', v: p.dmgTrue || 0, color: '#9aa4ae' },
  ]
  const total = parts.reduce((a, b) => a + b.v, 0)
  if (!total) {
    return <div style={{ color: '#ccc', fontSize: 11, padding: '2px 0 6px' }}>没有对英雄伤害</div>
  }
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
        {parts.map((x) => (
          x.v > 0 && <div key={x.key} style={{ width: `${(x.v / total) * 100}%`, background: x.color }} />
        ))}
      </div>
      {parts.map((x) => (
        <div key={x.key} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: x.color, flexShrink: 0, opacity: x.v ? 1 : .25 }} />
          <span style={{ color: x.v ? '#666' : '#ccc' }}>{x.key}</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: x.v ? '#333' : '#ccc' }}>
            {k(x.v)}
          </span>
          <span style={{ width: 34, textAlign: 'right', color: '#bbb', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round((x.v / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

/** 一组指标。左边一条彩色竖线当锚点，比给每组配个图标更安静 */
function Panel({ title, accent, children }) {
  return (
    <div style={{
      background: '#fafafa', borderRadius: 8, padding: '8px 10px',
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ fontWeight: 700, color: '#555', marginBottom: 4, fontSize: 12 }}>{title}</div>
      {children}
    </div>
  )
}

/**
 * 一行「名称 —— 值」。
 *
 * `value` 为 0 时整行压暗（见 PlayerExtra 的说明）；`always` 用于那些
 * 「0 也有意义」的项（比如阵亡时长）。
 */
function Row({ label, value, fmt, signed, always }) {
  const zero = !always && !value
  const shown = fmt ? fmt(value) : (signed && value > 0 ? `+${value}` : String(value ?? 0))
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, lineHeight: 1.8 }}>
      <span style={{ color: zero ? '#ccc' : '#888' }}>{label}</span>
      <span style={{
        color: zero ? '#ccc' : '#333',
        fontWeight: zero ? 400 : 600,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {shown}
      </span>
    </div>
  )
}
