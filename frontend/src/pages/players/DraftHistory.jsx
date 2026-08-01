import { useEffect, useMemo, useState } from 'react'
import { Card, Empty, Select, Table, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { playerApi } from '../../api/player'
import TeamLogo from '../../components/TeamLogo'
import useIsMobile from '../../hooks/useIsMobile'
import useUrlState from '../../hooks/useUrlState'
import { compactColumns } from './statColumns'
import { draftTier } from './draftConfig'

/**
 * 历史选秀（/history?tab=draft）：一届一张表，1947 年至今 80 届。
 *
 * ## 为什么把生涯数据也摆上来
 *
 * 一届选秀表只列「谁在第几顺位被谁选走」的话，看两眼就没什么可看的了。
 * 真正有意思的是**这一届后来怎么样**——探花打成了名人堂、状元三年就走人，
 * 这些只有把生涯场次/得分/胜利贡献并排摆着才看得出来。这些列本来就躺在
 * B-R 的选秀页上，抓的时候顺手存了，一分钱没多花（见 draft_br.py）。
 *
 * ## 名字点得进去，点不进去的也不留死链接
 *
 * 本库有资料卡的进资料卡，只在 nba_career_totals 里的进最小档案，
 * 两样都没有的（从没打过一场 NBA 的落选秀，占多数）就是纯文本。
 * 和历史总榜那一页同一套规矩。
 */

const YEAR_FALLBACK = 2026

export default function DraftHistory() {
  const isMobile = useIsMobile()
  // 年份写进 URL：球员身份头上那枚选秀标签就是靠 ?year= 直接落到这一届的
  const [year, setYear] = useUrlState('year', YEAR_FALLBACK, true)
  const [years, setYears] = useState(null)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    playerApi.draftYears().then((r) => setYears(r?.length ? r : [YEAR_FALLBACK])).catch(() => setYears([YEAR_FALLBACK]))
  }, [])

  useEffect(() => {
    let alive = true
    setRows(null)
    playerApi.draftClass(year)
      .then((r) => { if (alive) setRows(r || []) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [year])

  const columns = useMemo(() => ([
    {
      title: '顺位', key: 'pick', width: isMobile ? 52 : 78, fixed: 'left',
      render: (_, r) => {
        const pick = Number(r.pickNum) || 0
        const tier = draftTier(pick)
        return (
          <span style={{
            fontWeight: pick && pick <= 3 ? 800 : 600,
            color: pick ? tier.color : '#bbb',
            whiteSpace: 'nowrap',
          }}>
            {/* 老年份没有总顺位，退回「轮-本轮第几个」，不编号。
                手机上只留数字：表头已经写着「顺位」，「第10顺位」五个字在窄列里会折成两行 */}
            {pick ? (isMobile ? pick : `第${pick}顺位`) : `${r.roundNum}轮${r.roundPick}`}
          </span>
        )
      },
    },
    {
      title: '球队', dataIndex: 'team', width: 66,
      render: (v) => (v ? <TeamLogo code={v} size={22} title={v} /> : <span style={{ color: '#ddd' }}>—</span>),
    },
    {
      title: '球员', key: 'name', width: 150, fixed: 'left',
      render: (_, r) => {
        const name = r.nameZh || r.nameEn
        if (r.playerId) return <Link to={`/players/${r.playerId}?seasonNum=99`}>{name}</Link>
        if (r.brId && r.games) return <Link to={`/players/history/${r.brId}`}>{name}</Link>
        // 一场没打过的落选秀：库里既没有资料卡也没有生涯行，链过去只会是空页
        return <span style={{ color: '#999' }}>{name}</span>
      },
    },
    // 轮次在手机上省掉：顺位已经能推出轮次，而窄屏一列都不能浪费
    ...(isMobile ? [] : [{ title: '轮次', dataIndex: 'roundNum', width: 54, render: (v) => `${v} 轮` }]),
    // ellipsis：大学全名（Central Michigan University）不截断的话会把整行撑成两行
    {
      title: '学校 / 来源', dataIndex: 'college', width: 150, ellipsis: true,
      render: (v) => v || <span style={{ color: '#ddd' }}>—</span>,
    },
    { title: '赛季', dataIndex: 'seasons', width: 54, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '出场', dataIndex: 'games', width: 62, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '得分', dataIndex: 'pts', width: 70, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '篮板', dataIndex: 'trb', width: 66, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '助攻', dataIndex: 'ast', width: 66, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    {
      title: '胜利贡献', dataIndex: 'ws', width: 80,
      render: (v) => (v == null ? <span style={{ color: '#ddd' }}>—</span>
        : <b style={{ color: '#fa541c' }}>{Number(v).toFixed(1)}</b>),
    },
  ]), [isMobile])

  const played = rows?.filter((r) => Number(r.games) > 0).length ?? 0

  return (
    <Card
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Select
            value={year}
            onChange={setYear}
            // 「2003 年选秀」在 116px 里会被省略成「2003 年...」，卡片标题已经说明是选秀了
            style={{ width: 104 }}
            options={(years || [year]).map((y) => ({ value: y, label: `${y} 年` }))}
            loading={years === null}
          />
          {rows && (
            <Tag color="orange">{rows.length} 个顺位</Tag>
          )}
          {rows && (
            <span style={{ color: '#999', fontSize: 12 }}>其中 {played} 人打过 NBA</span>
          )}
        </div>
      )}
      loading={rows === null}
      styles={{ body: { padding: 0 } }}
    >
      {rows?.length ? (
        <Table
          className="stat-compact"
          size="small"
          rowKey={(r) => `${r.draftYear}-${r.roundNum}-${r.roundPick}`}
          dataSource={rows}
          columns={isMobile ? compactColumns(columns) : columns}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这一届没有数据" style={{ padding: 30 }} />}
    </Card>
  )
}
