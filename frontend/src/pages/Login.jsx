import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/auth'
import AuthShell from '../components/AuthShell'

/**
 * 登录页。表单字段名与后端一致：userNickname / password / code（验证码）。
 * 验证码图片点击可刷新（后端一次性消费，失败后需换新的）。
 */
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [captcha, setCaptcha] = useState(authApi.captchaUrl())
  const [submitting, setSubmitting] = useState(false)

  const refreshCaptcha = () => setCaptcha(authApi.captchaUrl())

  const onFinish = async (values) => {
    setSubmitting(true)
    try {
      await login(values)
      message.success('登录成功')
      navigate(location.state?.from || '/', { replace: true })
    } catch (e) {
      // 具体错误已由 http 拦截器弹出；这里只需刷新验证码
      refreshCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="欢迎回来" subtitle="登录后可发帖、评论、点赞，还能申请球员身份认证">
      <Form onFinish={onFinish} size="large">
        <Form.Item name="userNickname" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input variant="filled" prefix={<UserOutlined style={{ color: '#b3b3b3' }} />} placeholder="用户名" autoComplete="off" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password variant="filled" prefix={<LockOutlined style={{ color: '#b3b3b3' }} />} placeholder="密码" autoComplete="off" />
        </Form.Item>
        <Form.Item>
          <div style={{ display: 'flex', gap: 10 }}>
            <Form.Item name="code" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
              <Input
                variant="filled"
                prefix={<SafetyCertificateOutlined style={{ color: '#b3b3b3' }} />}
                placeholder="验证码"
                style={{ flex: 1 }}
              />
            </Form.Item>
            <img
              src={captcha}
              alt="验证码"
              style={{ height: 44, width: 116, objectFit: 'cover', cursor: 'pointer', borderRadius: 10, border: '1px solid #f0f0f0', flexShrink: 0 }}
              title="点击刷新"
              onClick={refreshCaptcha}
            />
          </div>
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitting}
          style={{ fontWeight: 700, boxShadow: '0 6px 16px rgba(250,84,28,.3)' }}
        >
          登 录
        </Button>
        <div style={{ marginTop: 20, textAlign: 'center', color: '#8c8c8c' }}>
          没有账号？<Link to="/register" style={{ fontWeight: 600 }}>去注册</Link>
        </div>
      </Form>
    </AuthShell>
  )
}
