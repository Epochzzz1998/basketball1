import { useState } from 'react'
import { Card, Form, Input, Button, Space, message } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/auth'

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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title="登录 Dream 篮球" style={{ width: 360 }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="userNickname" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="off" />
          </Form.Item>
          <Form.Item label="验证码" required>
            <Space>
              <Form.Item name="code" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                <Input style={{ width: 150 }} placeholder="4 位数字" />
              </Form.Item>
              <img
                src={captcha}
                alt="验证码"
                style={{ height: 38, cursor: 'pointer', border: '1px solid #eee' }}
                title="点击刷新"
                onClick={refreshCaptcha}
              />
            </Space>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
