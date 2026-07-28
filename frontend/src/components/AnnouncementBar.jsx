import { useEffect, useState } from 'react'
import { CloseOutlined, NotificationOutlined } from '@ant-design/icons'
import { announceApi } from '../api/announce'

/**
 * 全站滚动公告条。
 *
 * **关闭状态按版本记在 localStorage 里**：超管一改内容，接口返回的 version（= 修改时间戳）
 * 就变了，之前关过的人会重新看到。要是只记一个"关过了"的布尔值，新公告发出去等于没发。
 *
 * 存浏览器不存后端：公告对游客也要显示，做成按用户存就得先登录；而且这本来就是
 * 「这台设备上不想再看」级别的偏好，不值得为它加表和接口。
 */
const KEY = 'announce-dismissed'

const TONE = {
  info: { bg: '#fff7e6', border: '#ffe58f', color: '#ad6800' },
  warning: { bg: '#fff2e8', border: '#ffbb96', color: '#d4380d' },
  error: { bg: '#fff1f0', border: '#ffa39e', color: '#cf1322' },
}

export default function AnnouncementBar() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    announceApi.current()
      .then((r) => {
        if (!alive || !r?.content) return
        if (localStorage.getItem(KEY) === String(r.version)) return // 这一版已经关过了
        setData(r)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!data) return null

  const tone = TONE[data.level] || TONE.info
  // 字越多滚得越久，速度才稳定（大约每秒 6 个字），太短的也保证转一圈不会一闪而过
  const seconds = Math.max(12, Math.round(data.content.length / 6) + 8)

  const close = () => {
    localStorage.setItem(KEY, String(data.version))
    setData(null)
  }

  return (
    <>
      <style>{`
        @keyframes announce-roll { from { transform: translateX(100%) } to { transform: translateX(-100%) } }
        .announce-track { display: inline-block; white-space: nowrap; animation: announce-roll linear infinite; }
        /* 鼠标停上去暂停，长公告才读得完 */
        .announce-bar:hover .announce-track { animation-play-state: paused; }
      `}</style>
      <div
        className="announce-bar"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color,
          borderRadius: 10, padding: '7px 12px', marginBottom: 14, fontSize: 13,
        }}
      >
        <NotificationOutlined style={{ flexShrink: 0 }} />
        {/* 跑马灯：外层裁切，内层整段平移；overflow 必须在这一层，不然会把整页撑宽 */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span className="announce-track" style={{ animationDuration: `${seconds}s` }}>
            {data.content}
          </span>
        </div>
        <CloseOutlined
          onClick={close}
          title="不再显示这条公告"
          style={{ flexShrink: 0, cursor: 'pointer', opacity: 0.6 }}
        />
      </div>
    </>
  )
}
