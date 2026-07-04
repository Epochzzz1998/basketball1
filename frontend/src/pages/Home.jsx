import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Row } from 'antd'
import { FireOutlined, RightOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useAuth } from '../auth/AuthContext'
import { newsApi } from '../api/news'
import { playerApi } from '../api/player'
import { teamApi } from '../api/team'
import SeasonPicker from '../components/SeasonPicker'
import { NBA_TEAM_NAMES, fmtNum, playoffRecord, teamRegion } from './players/rankConfig'

/**
 * 首页（P5-2 现代化改版 v2）：赛季维度的联盟总览仪表盘
 * - 页头赛季选择器统辖全页（默认最新赛季）；
 * - 五大单项领跑卡（得分/篮板/助攻/抢断/盖帽 Top3）；
 * - 联盟格局：东西部 15 队完整战绩（进季后赛的队胜率条着色） + 赛季荣誉 + 论坛热帖榜。
 * 数据并行拉取，各区块独立 loading；切赛季只刷新赛季维度的区块。
 */

const LATEST_SEASON = 16
const BRAND = '#fa541c'
const MEDAL = ['#f5222d', '#fa8c16', '#faad14']

const LEADER_STATS = [
  { field: 'playerAvgScore', label: '得分王', icon: '🎯' },
  { field: 'playerAvgReb', label: '篮板王', icon: '🛡️' },
  { field: 'playerAvgAss', label: '助攻王', icon: '🤝' },
  { field: 'playerAvgSteal', label: '抢断王', icon: '⚡' },
  { field: 'playerAvgBlock', label: '盖帽王', icon: '🧱' },
]

const clamp = (lines) => ({
  display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden',
})

/** 区块标题：品牌橙竖条 + 标题 + 右侧"更多"链接 */
function SectionTitle({ title, extra, onExtra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 2px 14px' }}>
      <span style={{ width: 4, height: 18, borderRadius: 2, background: BRAND }} />
      <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
      <span style={{ flex: 1 }} />
      {extra && (
        <a onClick={onExtra} style={{ fontSize: 13, color: '#888' }}>
          {extra} <RightOutlined style={{ fontSize: 10 }} />
        </a>
      )}
    </div>
  )
}

/** 单项领跑卡：榜首大字 + 2/3 名小行，整卡可点进完整排行 */
function LeaderCard({ stat, rows, seasonNum }) {
  const navigate = useNavigate()
  const top = rows?.[0]
  return (
    <Card
      hoverable
      loading={rows === null}
      onClick={() => navigate(`/rankings/${stat.field}?seasonNum=${seasonNum}&stage=rg`)}
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ body: { padding: '16px 18px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>{stat.label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 18 }}>{stat.icon}</span>
      </div>
      {top ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Link
              to={`/players/${top.playerId}`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 16, fontWeight: 700, color: '#222', ...clamp(1) }}
            >
              {top.playerName}
            </Link>
            <span style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>{top.playerTeam}</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: BRAND, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25, marginBottom: 10 }}>
            {fmtNum(top[stat.field])}
          </div>
          {rows.slice(1, 3).map((r, i) => (
            <div key={r.statsId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8c8c8c', padding: '3px 0' }}>
              <span style={{ width: 14, fontStyle: 'italic', fontWeight: 700, color: '#bbb' }}>{i + 2}</span>
              <span style={{ flex: 1, ...clamp(1) }}>{r.playerName}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r[stat.field])}</span>
            </div>
          ))}
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      )}
    </Card>
  )
}

/** 分区战局卡：15 队完整战绩 + 胜率条（进季后赛的队着色，未进灰色） */
function StandingsCard({ conf, rows, accent }) {
  const teams = rows
    ?.filter((r) => teamRegion(r.teamCode).conf === conf)
    .map((r) => ({ ...r, winRate: r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0 }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
  return (
    <Card
      title={<span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: accent, marginRight: 8, verticalAlign: 1 }} />{conf}战局</span>}
      extra={<Link to="/rankings" style={{ fontSize: 13, color: '#888' }}>球队排行 <RightOutlined style={{ fontSize: 10 }} /></Link>}
      loading={rows === null}
      style={{ borderRadius: 16, height: '100%' }}
      styles={{ body: { padding: '4px 18px 8px' } }}
    >
      {teams?.length ? (
        teams.map((t, i) => {
          const inPo = t.playoffResult && t.playoffResult !== '未进季后赛'
          return (
            <Link
              key={t.teamCode}
              to={`/players/team/${t.teamCode}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5.5px 0', color: 'inherit', fontSize: 13,
                borderBottom: i === teams.length - 1 ? 'none' : '1px solid #f7f7f7',
              }}
            >
              <span style={{ width: 20, textAlign: 'center', fontStyle: 'italic', fontWeight: 800, color: i < 3 ? MEDAL[i] : '#c8c8c8' }}>
                {i + 1}
              </span>
              <span style={{ fontWeight: 600 }}>{NBA_TEAM_NAMES[t.teamCode] || t.teamCode}</span>
              <span style={{ fontSize: 11, color: '#bbb' }}>{t.teamCode}</span>
              {t.playoffResult === '总冠军' && <span title="总冠军" style={{ fontSize: 12 }}>🏆</span>}
              <span style={{ flex: 1 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {t.wins}<span style={{ color: '#bbb' }}>-</span>{t.losses}
              </span>
              <span style={{ width: 44, height: 5, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'block', height: '100%', width: `${Math.round(t.winRate * 100)}%`,
                    background: inPo ? accent : '#d0d0d0', borderRadius: 3,
                  }}
                />
              </span>
            </Link>
          )
        })
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      )}
    </Card>
  )
}

/** 赛季荣誉速览：总冠军（季后赛球队榜推得，带夺冠战绩） + FMVP/最佳第六人/MIP（season_award） */
function HonorsCard({ awards, poTeams }) {
  const off = (p, r, a) => `${fmtNum(p)}分 ${fmtNum(r)}板 ${fmtNum(a)}助`
  const champion = poTeams?.find((t) => t.playoffResult === '总冠军')
  const rec = champion && playoffRecord('总冠军', champion.games)

  const rows = []
  if (champion) {
    rows.push({
      key: 'champ', icon: '🏆', label: '总冠军',
      name: NBA_TEAM_NAMES[champion.teamCode] || champion.teamCode, to: `/players/team/${champion.teamCode}`,
      sub: rec ? `季后赛 ${rec.wins}-${rec.losses} 夺冠` : '',
    })
  }
  for (const [key, icon, label] of [['fmvp', '🏅', '总决赛 FMVP'], ['smoy', '🪑', '最佳第六人'], ['mip', '📈', '最快进步球员']]) {
    const w = awards?.find((r) => r.award === key)
    if (!w) continue
    rows.push({
      key, icon, label, name: w.playerName, to: `/players/${w.playerId}`,
      sub: key === 'fmvp'
        ? `季后赛 ${off(w.poPts, w.poReb, w.poAst)}`
        : key === 'mip' && w.prevPts != null && w.pts != null
          ? `${off(w.pts, w.reb, w.ast)} · 较上季 ↑${(Number(w.pts) - Number(w.prevPts)).toFixed(1)}分`
          : off(w.pts, w.reb, w.ast),
    })
  }

  return (
    <Card
      title={<span>🏆 赛季荣誉</span>}
      extra={<Link to="/rankings" style={{ fontSize: 13, color: '#888' }}>全部荣誉 <RightOutlined style={{ fontSize: 10 }} /></Link>}
      loading={awards === null || poTeams === null}
      style={{ borderRadius: 16, background: 'linear-gradient(160deg, #fffdf5 0%, #fff8e6 100%)' }}
      styles={{ body: { padding: '6px 18px 10px' } }}
    >
      {rows.length ? (
        rows.map((r, i) => (
          <Link
            key={r.key}
            to={r.to}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', color: 'inherit',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(0,0,0,.05)',
            }}
          >
            <span style={{ fontSize: 22 }}>{r.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#ad8b00' }}>{r.label}</div>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
            </div>
            <span style={{ fontSize: 12, color: '#999', textAlign: 'right' }}>{r.sub}</span>
          </Link>
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无荣誉数据" />
      )}
    </Card>
  )
}

/** 论坛热帖榜：点赞×2 + 评论×3 计热度；卡片在右列里拉伸填满剩余高度 */
function HotList({ posts }) {
  return (
    <Card
      title={<span><FireOutlined style={{ color: '#f5222d', marginRight: 6 }} />热帖榜</span>}
      extra={<Link to="/news" style={{ fontSize: 13, color: '#888' }}>更多 <RightOutlined style={{ fontSize: 10 }} /></Link>}
      loading={posts === null}
      style={{ borderRadius: 16, flex: 1, display: 'flex', flexDirection: 'column' }}
      styles={{ body: { padding: '4px 18px 10px', flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      {posts?.length ? (
        posts.map((p, i) => (
          <Link
            key={p.newsId}
            to={`/news/${p.newsId}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', minHeight: 46, maxHeight: 64,
              borderBottom: i === posts.length - 1 ? 'none' : '1px solid #f5f5f5',
            }}
          >
            <span
              style={{
                width: 22, textAlign: 'center', fontStyle: 'italic', fontWeight: 800, fontSize: 15,
                color: i < 3 ? MEDAL[i] : '#c8c8c8', flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: i < 3 ? 600 : 400, ...clamp(1) }}>{p.title || '(无标题)'}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2, ...clamp(1) }}>
                {p.author} · 👍 {p.goodNum ?? 0} · 💬 {p.commentNum ?? 0}
              </div>
            </div>
          </Link>
        ))
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有帖子，来发第一帖" style={{ margin: 'auto' }} />
      )}
    </Card>
  )
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [seasonNum, setSeasonNum] = useState(LATEST_SEASON)
  const [forum, setForum] = useState(null) //      论坛帖（热帖榜；不随赛季变）
  const [leaders, setLeaders] = useState(null) //  [{stat, rows}] 五单项 Top3
  const [teams, setTeams] = useState(null) //      球队战绩（常规赛）
  const [poTeams, setPoTeams] = useState(null) //  季后赛球队榜（冠军战绩用）
  const [awards, setAwards] = useState(null) //    赛季特别奖

  // 论坛热帖：只拉一次。注意：新闻列表接口的 page/limit 实际不生效（ES 全量返回），前端自行截断
  useEffect(() => {
    let alive = true
    newsApi.listNews({ page: 1, limit: 20, newsChannel: 'forum' })
      .then((r) => { if (alive) setForum(r.records || []) })
      .catch(() => { if (alive) setForum([]) })
    return () => { alive = false }
  }, [])

  // 赛季维度数据：切赛季重拉
  useEffect(() => {
    let alive = true
    setLeaders(null); setTeams(null); setPoTeams(null); setAwards(null)
    Promise.all(
      LEADER_STATS.map((stat) =>
        playerApi.listSeasonStats({ page: 1, limit: 3, seasonNum, field: stat.field, order: 'desc' })
          .then((r) => ({ stat, rows: r.records || [] }))
          .catch(() => ({ stat, rows: [] })),
      ),
    ).then((rs) => { if (alive) setLeaders(rs) })
    teamApi.rankings(seasonNum)
      .then((r) => { if (alive) setTeams(Array.isArray(r) ? r : (r?.records || [])) })
      .catch(() => { if (alive) setTeams([]) })
    teamApi.playoffRankings(seasonNum)
      .then((r) => { if (alive) setPoTeams(Array.isArray(r) ? r : (r?.records || [])) })
      .catch(() => { if (alive) setPoTeams([]) })
    playerApi.seasonAwards(seasonNum)
      .then((r) => { if (alive) setAwards(r || []) })
      .catch(() => { if (alive) setAwards([]) })
    return () => { alive = false }
  }, [seasonNum])

  // 热帖榜：点赞×2 + 评论×3 计热度，同分按时间新旧
  const hotPosts = useMemo(() => {
    if (forum === null) return null
    return forum
      .map((p) => ({ ...p, hot: (p.goodNum ?? 0) * 2 + (p.commentNum ?? 0) * 3 }))
      .sort((a, b) => b.hot - a.hot || dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf())
      .slice(0, 6)
  }, [forum])

  return (
    <>
      {/* 游客引导条 */}
      {!user && (
        <div
          style={{
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: 'linear-gradient(90deg, #fff2e8 0%, #ffffff 70%)', border: '1px solid #ffd8bf',
            borderRadius: 14, padding: '12px 20px',
          }}
        >
          <span style={{ fontSize: 20 }}>👋</span>
          <span style={{ color: '#873800', fontWeight: 500 }}>登录后可发帖、评论、点赞，还能申请球员身份认证</span>
          <span style={{ flex: 1 }} />
          <Button type="primary" onClick={() => navigate('/login')}>登录</Button>
          <Button onClick={() => navigate('/register')}>注册</Button>
        </div>
      )}

      {/* 页头：标题 + 全页赛季选择 */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, margin: '2px 2px 4px' }}>
        <span style={{ fontSize: 21, fontWeight: 800 }}>🏀 联盟总览</span>
        <span style={{ flex: 1 }} />
        <SeasonPicker value={seasonNum} onChange={setSeasonNum} includeCareer={false} />
      </div>

      {/* ① 数据领跑 */}
      <SectionTitle title="数据领跑" extra="完整排行" onExtra={() => navigate('/rankings')} />
      <Row gutter={[14, 14]}>
        {(leaders || LEADER_STATS.map((stat) => ({ stat, rows: null }))).map(({ stat, rows }) => (
          <Col key={stat.field} flex="1 1 176px" style={{ minWidth: 176 }}>
            <LeaderCard stat={stat} rows={rows} seasonNum={seasonNum} />
          </Col>
        ))}
      </Row>

      {/* ② 联盟格局：东西部 15 队 + 荣誉/热帖右列 */}
      <SectionTitle title="联盟格局" />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}><StandingsCard conf="东部" rows={teams} accent="#2f54eb" /></Col>
        <Col xs={24} md={12} lg={8}><StandingsCard conf="西部" rows={teams} accent="#f5222d" /></Col>
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <HonorsCard awards={awards} poTeams={poTeams} />
            <HotList posts={hotPosts} />
          </div>
        </Col>
      </Row>
    </>
  )
}
