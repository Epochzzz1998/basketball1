import { useEffect, useState } from 'react'
import { Card, Col, Empty, Row, Segmented, Spin, Table, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { playerApi } from '../../api/player'
import { fmtNum, fmtPct, seasonYearLabel } from './rankConfig'
import { compactColumns, sumColWidth } from './statColumns'
import { TeamNames } from '../../components/TeamLogo'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 历史荣誉：某个奖项从 1946-47 至今的逐季获奖者，外加"谁拿得最多"。
 *
 * 两类奖项的来源完全不同：
 *  · **评选类**（MVP/DPOY/FMVP/最佳新秀/第六人/进步奖）是官方投票结果，只能靠抓取。
 *    老赛季没抓到的年份就是空的——不猜、不用数据倒推，那样会造出official 从没颁过的奖。
 *  · **统计王**（得分王、篮板王…）是可以算的：当季过资格线的人里该项第一名。所以这一类
 *    80 个赛季全都有，1947 年的得分王也算得出来。
 */

const VOTED = [
  { key: 'mvp', label: 'MVP', since: '1955-56 起评选' },
  { key: 'dpoy', label: '最佳防守球员', since: '1982-83 起评选' },
  { key: 'fmvp', label: '总决赛 MVP', since: '1968-69 起评选' },
  { key: 'roy', label: '最佳新秀', since: '1952-53 起评选' },
  { key: 'smoy', label: '最佳第六人', since: '1982-83 起评选' },
  { key: 'mip', label: '最快进步球员', since: '1985-86 起评选' },
]

const CROWNS = [
  { key: 'playerAvgScore', label: '得分王' },
  { key: 'playerAvgReb', label: '篮板王' },
  { key: 'playerAvgAss', label: '助攻王' },
  { key: 'playerAvgSteal', label: '抢断王' },
  { key: 'playerAvgBlock', label: '盖帽王' },
  { key: 'playerAvgTpm', label: '三分王' },
  { key: 'playerAvgFgm', label: '命中王' },
  { key: 'playingTime', label: '时间王' },
  { key: 'playerAccuracy', label: '投篮命中率王', pct: true },
  { key: 'playerThreeAccuracy', label: '三分命中率王', pct: true },
  { key: 'playerFreethrowAccuracy', label: '罚球命中率王', pct: true },
]

const ALL = [...VOTED, ...CROWNS]
const MEDAL = ['#f5b301', '#9aa0a6', '#b87333']

export default function AwardHistory() {
  const isMobile = useIsMobile()
  const [award, setAward] = useState('mvp')
  const [rows, setRows] = useState(null)
  const stat = ALL.find((a) => a.key === award) || ALL[0]
  const isCrown = CROWNS.some((c) => c.key === award)

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.awardHistory(award)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [award])

  // 拿得最多的人：同一赛季并列算各拿一次（统计王有并列，评选类不会）
  const tally = (rows || []).reduce((acc, r) => {
    const k = r.playerId || r.playerName
    if (!k) return acc
    acc[k] = acc[k] || { playerId: r.playerId, playerName: r.playerName, n: 0, seasons: [] }
    acc[k].n += 1
    acc[k].seasons.push(r.seasonNum)
    return acc
  }, {})
  const top = Object.values(tally).sort((a, b) => b.n - a.n || b.seasons[0] - a.seasons[0]).slice(0, 10)

  const fmtVal = (v) => (v == null ? '-' : stat.pct ? fmtPct(v) : fmtNum(v))

  const columns = [
    {
      title: '赛季', dataIndex: 'seasonNum', width: 96, fixed: 'left',
      render: (n) => seasonYearLabel(n).replace(' 赛季', ''),
    },
    {
      title: '球员', dataIndex: 'playerName', width: 130,
      render: (name, r) => (r.playerId
        ? <Link to={`/players/${r.playerId}?seasonNum=${r.seasonNum}`}>{name}</Link>
        : name || '-'),
    },
    { title: '球队', dataIndex: 'playerTeam', width: 84, render: (v) => <TeamNames value={v} /> },
    { title: '出场', dataIndex: 'games', width: 56 },
    ...(isCrown
      ? [{ title: stat.label.replace('王', ''), dataIndex: 'val', width: 76, render: (v) => <b style={{ color: '#fa541c' }}>{fmtVal(v)}</b> }]
      : [
          { title: '得分', dataIndex: 'pts', width: 56, render: (v) => fmtNum(v) },
          { title: '篮板', dataIndex: 'reb', width: 56, render: (v) => fmtNum(v) },
          { title: '助攻', dataIndex: 'ast', width: 56, render: (v) => fmtNum(v) },
        ]),
    // 最佳防守球员多给三列：光看得分篮板助攻，看不出这个人凭什么拿防守奖。
    // 防守效率是 DRtg（对手每 100 回合得分），越低越好，所以标题里点一下方向
    ...(award === 'dpoy'
      ? [
          { title: '盖帽', dataIndex: 'blk', width: 56, render: (v) => fmtNum(v) },
          { title: '抢断', dataIndex: 'stl', width: 56, render: (v) => fmtNum(v) },
          { title: '防守效率', dataIndex: 'defEff', width: 84, render: (v) => (v == null ? '-' : fmtNum(v, 0)) },
        ]
      : []),
  ]
  const cols = isMobile ? compactColumns(columns) : columns

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          size="small"
          value={award}
          onChange={setAward}
          options={[
            ...VOTED.map((a) => ({ label: a.label, value: a.key })),
            ...CROWNS.map((a) => ({ label: a.label, value: a.key })),
          ]}
          style={{ maxWidth: '100%', overflowX: 'auto' }}
        />
      </div>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
        {isCrown
          ? '统计王按当季**过资格线的人里该项第一名**计算（资格线 = 球队场次的 70%），所以 1946-47 至今每一季都有；并列全部保留。'
          : `官方评选结果，${stat.since}。更早的年份、以及当年还没设立这个奖的年份都不会出现在下面。`}
        {award === 'fmvp' && '数据是**总决赛那一轮**的场均，不是常规赛也不是整个季后赛。分轮次数据只到 1976-77，更早的 8 届只有获奖记录，数据留空。'}
        {award === 'dpoy' && '防守效率是 DRtg（他在场时对手每 100 回合得分），越低越好。'}
      </div>

      {rows === null ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title={`${stat.label} · 获得次数最多`} styles={{ body: { padding: '8px 16px' } }}>
              {top.length ? top.map((t, i) => (
                <div
                  key={t.playerId || t.playerName}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '8px 0',
                    borderBottom: i === top.length - 1 ? 'none' : '1px solid #f5f5f5',
                  }}
                >
                  <span style={{ width: 26, fontWeight: 700, fontStyle: 'italic', color: i < 3 ? MEDAL[i] : '#bbb' }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {t.playerId ? <Link to={`/players/${t.playerId}?seasonNum=99`}>{t.playerName}</Link> : t.playerName}
                  </span>
                  <Tag color={i < 3 ? 'gold' : 'default'} style={{ marginInlineEnd: 0 }}>×{t.n}</Tag>
                </div>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card title={`${stat.label} · 逐季`} extra={<span style={{ color: '#bbb', fontSize: 12 }}>{rows.length} 季</span>} styles={{ body: { padding: 0 } }}>
              {rows.length ? (
                <Table
                  className="clean-table stat-compact"
                  bordered
                  rowKey={(r) => `${r.seasonNum}-${r.playerId || r.playerName}`}
                  dataSource={rows}
                  columns={cols}
                  size="middle"
                  /* 跟历史总榜同一套：页面自己滚（不套内层滚动区），分页控住 DOM 行数 */
                  pagination={{ pageSize: 50, showSizeChanger: false, size: 'small', showLessItems: isMobile }}
                  scroll={{ x: sumColWidth(cols) }}
                />
              ) : <Empty description="这个奖项暂无历史数据" style={{ padding: 40 }} />}
            </Card>
          </Col>
        </Row>
      )}
    </>
  )
}
