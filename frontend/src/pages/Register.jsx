import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { IdcardOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import AuthShell from '../components/AuthShell'

/**
 * 注册页（公开）。字段与后端一致：userNickname / userName / password。
 * 后端按昵称查重（P3-1），重复会被拒。注册不需要验证码。
 */
export default function Register() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = async (values) => {
    setSubmitting(true)
    try {
      // 只把后端需要的字段传过去（confirm 仅前端用）
      await authApi.register({
        userNickname: values.userNickname,
        userName: values.userName,
        password: values.password,
      })
      message.success('注册成功，请登录')
      navigate('/login')
    } catch (e) {
      // 错误已由 http 拦截器弹出
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell subtitle="注册一个账号，加入讨论">
      <Form onFinish={onFinish} size="large">
        <Form.Item name="userNickname" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input prefix={<UserOutlined />} placeholder="用户名（登录用）" autoComplete="off" />
        </Form.Item>
        <Form.Item name="userName" rules={[{ required: true, message: '请输入昵称' }]}>
          <Input prefix={<IdcardOutlined />} placeholder="昵称/姓名" autoComplete="off" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: '请再次输入密码' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('两次密码不一致')),
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="确认密码" autoComplete="off" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={submitting}>注册</Button>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          已有账号？<Link to="/login">去登录</Link>
        </div>
      </Form>
    </AuthShell>
  )
}
