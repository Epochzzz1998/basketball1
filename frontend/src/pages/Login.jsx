import { useEffect, useRef, useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../api/auth'
import AuthShell from '../components/AuthShell'
import useAuthWide from '../hooks/useAuthWide'

/**
 * 登录页。表单字段名与后端一致：loginName（固定登录名）/ password / code（验证码）。
 * 验证码图片点击可刷新（后端一次性消费，失败后需换新的）。
 *
 * ## 验证码从「图片地址」改成「接口」（阶段 1 · Token 认证）
 *
 * 旧写法是 `<img src="/user/captcha?t=...">`：浏览器加载图片时，后端顺手把答案写进 session，
 * 登录时再从 session 里取出来比对。**两次请求靠 Cookie 串起来。**
 *
 * 套壳 App 没有 Cookie，这条链必然断。所以改成后端返回 `{captchaId, image}`，
 * 答案存 Redis，客户端把 captchaId 原样带回来——不依赖 Cookie，网页和 App 同一套。
 *
 * 副作用是这一页多了一次异步请求和它的三种状态（加载中 / 拿到了 / 失败了），
 * 下面 `loadCaptcha` 那几行就是在处理这个。
 */
export default function Login() {
  const { login } = useAuth()
  const wide = useAuthWide()
  const navigate = useNavigate()
  const location = useLocation()
  const [captcha, setCaptcha] = useState(null)   // {captchaId, image}
  const [submitting, setSubmitting] = useState(false)
  // captchaId 要在提交时读到最新值，而提交发生在事件回调里，用 ref 免得闭包读到旧的
  const idRef = useRef(null)

  const loadCaptcha = async () => {
    try {
      const d = await authApi.captcha()
      setCaptcha(d)
      idRef.current = d?.captchaId || null
    } catch {
      // 拦截器已经弹过错了。这里把图清空，点一下可以重试
      setCaptcha(null)
      idRef.current = null
    }
  }

  useEffect(() => { loadCaptcha() }, [])

  const onFinish = async (values) => {
    setSubmitting(true)
    try {
      await login({ ...values, captchaId: idRef.current })
      message.success('登录成功')
      navigate(location.state?.from || '/', { replace: true })
    } catch {
      // 具体错误已由 http 拦截器弹出；这里只需换一张验证码
      // （后端是一次性消费的，失败之后原来那张已经作废了）
      loadCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="欢迎回来">
      <Form onFinish={onFinish} size={wide ? 'large' : 'middle'}>
        <Form.Item name="loginName" rules={[{ required: true, message: '请输入登录名' }]}>
          <Input variant="filled" prefix={<UserOutlined style={{ color: '#b3b3b3' }} />} placeholder="登录名" autoComplete="off" />
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
            {/* 拿不到图时给一个可点的占位，而不是一个碎图标——加载失败也要能重试 */}
            <div
              onClick={loadCaptcha}
              title="点击刷新"
              style={{
                height: 44, width: 116, flexShrink: 0, cursor: 'pointer',
                borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fafafa', color: '#bbb', fontSize: 12,
              }}
            >
              {captcha?.image
                ? <img src={captcha.image} alt="验证码" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : '点击加载'}
            </div>
          </div>
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          size={wide ? 'large' : 'middle'}
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
