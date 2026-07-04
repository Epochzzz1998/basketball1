import { ConfigProvider, Grid } from 'antd'

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
  const chip = {
    background: 'rgba(255,255,255,.16)', borderRadius: 999, padding: '6px 14px',
    fontSize: 12, fontWeight: 600, backdropFilter: 'blur(2px)', whiteSpace: 'nowrap',
  }
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

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>Dream Unit</div>
      <div style={{ width: 34, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.55)', marginTop: 10 }} />

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.45 }}>
        属于我们的
        <br />
        篮球宇宙
      </div>
      <div style={{ opacity: 0.85, marginTop: 12, fontSize: 14, lineHeight: 1.8 }}>
        16 个赛季 · 球员数据 · 荣誉殿堂
        <br />
        新闻资讯 · 论坛互动 · 球员认证
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
        <span style={chip}>数据总览</span>
        <span style={chip}>联盟排行</span>
        <span style={chip}>社区互动</span>
      </div>
    </div>
  )
}

export default function AuthShell({ title, subtitle, children }) {
  const screens = Grid.useBreakpoint()
  // 首帧 breakpoint 还没算出来（全 undefined），默认按宽屏渲染避免品牌面板闪现
  const wide = screens.md !== false
  return (
    <ConfigProvider theme={{ token: { controlHeight: 44, borderRadius: 10 } }}>
      <div
        style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(160deg, #fff6f1 0%, #f6f7f9 45%, #edf0f5 100%)',
        }}
      >
        <Backdrop />
        <div
          style={{
            display: 'flex', width: 'min(880px, 100%)', minHeight: 560, borderRadius: 20,
            overflow: 'hidden', boxShadow: '0 20px 60px rgba(120,50,20,.16)', background: '#fff',
            position: 'relative', zIndex: 1,
          }}
        >
          {wide && <BrandPanel />}
          <div
            style={{
              flex: 1, padding: wide ? '48px 52px' : '40px 28px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}
          >
            {!wide && <div style={{ fontSize: 20, fontWeight: 800, color: BRAND, marginBottom: 6 }}>Dream Unit</div>}
            <div style={{ fontSize: 24, fontWeight: 800 }}>{title}</div>
            <div style={{ color: '#8c8c8c', fontSize: 14, margin: '8px 0 30px' }}>{subtitle}</div>
            {children}
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
