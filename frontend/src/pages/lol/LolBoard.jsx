import { useEffect, useMemo, useState } from 'react'
import { Card, Empty, Segmented, Select, Space, Spin, Table, Tag } from 'antd'
import { DAYS_OPTIONS, QUEUE_OPTIONS, lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import LolUserAvatar from './LolUserAvatar'
import LolPlayerCard from './LolPlayerCard'
import { pct, rateColor, tierColor, tierText } from './lolFormat'

/**
 * 榜单：个人榜 + 开黑组合榜。
 *
 * ## 门槛不是可选项
 *
 * 上榜要求最低场次（后端默认 5 场）。这不是在过滤脏数据，是**这张榜可不可信**的前提：
 * 几百场规模的样本里任何「率」都不稳，1 场 100% 胜率排第一会让所有人第一天就不再看它。
 * 所以门槛写在界面上明说，而不是悄悄过滤掉几个人让他们以为自己没数据。
 *
 * ## 开黑组合榜才是这个模块的意义
 *
 * 个人榜 OP.GG 也有（而且比这准）。但「你和谁一起打得最多、一起赢得最多」
 * 只有把这几个人放在一起才算得出来——公共平台不知道你们是谁。
 */
export default function LolBoard() {
  const isMobile = useIsMobile()
  const [days, setDays] = useUrlState('days', 30, true)
  const [queueId, setQueueId] = useUrlState('queue', 0, true)
  const [board, setBoard] = useState(null)
  const [duo, setDuo] = useState(null)
  // 点开的那个**账号**（榜单现在按号排，点哪一行就看哪个号）。
  // 资料卡本身仍按人组织，所以两样都要带上：用户决定看谁，PUUID 决定默认勾哪个号
  const [openAcct, setOpenAcct] = useState(null)
  // 排序在前端做：榜上最多二十来行，为它给后端加一套排序参数不划算，
  // 而且换排序不该再走一趟网络
  const [sortBy, setSortBy] = useUrlState('sort', 'rate')

  useEffect(() => {
    let alive = true
    setBoard(null)
    setDuo(null)
    const params = { days, queueId }
    lolApi.board(params).then((d) => alive && setBoard(d || {})).catch(() => alive && setBoard({}))
    lolApi.duo(params).then((d) => alive && setDuo(Array.isArray(d) ? d : [])).catch(() => alive && setDuo([]))
    return () => { alive = false }
  }, [days, queueId])

  const summary = board?.summary
  const total = Number(summary?.totalMatches || 0)
  const premade = Number(summary?.premadeMatches || 0)

  const sorted = useMemo(() => {
    const rows = [...(board?.rows || [])]
    const by = {
      // 胜率相同时场次多的在前：五战四胜比两战两胜更有说服力
      rate: (a, b) => (b.wins / b.games) - (a.wins / a.games) || b.games - a.games,
      games: (a, b) => b.games - a.games,
      kda: (a, b) => (b.avgKda || 0) - (a.avgKda || 0),
      // rankScore 由后端按每个账号自己的段位算好（大段×10000 + 小段×100 + LP）；
      // 未定级是 -10000，自然沉底
      rank: (a, b) => (b.rankScore ?? -99999) - (a.rankScore ?? -99999),
    }
    return rows.sort(by[sortBy] || by.rate)
  }, [board, sortBy])

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented value={days} onChange={setDays} options={DAYS_OPTIONS} />
        <Select
          value={queueId}
          onChange={setQueueId}
          options={QUEUE_OPTIONS}
          style={{ width: 132 }}
        />
        <Select
          value={sortBy}
          onChange={setSortBy}
          style={{ width: 118 }}
          options={[
            { value: 'rate', label: '按胜率' },
            { value: 'rank', label: '按段位' },
            { value: 'games', label: '按场次' },
            { value: 'kda', label: '按 KDA' },
          ]}
        />
      </div>

      {/* 概览：开黑占比这个数本身就值得摆在最上面——它回答「我们到底是不是一起玩的」 */}
      {total > 0 && (
        <Card
          size="small"
          style={{ borderRadius: 14, marginBottom: 14 }}
          styles={{ body: { padding: '10px 16px' } }}
        >
          <Space size={isMobile ? 14 : 28} wrap>
            <Stat label="总场次" value={total} />
            <Stat label="开黑场次" value={premade} />
            <Stat label="开黑占比" value={total ? `${Math.round((premade / total) * 100)}%` : '—'} />
          </Space>
        </Card>
      )}

      <Card
        title="账号榜"
        size="small"
        extra={<span style={{ color: '#999', fontSize: 12 }}>按游戏账号排 · 点账号看资料 · 满 {board?.minGames ?? 5} 场才上榜</span>}
        style={{ borderRadius: 14, marginBottom: 14 }}
        styles={{ body: { padding: isMobile ? 0 : 8 } }}
      >
        {board === null ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : (
          <Table
            className="stat-compact"
            size="small"
            rowKey="puuid"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={sorted}
            locale={{ emptyText: <Empty description={`还没有人满 ${board?.minGames ?? 5} 场`} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={personColumns(isMobile, (r) => setOpenAcct({ userId: r.userId, puuid: r.puuid }))}
          />
        )}
      </Card>

      <Card
        title="开黑组合"
        size="small"
        extra={<span style={{ color: '#999', fontSize: 12 }}>同队才算</span>}
        style={{ borderRadius: 14 }}
        styles={{ body: { padding: isMobile ? 0 : 8 } }}
      >
        {duo === null ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : (
          <Table
            className="stat-compact"
            size="small"
            rowKey={(r) => `${r.p1}-${r.p2}`}
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={duo}
            locale={{ emptyText: <Empty description="还没有够场次的固定组合" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={[
              {
                /* 组合也按**游戏账号**配对：按人配的话，「甲的小号+乙的大号」
                   和「甲的大号+乙的大号」会算成同一对，而那是两种完全不同的组合 */
                title: '组合',
                key: 'pair',
                render: (_, r) => (
                  <div style={{ lineHeight: 1.35, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.g1 || '?'}
                      <span style={{ color: '#ccc', margin: '0 5px' }}>+</span>
                      {r.g2 || '?'}
                    </div>
                    <div style={{ color: '#bbb', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {r.n1 || '—'} · {r.n2 || '—'}
                    </div>
                  </div>
                ),
              },
              { title: '场次', dataIndex: 'games', width: 66, align: 'right' },
              {
                title: '胜率',
                key: 'rate',
                width: 90,
                align: 'right',
                render: (_, r) => (
                  <span style={{ color: rateColor(r.games ? r.wins / r.games : 0), fontWeight: 700 }}>
                    {pct(r.wins, r.games)}
                    <span style={{ color: '#bbb', fontWeight: 400, marginLeft: 4 }}>{r.wins}胜</span>
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>

      <LolPlayerCard
        userId={openAcct?.userId}
        initialPuuid={openAcct?.puuid}
        days={days}
        open={!!openAcct}
        onClose={() => setOpenAcct(null)}
      />
    </>
  )
}

function Stat({ label, value }) {
  return (
    <span>
      <span style={{ color: '#999', fontSize: 12, marginRight: 6 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 16 }}>{value}</span>
    </span>
  )
}

/**
 * 账号榜的列。
 *
 * **一行是一个游戏账号，不是一个人**——一个人的大号和小号段位常常差好几档，
 * 合在一起算出来的胜率哪一边都不代表。所属用户单独一列，信息没丢，
 * 只是不再当成聚合单位。
 *
 * 手机上只留「账号 / 段位 / 场次 / 胜率 / KDA」——那块屏幕放不下九列，
 * 而横向滚动的表格在这一页尤其难受（左右滑手势在数据页是关掉的，只能推表格本身）。
 */
function personColumns(isMobile, onOpen) {
  const base = [
    {
      title: '账号',
      key: 'who',
      fixed: isMobile ? undefined : 'left',
      width: 168,
      render: (_, r) => (
        // 整块可点：进这个号的资料卡（英雄池、位置、常一起打的人）
        <div
          role="button"
          onClick={() => onOpen(r)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', lineHeight: 1.35 }}
        >
          <LolUserAvatar name={r.ownerName} src={r.ownerAvatar} size={24} />
          {/* 两行左对齐到同一条竖线：游戏 ID 在上、所属用户在下。
              表格整体是居中对齐的（.stat-compact 那条规则），这里必须显式声明 left，
              否则两行各自按自己的宽度居中，起点参差不齐 */}
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#fa541c', whiteSpace: 'nowrap' }}>
              {r.gameName || '（未绑定）'}
              {r.tagLine && <span style={{ color: '#ddd', fontWeight: 400 }}>#{r.tagLine}</span>}
            </div>
            {/* 所属用户：这一列存在的意义就是「这号是谁的」，所以不能省 */}
            <div style={{ color: '#bbb', fontSize: 11, whiteSpace: 'nowrap' }}>
              {r.ownerName || '—'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '段位',
      key: 'tier',
      width: 116,
      render: (_, r) => (
        r.tier
          ? (
            <span style={{ fontSize: 12, color: tierColor(r.tier), fontWeight: 700, whiteSpace: 'nowrap' }}>
              {tierText(r.tier, r.rankDiv)}
              {r.leaguePoint != null && <span style={{ color: '#bbb', fontWeight: 400, marginLeft: 4 }}>{r.leaguePoint}LP</span>}
            </span>
          )
          : <span style={{ color: '#ccc', fontSize: 12 }}>未定级</span>
      ),
    },
    { title: '场次', dataIndex: 'games', width: 62, align: 'right' },
    {
      title: '胜率',
      key: 'rate',
      width: 88,
      align: 'right',
      render: (_, r) => (
        <span style={{ color: rateColor(r.games ? r.wins / r.games : 0), fontWeight: 700 }}>
          {pct(r.wins, r.games)}
          <span style={{ color: '#bbb', fontWeight: 400, marginLeft: 4 }}>{r.wins}胜</span>
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
          {r.avgKda == null ? '—' : Number(r.avgKda).toFixed(2)}
          <span style={{ color: '#bbb', fontSize: 12, marginLeft: 6 }}>
            {r.kills}/{r.deaths}/{r.assists}
          </span>
        </span>
      ),
    },
  ]
  if (isMobile) return base
  return [
    ...base,
    { title: '参团率', key: 'kp', width: 84, align: 'right', render: (_, r) => percentCell(r.avgKillPart) },
    { title: '伤害占比', key: 'ds', width: 92, align: 'right', render: (_, r) => percentCell(r.avgDmgShare) },
    { title: '场均视野', dataIndex: 'avgVision', width: 92, align: 'right' },
    { title: '每分补刀', dataIndex: 'csPerMin', width: 92, align: 'right' },
  ]
}

const percentCell = (v) => (v == null ? '—' : `${Math.round(Number(v) * 100)}%`)
