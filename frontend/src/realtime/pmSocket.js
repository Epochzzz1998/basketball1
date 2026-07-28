import { Client } from '@stomp/stompjs'

/**
 * 全站唯一的一条 STOMP 连接，两种用途共用：
 *  - **私信**：订阅自己的 /user/queue/pm，事件 {type:'message'|'recall', data} 转成
 *    window CustomEvent('pm-event') 广播，顶栏角标和聊天页各取所需；
 *  - **专题群聊**：订阅 /room/{topicId}，消息直接回调给调用方（见 subscribeRoom）。
 *
 * 连接由 AppLayout 跟随登录态 connect/disconnect（未登录后端会直接拒绝握手）。
 * 服务端只推不收：写操作一律走 REST，客户端发的 SEND 帧会被后端拦截器丢弃。
 * 断线由 stompjs 自动重连，重连后这里把已登记的房间**重新订阅一遍**——
 * 少了这一步，手机切后台再回来就永远收不到消息了，而且是静默失败，最难查。
 */

let client = null
/** topicId -> { handler, sub }。sub 在断线后失效，重连时按 handler 重建 */
const rooms = new Map()

const roomDest = (topicId) => `/room/${topicId}`

function subscribeAll() {
  if (!client?.connected) return
  rooms.forEach((entry, topicId) => {
    entry.sub = client.subscribe(roomDest(topicId), (frame) => {
      try {
        entry.handler(JSON.parse(frame.body))
      } catch {
        // 非 JSON 帧忽略
      }
    })
  })
}

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
      subscribeAll() // 首次连上、以及每次自动重连之后，把房间补回来
    },
  })
  client.activate()
}

export function disconnectPmSocket() {
  rooms.clear()
  if (client) {
    client.deactivate()
    client = null
  }
}

/**
 * 订阅一个专题的群聊，返回退订函数。
 *
 * 面板可能比连接先挂载（进页面那一瞬 socket 还在握手），所以先把房间登记下来，
 * 连上之后由 onConnect 统一订阅。无权进的房间后端会把订阅帧丢掉，前端表现为收不到消息、
 * 不报错——能不能进由 /topic/get 返回的 canChat 决定，面板据此决定要不要显示入口。
 */
export function subscribeRoom(topicId, handler) {
  if (!topicId) return () => {}
  rooms.set(topicId, { handler, sub: null })
  if (client?.connected) {
    subscribeAll()
  }
  return () => {
    const entry = rooms.get(topicId)
    try {
      entry?.sub?.unsubscribe()
    } catch {
      // 连接已断时退订会抛，忽略
    }
    rooms.delete(topicId)
  }
}
