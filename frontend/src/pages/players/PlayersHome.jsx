import { useEffect, useState } from 'react'
import { Card, Col, Row, Spin, Tabs } from 'antd'
import { useNavigate } from 'react-router-dom'
import AllPlayerSeasonStats from './AllPlayerSeasonStats'
import { playerApi } from '../../api/player'
import { NBA_TEAM_NAMES } from './rankConfig'

/**
 * 球队卡片墙：NBA 30 队全量展示。有球员数据的队正常高亮（队码来自 /player/teams 去重），
 * 暂无数据的队置灰标注，但都可点进本队页。
 */
function TeamGrid() {
  const [activeTeams, setActiveTeams] = useState(null) // 数据中实际出现过的队码
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    playerApi.listTeams()
      .then((t) => { if (alive) setActiveTeams(new Set(t || [])) })
      .catch(() => { if (alive) setActiveTeams(new Set()) })
    return () => { alive = false }
  }, [])

  if (activeTeams === null) return <Spin style={{ display: 'block', margin: '40px auto' }} />

  return (
    <Row gutter={[16, 16]}>
      {Object.entries(NBA_TEAM_NAMES).map(([code, name]) => {
        const active = activeTeams.has(code)
        return (
          <Col key={code} xs={12} sm={8} md={6} lg={4}>
            <Card
              hoverable
              onClick={() => navigate(`/players/team/${code}`)}
              styles={{ body: { padding: 18, textAlign: 'center', opacity: active ? 1 : 0.55 } }}
            >
              <div
                style={{
                  width: 56, height: 56, margin: '0 auto 10px', borderRadius: '50%',
                  background: active ? 'rgba(250,84,28,.1)' : '#f0f0f0',
                  color: active ? '#fa541c' : '#999', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18,
                }}
              >
                {code}
              </div>
              <div style={{ fontWeight: 600 }}>{name}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                {active ? '查看本队球员' : '暂无球员数据'}
              </div>
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}

/** 球员数据首页：Tabs = 数据总览（原赛季榜） + 球队卡片墙 */
export default function PlayersHome() {
  return (
    <Tabs
      defaultActiveKey="overview"
      items={[
        { key: 'overview', label: '数据总览', children: <AllPlayerSeasonStats /> },
        { key: 'teams', label: '球队', children: <TeamGrid /> },
      ]}
    />
  )
}
