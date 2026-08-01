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

  // 身份列：这个人是谁、被谁在第几顺位选走的
  const idCols = useMemo(() => ([
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
  ]), [isMobile])

  /**
   * 生涯累计列。
   *
   * **必须顶着「生涯累计」这个组标题**，不能光写「得分」「胜利贡献」：站里别处
   * 这几个名字指的都是**场均/单季**（资料卡的胜利贡献 15 就是 MVP 级），
   * 这里却是一整个生涯加起来——同一个词两种量级，不说清楚只会让人以为数据错了。
   */
  const careerCols = useMemo(() => ([
    { title: '赛季', dataIndex: 'seasons', width: 54, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '出场', dataIndex: 'games', width: 62, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '总得分', dataIndex: 'pts', width: 72, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '总篮板', dataIndex: 'trb', width: 70, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '总助攻', dataIndex: 'ast', width: 70, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    // 盖帽抢断 1973-74 才开始统计，之前的联盟根本没记——空着显示 —，不是数据缺失
    { title: '总盖帽', dataIndex: 'blk', width: 70, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
    { title: '总抢断', dataIndex: 'stl', width: 70, render: (v) => v ?? <span style={{ color: '#ddd' }}>—</span> },
  ]), [])

  const columns = useMemo(() => {
    const id = isMobile ? compactColumns(idCols) : idCols
    // 组标题只套在生涯那几列上，身份列不套——套上去它们会平白多顶一行空表头
    const career = isMobile ? compactColumns(careerCols) : careerCols
    return [...id, { title: '生涯累计', key: 'career', children: career }]
  }, [isMobile, idCols, careerCols])

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
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这一届没有数据" style={{ padding: 30 }} />}
    </Card>
  )
}
