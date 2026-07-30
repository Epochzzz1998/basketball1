import { useEffect, useState } from 'react'
import { Card, Empty, Segmented, Select, Space, Spin, Table, Tag } from 'antd'
import { DAYS_OPTIONS, QUEUE_OPTIONS, lolApi } from '../../api/lol'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import LolUserAvatar from './LolUserAvatar'
import LolPlayerCard from './LolPlayerCard'
import { pct, rateColor } from './lolFormat'

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
  // 点开的那个人。同战绩流的详情弹层：局部 state，不走路由
  const [openUser, setOpenUser] = useState(null)

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
        title="个人榜"
        size="small"
        extra={<span style={{ color: '#999', fontSize: 12 }}>满 {board?.minGames ?? 5} 场才上榜</span>}
        style={{ borderRadius: 14, marginBottom: 14 }}
        styles={{ body: { padding: isMobile ? 0 : 8 } }}
      >
        {board === null ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : (
          <Table
            className="stat-compact"
            size="small"
            rowKey="userId"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={board.rows || []}
            locale={{ emptyText: <Empty description={`还没有人满 ${board?.minGames ?? 5} 场`} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={personColumns(isMobile, setOpenUser)}
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
            rowKey={(r) => `${r.u1}-${r.u2}`}
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={duo}
            locale={{ emptyText: <Empty description="还没有够场次的固定组合" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={[
              {
                title: '组合',
                key: 'pair',
                render: (_, r) => (
                  <span style={{ fontWeight: 600 }}>
                    {r.n1 || '?'} <span style={{ color: '#ccc' }}>+</span> {r.n2 || '?'}
                  </span>
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
        userId={openUser}
        days={days}
        open={!!openUser}
        onClose={() => setOpenUser(null)}
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
 * 个人榜的列。
 *
 * 手机上只留「谁 / 场次 / 胜率 / KDA」——那块屏幕放不下八列，横向滚动的表格
 * 在这一页尤其难受（左右滑手势在数据页是关掉的，只能用手指推表格本身）。
 * 参团率、伤害占比这些留给桌面端。
 */
function personColumns(isMobile, onOpen) {
  const base = [
    {
      title: '玩家',
      key: 'who',
      fixed: isMobile ? undefined : 'left',
      render: (_, r) => (
        // 整块可点：进这个人的资料卡（英雄池、位置、常一起打的人）
        <span
          role="button"
          onClick={() => onOpen(r.userId)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <LolUserAvatar name={r.nickname} src={r.avatar} size={24} />
          <span style={{ fontWeight: 600, color: '#fa541c' }}>{r.nickname || '（未知）'}</span>
        </span>
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
