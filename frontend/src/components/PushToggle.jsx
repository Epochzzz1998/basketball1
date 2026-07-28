import { useCallback, useEffect, useState } from 'react'
import { Button, Space, Switch, Tooltip, Typography, message } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { pushApi } from '../api/push'

const { Text } = Typography

/** base64url 的 VAPID 公钥 → Uint8Array，pushManager.subscribe 只吃后者 */
const toBytes = (base64url) => {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** ArrayBuffer → base64url，后端存的就是这个格式 */
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * 手机推送开关。
 *
 * 整条链路：申请通知权限 → 向浏览器的推送服务登记（pushManager.subscribe）拿到
 * {endpoint, p256dh, auth} → 存到后端。之后后端有消息就用 p256dh 把内容加密好，
 * POST 到 endpoint，推送服务转发到设备，service worker 收下并弹出系统通知。
 *
 * 几个只有真机上才会遇到的事：
 *
 * - **iOS 必须先"添加到主屏幕"。** Safari 里直接开着这个页面是收不到推送的，
 *   iOS 16.4 起只对装到主屏的 web app 开放。所以检测到 iOS 且不在 standalone 模式时，
 *   直接告诉用户去装，而不是让他点了开关然后一直收不到。
 *
 * - **权限一旦被拒就没法再弹窗。** 浏览器只允许问一次，之后 requestPermission()
 *   直接返回 denied，不会有任何界面。所以这种情况要明说"去系统设置里改"。
 *
 * - **必须由用户点击触发。** 页面加载时自动申请会被浏览器直接拒掉。
 */
export default function PushToggle() {
  const [supported, setSupported] = useState(true)
  const [serverKey, setServerKey] = useState(null)   // null=还没问到，''=服务端没开
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  // iOS 的 standalone 标记只在 navigator 上，不是标准 API
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

  const load = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false)
      return
    }
    try {
      const key = await pushApi.publicKey()
      setServerKey(key || '')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setOn(!!sub)
    } catch {
      setServerKey('')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const enable = async () => {
    if (isIos && !standalone) {
      message.info('iPhone 上要先把网站「添加到主屏幕」，从桌面图标打开才能收推送')
      return
    }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      message.warning(perm === 'denied'
        ? '通知权限被拒绝了。浏览器不会再弹第二次，需要去系统/浏览器设置里手动打开'
        : '没有授予通知权限')
      return
    }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      // 必须 true：只允许"每条推送都弹给用户看"。静默推送浏览器一律不给
      userVisibleOnly: true,
      applicationServerKey: toBytes(serverKey),
    })
    const json = sub.toJSON()
    await pushApi.subscribe({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh || toB64(sub.getKey('p256dh')),
      auth: json.keys?.auth || toB64(sub.getKey('auth')),
    })
    setOn(true)
    message.success('已开启，试试下面的「发一条测试」')
  }

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      // 先告诉后端再退订：反过来的话 endpoint 就没了，后端那条永远删不掉，
      // 之后每次推送都往一个死地址发一遍
      await pushApi.unsubscribe(sub.endpoint)
      await sub.unsubscribe()
    }
    setOn(false)
    message.success('已关闭')
  }

  const toggle = async (next) => {
    setBusy(true)
    try {
      await (next ? enable() : disable())
    } catch (e) {
      message.error(e?.message || '操作失败')
    } finally {
      setBusy(false)
    }
  }

  if (!supported || serverKey === '') return null       // 浏览器不支持、或服务端没配密钥
  if (serverKey === null) return null                   // 还没问到，先不闪

  return (
    <Space size={8}>
      <Tooltip title={isIos && !standalone ? 'iPhone 需要先添加到主屏幕' : '有人@你、回复你、指派日程时，手机会收到通知'}>
        <Space size={6}>
          <BellOutlined style={{ color: on ? '#fa541c' : '#bbb' }} />
          <Text style={{ fontSize: 13, color: '#666' }}>手机推送</Text>
          <Switch size="small" checked={on} loading={busy} onChange={toggle} />
        </Space>
      </Tooltip>
      {/* 失败时后端返回 code=1，http 拦截器会把真实原因弹出来并 reject，
          所以这里只管成功那一支。n 是**送达成功的台数**，不是设备总数 */}
      {on && (
        <Button
          size="small"
          type="link"
          onClick={() => pushApi.test().then((n) => message.success(`已送达 ${n} 台设备`)).catch(() => {})}
        >
          发一条测试
        </Button>
      )}
    </Space>
  )
}
