import { ConfigProvider } from 'antd'
import useAuthWide from '../hooks/useAuthWide'

/**
 * 登录/注册页共用外壳（P5 重设计 v2）：分栏式大卡片 + 球场元素背景
 * - 页面背景：柔光色斑 + 细点阵 + 球场弧线（角落大圆环），填满视野但不抢表单；
 * - 左：品牌面板（品牌橙深渐变 + 装饰圆环 + 纯文字标语/特性胶囊），窄屏自动隐藏；
 * - 右：白底表单区，标题/副标题 + children（Login/Register 塞自己的 Form）。
 * 内层 ConfigProvider 把控件加高到 44、圆角 10，让表单更"落地页"一点。
 */

const BRAND = '#fa541c'

/** 页面背景装饰：色斑 / 点阵 / 球场弧线圆环，全部 absolute，不参与布局 */
function Backdrop() {
  const blob = (size, color, pos) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    background: color, filter: 'blur(90px)', ...pos,
  })
  const ring = (size, borderColor, borderWidth, pos) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: `${borderWidth}px solid ${borderColor}`, ...pos,
  })
  return (
    <>
      {/* 柔光色斑 */}
      <div style={blob(460, 'rgba(250,84,28,.16)', { top: -140, left: -120 })} />
      <div style={blob(420, 'rgba(250,140,22,.14)', { bottom: -150, right: -100 })} />
      <div style={blob(300, 'rgba(47,84,235,.07)', { top: '30%', right: '12%' })} />
      {/* 细点阵 */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(20,30,50,.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* 球场弧线：左下"三分线"同心圆 + 右上"中圈" */}
      <div style={ring(680, 'rgba(250,84,28,.12)', 2, { left: -280, bottom: -300 })} />
      <div style={ring(520, 'rgba(250,84,28,.10)', 2, { left: -210, bottom: -230 })} />
      <div style={ring(380, 'rgba(250,84,28,.08)', 2, { left: -140, bottom: -160 })} />
      <div style={ring(300, 'rgba(250,84,28,.10)', 2, { top: -120, right: -90 })} />
      <div style={ring(210, 'rgba(20,30,50,.06)', 2, { top: -75, right: -35 })} />
    </>
  )
}

function BrandPanel() {
  const ring = (size, pos) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,.14)', ...pos,
  })
  return (
    <div
      style={{
        width: 380, flexShrink: 0, position: 'relative', overflow: 'hidden', color: '#fff',
        padding: '40px 36px', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(165deg, #fa541c 0%, #d4380d 55%, #871400 100%)',
      }}
    >
      <div style={ring(230, { top: -80, right: -70 })} />
      <div style={ring(140, { top: 90, right: -40 })} />
      <div style={ring(320, { bottom: -140, right: -120 })} />
      <div style={ring(200, { bottom: -90, left: -90 })} />

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>Epoch</div>
      <div style={{ width: 34, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.55)', marginTop: 10 }} />

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.4 }}>
        见你所见
        <br />
        想你所想
      </div>
    </div>
  )
}

export default function AuthShell({ title, subtitle, children }) {
  const wide = useAuthWide()
  return (
    <ConfigProvider
      theme={{
        // 窄屏把控件从 44 收到 40。原来两边都是 44，再叠上表单的 size="large"，
        // 一个输入框实际就是五十多像素高——四个字段排下来整页都是"一圈大出来"的观感。
        // 宽屏保持 44：那是落地页该有的分量，屏幕也撑得住
        token: { controlHeight: wide ? 44 : 40, borderRadius: 10 },
        // 字段间距同理收一档。24px 的行距在宽屏是呼吸感，在手机上就只是把
        // 「提交」按钮推到屏幕外
        components: { Form: { itemMarginBottom: wide ? 24 : 16 } },
      }}
    >
      <div
        style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: wide ? 16 : 12,
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(160deg, #fff6f1 0%, #f6f7f9 45%, #edf0f5 100%)',
        }}
      >
        <Backdrop />
        <div
          style={{
            display: 'flex', width: 'min(880px, 100%)',
            // 窄屏不给最小高度：560 是为了配左边那块品牌面板，而窄屏根本不显示它，
            // 留着只会让卡片下方空出一大片
            minHeight: wide ? 560 : undefined,
            borderRadius: wide ? 20 : 16,
            overflow: 'hidden',
            boxShadow: wide ? '0 20px 60px rgba(120,50,20,.16)' : '0 8px 28px rgba(120,50,20,.10)',
            background: '#fff',
            position: 'relative', zIndex: 1,
          }}
        >
          {wide && <BrandPanel />}
          <div
            style={{
              flex: 1, padding: wide ? '48px 52px' : '28px 22px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}
          >
            {!wide && <div style={{ fontSize: 17, fontWeight: 800, color: BRAND, marginBottom: 4 }}>Epoch</div>}
            <div style={{ fontSize: wide ? 24 : 20, fontWeight: 800, marginBottom: subtitle ? 0 : (wide ? 30 : 20) }}>
              {title}
            </div>
            {/* 没传副标题就整行不渲染，不然会留一条空档 */}
            {subtitle && (
              <div style={{ color: '#8c8c8c', fontSize: wide ? 14 : 13, margin: wide ? '8px 0 30px' : '5px 0 20px' }}>
                {subtitle}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
