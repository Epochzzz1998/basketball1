import { PushNotifications } from '@capacitor/push-notifications'
import { pushApi } from '../api/push'
import { isNative } from '../config/origin'

/**
 * 套壳 App 的推送（FCM）。网页端不走这里——那边是 Web Push（见 components/PushToggle.jsx）。
 *
 * ## 两条路为什么不能合成一条
 *
 * | | Web Push（网页 / 装到主屏的 PWA） | FCM（套壳 App） |
 * |---|---|---|
 * | 谁在收 | service worker | 系统的推送服务 |
 * | 凭据 | endpoint + 两把加密密钥 | 一个注册令牌 |
 * | 文案谁算 | service worker 现算 | **服务端算好**（App 关着时来不及跑 JS） |
 *
 * 底层完全不同，所以后端也是两张表、两个接口。共用的是**上面那一层**——
 * 哪些事件值得推、点开跳哪，那份规则只有一份（后端 `WebPushSender.PUSHABLE`）。
 *
 * ## 时序：为什么注册要等登录之后
 *
 * 令牌是"这台设备"的，而后端存的是"这个人的这台设备"。没登录就拿到令牌也不知道记给谁。
 * 所以 `AppLayout` 在登录态确立之后才调 `setupNativePush()`，登出时调 `teardownNativePush()`。
 *
 * ## 权限
 *
 * 安卓 13 起通知也要运行时授权（`POST_NOTIFICATIONS`）。`requestPermissions()`
 * 会弹系统对话框；用户拒绝了就什么都不做——**不重复弹**，安卓和 iOS 都只给一次机会，
 * 之后只能去系统设置里开。
 */

/** 最近一次拿到的令牌。登出时要拿它去后端注销，所以得留着 */
let currentToken = null
let wired = false

/**
 * 开启原生推送。幂等——重复调只会重新注册一次监听。
 * 非套壳环境直接返回，网页端不会误触发。
 */
export async function setupNativePush() {
  if (!isNative) return

  try {
    // 已经授权就不再问；`prompt` 才弹窗。用户点过拒绝之后系统不会再弹，
    // 这里也就不该反复试——那只会白白拖慢启动
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return

    if (!wired) {
      wired = true

      // 拿到 FCM 令牌。**这个事件可能在 App 生命周期里再次触发**——
      // Google 会主动轮换令牌，所以不能只在第一次登记
      PushNotifications.addListener('registration', async ({ value }) => {
        currentToken = value
        try {
          await pushApi.registerDevice(value, 'android')
        } catch {
          // 后端登记失败不弹错：用户没做任何操作，弹出来只会莫名其妙。
          // 下次启动会再登记一次
        }
      })

      PushNotifications.addListener('registrationError', (err) => {
        // 常见原因是 google-services.json 没打进包，或者包名对不上
        console.warn('[push] FCM 注册失败', err)
      })

      /**
       * 点开一条通知。载荷里的 `data.url` 是后端算好的站内路径
       * （规则见后端 NotificationText.linkOf），这里直接跳过去。
       *
       * 用 hash 之外的整段路径，所以要走 history 而不是 location.href ——
       * 后者会让 WebView 整个重新加载一次，白屏一下还丢掉当前状态。
       */
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = notification?.data?.url
        if (!url) return
        window.history.pushState({}, '', url)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }

    await PushNotifications.register()
  } catch (e) {
    console.warn('[push] 原生推送初始化失败', e)
  }
}

/**
 * 登出时注销这台设备。
 *
 * **必须做**：不注销的话，下一个在这台手机上登录的人会收到上一个人的通知。
 * 先告诉后端再清本地变量——反过来的话令牌就没了，后端那条永远删不掉。
 */
export async function teardownNativePush() {
  if (!isNative || !currentToken) return
  try {
    await pushApi.unregisterDevice(currentToken)
  } catch {
    // 网络不好时删不掉，下次登录会覆盖同一个令牌（后端按 token 覆盖），不至于长期串味
  }
  currentToken = null
}
