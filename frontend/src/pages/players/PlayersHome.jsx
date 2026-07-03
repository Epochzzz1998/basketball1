import { useEffect, useState } from 'react'
import { Card, Col, ConfigProvider, Row, Segmented, Spin } from 'antd'
import { BarChartOutlined, TeamOutlined } from '@ant-design/icons'
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

/**
 * 数据概览首页：胶囊分段切换（比默认 Tabs 更现代）——
 * 球队卡片墙在前，球员数据概览（原赛季榜）在后；选中态为品牌橙圆角滑块。
 */
export default function PlayersHome() {
  const [tab, setTab] = useState('teams')

  return (
    <>
      <ConfigProvider
        theme={{
          token: { borderRadius: 22, borderRadiusSM: 18 },
          components: {
            Segmented: {
              itemSelectedBg: '#fa541c',
              itemSelectedColor: '#ffffff',
              trackBg: '#efefef',
              itemColor: '#666',
              itemHoverColor: '#fa541c',
              itemHoverBg: 'rgba(250,84,28,0.08)',
            },
          },
        }}
      >
        <Segmented
          size="large"
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 16, padding: 4, boxShadow: 'inset 0 1px 3px rgba(0,0,0,.04)' }}
          options={[
            {
              value: 'teams',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
                  <TeamOutlined /> 球队
                </span>
              ),
            },
            {
              value: 'overview',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
                  <BarChartOutlined /> 球员数据概览
                </span>
              ),
            },
          ]}
        />
      </ConfigProvider>
      {tab === 'teams' ? <TeamGrid /> : <AllPlayerSeasonStats />}
    </>
  )
}
