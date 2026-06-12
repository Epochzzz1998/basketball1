import { Typography, Card } from 'antd'
import { useAuth } from '../auth/AuthContext'

const { Title, Paragraph } = Typography

export default function Home() {
  const { user } = useAuth()
  return (
    <Card>
      <Title level={3}>欢迎来到 Dream 篮球</Title>
      <Paragraph>
        {user ? `你好，${user.userNickname}（${user.userRole}）` : '游客模式：可浏览球员与资讯；登录后可使用更多功能。'}
      </Paragraph>
      <Paragraph type="secondary">
        本前端是 P5 React 重构的基建骨架：左侧菜单按角色显示，受保护页面需登录/对应角色。
        具体业务页面将在 P5-2 逐屏实现。
      </Paragraph>
    </Card>
  )
}
