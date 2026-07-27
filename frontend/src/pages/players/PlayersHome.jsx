import { useEffect, useState } from 'react'
import { Card, Col, ConfigProvider, Row, Segmented, Spin } from 'antd'
import { BarChartOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AllPlayerSeasonStats from './AllPlayerSeasonStats'
import { playerApi } from '../../api/player'
import { NBA_TEAM_NAMES } from './rankConfig'
import TeamLogo from '../../components/TeamLogo'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 球队卡片墙：NBA 30 队全量展示。有球员数据的队正常高亮（队码来自 /player/teams 去重），
 * 暂无数据的队置灰标注，但都可点进本队页。
 */
function TeamGrid() {
  const [activeTeams, setActiveTeams] = useState(null) // 数据中实际出现过的队码
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => {
    let alive = true
    playerApi.listTeams()
      .then((t) => { if (alive) setActiveTeams(new Set(t || [])) })
      .catch(() => { if (alive) setActiveTeams(new Set()) })
    return () => { alive = false }
  }, [])

  if (activeTeams === null) return <Spin style={{ display: 'block', margin: '40px auto' }} />

  return (
    <Row gutter={isMobile ? [8, 8] : [16, 16]}>
      {Object.entries(NBA_TEAM_NAMES).map(([code, name]) => {
        const active = activeTeams.has(code)
        return (
          <Col key={code} xs={8} sm={8} md={6} lg={4}>
            <Card
              hoverable
              onClick={() => navigate(`/players/team/${code}`)}
              styles={{ body: { padding: isMobile ? 8 : 18, textAlign: 'center', opacity: active ? 1 : 0.55 } }}
            >
              {/* 队标当门面；没有球员数据的赛季把标灰掉，仍可点进队页 */}
              <div style={{ height: isMobile ? 40 : 62, margin: isMobile ? '0 auto 6px' : '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TeamLogo code={code} size={isMobile ? 38 : 60} style={{ filter: active ? 'none' : 'grayscale(1)' }} />
              </div>
              {/* 一行三支队时卡片只有 110px 上下：队码另起一行，"查看本队球员"整句放不下 */}
              <div style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, lineHeight: 1.3 }}>
                {name}
                {!isMobile && <span style={{ color: '#bbb', fontSize: 12, fontWeight: 400, marginLeft: 6 }}>{code}</span>}
              </div>
              <div style={{ color: '#999', fontSize: isMobile ? 11 : 12, marginTop: 2 }}>
                {isMobile ? (active ? code : '暂无数据') : (active ? '查看本队球员' : '暂无球员数据')}
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
