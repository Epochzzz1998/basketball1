import { Client } from '@stomp/stompjs'

/**
 * 私信 WebSocket（STOMP）客户端：整个应用只维护一条连接。
 * - AppLayout 跟随登录态调用 connect/disconnect（未登录后端会直接拒绝握手）；
 * - 服务端只推不收：订阅自己的 /user/queue/pm，事件 {type:'message'|'recall', data}
 *   统一转成 window CustomEvent('pm-event') 广播，顶栏角标和聊天页各取所需；
 * - 断线由 stompjs 自动重连（reconnectDelay），重连成功会自动重新订阅。
 */

let client = null

export function connectPmSocket() {
  if (client?.active) return
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  client = new Client({
    brokerURL: `${proto}://${window.location.host}/ws`,
    reconnectDelay: 5000,
    onConnect: () => {
      client.subscribe('/user/queue/pm', (frame) => {
        try {
          const payload = JSON.parse(frame.body)
          window.dispatchEvent(new CustomEvent('pm-event', { detail: payload }))
        } catch {
          // 非 JSON 帧忽略
        }
      })
    },
  })
  client.activate()
}

export function disconnectPmSocket() {
  if (client) {
    client.deactivate()
    client = null
  }
}
