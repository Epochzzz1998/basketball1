import { Card, Typography } from 'antd'

/**
 * 登录/注册页共用外壳：柔光渐变全屏背景 + 居中圆角卡片 + 品牌头。
 * 只管观感，不碰表单逻辑——Login/Register 把自己的 Form 塞进 children 即可。
 */
export default function AuthShell({ subtitle, children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background:
          'radial-gradient(1100px 550px at 15% -10%, rgba(250,84,28,.16), transparent 60%),' +
          'radial-gradient(900px 500px at 110% 110%, rgba(250,140,22,.14), transparent 55%),' +
          '#f7f8fa',
      }}
    >
      <Card
        style={{ width: 400, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.08)', border: 'none' }}
        styles={{ body: { padding: '32px 32px 24px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 42, lineHeight: 1 }}>🏀</div>
          <Typography.Title level={3} style={{ margin: '10px 0 4px' }}>Dream 篮球</Typography.Title>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
        {children}
      </Card>
    </div>
  )
}
