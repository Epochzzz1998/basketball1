import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { IdcardOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import AuthShell from '../components/AuthShell'

/**
 * 注册页（公开）。字段与后端一致：loginName（固定登录名）/ userNickname（显示昵称）/ password。
 * 后端对登录名和昵称各自查重，重复会被拒。注册不需要验证码。
 */
export default function Register() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = async (values) => {
    setSubmitting(true)
    try {
      // 只把后端需要的字段传过去（confirm 仅前端用）
      await authApi.register({
        loginName: values.loginName,
        userNickname: values.userNickname,
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

  const iconStyle = { color: '#b3b3b3' }

  return (
    <AuthShell title="创建账号" subtitle="注册加入百家说，一起发帖聊天">
      <Form onFinish={onFinish} size="large">
        <Form.Item name="loginName" rules={[{ required: true, message: '请输入登录名' }]}>
          <Input variant="filled" prefix={<UserOutlined style={iconStyle} />} placeholder="登录名（用于登录，注册后不可改）" autoComplete="off" />
        </Form.Item>
        <Form.Item name="userNickname" rules={[{ required: true, message: '请输入昵称' }]}>
          <Input variant="filled" prefix={<IdcardOutlined style={iconStyle} />} placeholder="昵称（对外展示，之后可改）" autoComplete="off" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password variant="filled" prefix={<LockOutlined style={iconStyle} />} placeholder="密码" autoComplete="off" />
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
          <Input.Password variant="filled" prefix={<LockOutlined style={iconStyle} />} placeholder="确认密码" autoComplete="off" />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitting}
          style={{ fontWeight: 700, boxShadow: '0 6px 16px rgba(250,84,28,.3)' }}
        >
          注 册
        </Button>
        <div style={{ marginTop: 20, textAlign: 'center', color: '#8c8c8c' }}>
          已有账号？<Link to="/login" style={{ fontWeight: 600 }}>去登录</Link>
        </div>
      </Form>
    </AuthShell>
  )
}
