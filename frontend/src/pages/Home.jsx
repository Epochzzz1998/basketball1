import { Button, Card, Col, Row, Space, Typography } from 'antd'
import {
  BellOutlined,
  DatabaseOutlined,
  EditOutlined,
  NotificationOutlined,
  ReadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Title, Paragraph } = Typography

/** 快捷入口卡片：图标圆底 + 标题 + 描述，整卡可点 */
function EntryCard({ icon, title, desc, onClick }) {
  return (
    <Card hoverable onClick={onClick} styles={{ body: { padding: 20 } }}>
      <Space align="start" size={16}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, color: '#fa541c', background: 'rgba(250,84,28,.1)',
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            {title} <RightOutlined style={{ fontSize: 11, color: '#bbb' }} />
          </div>
          <div style={{ color: '#8c8c8c' }}>{desc}</div>
        </div>
      </Space>
    </Card>
  )
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const entries = [
    { icon: <TeamOutlined />, title: '球员数据', desc: '赛季榜单 · 生涯数据 · 表头排序', to: '/players' },
    { icon: <NotificationOutlined />, title: '新闻', desc: '官方权威发布，人人可评', to: '/official' },
    { icon: <ReadOutlined />, title: '资讯论坛', desc: '看帖 · 发帖 · 评论 · 点赞', to: '/news' },
    ...(user ? [{ icon: <BellOutlined />, title: '我的消息', desc: '谁点赞/评论了你，一目了然', to: '/me' }] : []),
    ...(user?.isManagerOrOver ? [{ icon: <EditOutlined />, title: '资讯管理', desc: '增删改帖子（manager）', to: '/admin/news' }] : []),
    ...(user?.isSuperManager ? [{ icon: <DatabaseOutlined />, title: '球员管理', desc: '名册与生涯数据维护（superManager）', to: '/admin/players' }] : []),
  ]

  return (
    <>
      {/* Hero：品牌渐变横幅 */}
      <Card
        style={{ border: 'none', background: 'linear-gradient(120deg, #fa541c 0%, #fa8c16 100%)' }}
        styles={{ body: { padding: '36px 32px' } }}
      >
        <Title level={2} style={{ color: '#fff', margin: 0 }}>
          {user ? `你好，${user.userNickname} 👋` : '欢迎来到 Dream Unit 🏀'}
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,.88)', fontSize: 15, margin: '10px 0 22px' }}>
          球员数据 · 资讯论坛 · 互动社区{user ? '' : '（游客可浏览，登录后可发帖/评论/点赞）'}
        </Paragraph>
        <Space wrap>
          <Button size="large" onClick={() => navigate('/players')}>看球员数据</Button>
          <Button size="large" ghost onClick={() => navigate('/news')}>逛资讯论坛</Button>
          {!user && <Button size="large" ghost onClick={() => navigate('/login')}>登录 / 注册</Button>}
        </Space>
      </Card>

      {/* 快捷入口 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {entries.map((e) => (
          <Col key={e.to} xs={24} sm={12} lg={8}>
            <EntryCard icon={e.icon} title={e.title} desc={e.desc} onClick={() => navigate(e.to)} />
          </Col>
        ))}
      </Row>
    </>
  )
}
