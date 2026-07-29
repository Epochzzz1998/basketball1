import { useGoBack } from './backNav'

/**
 * 全站统一的返回按钮。
 *
 * ## 为什么自己画箭头
 *
 * antd 的 `ArrowLeftOutlined` 是一支**实心长箭头**，在小尺寸下笔画粗细不匀，
 * 和 iOS/贴吧那种细笔画的「‹」完全不是一个气质。这里直接用一段 SVG 折线：
 * 两笔、圆角端点、粗细自己定，缩到 18px 也还是干净的。
 *
 * ## 两种外观
 *
 * - `plain`（默认）：浅灰圆底 + 深色箭头，用在普通页面的内容区左上角；
 * - `overlay`：半透明黑底 + 毛玻璃 + 白箭头，用在**专题背景图上**。
 *   背景图什么颜色都可能，纯白箭头压在浅色图上会糊，所以要带一层底；
 *   但底又不能太重，否则整块黑圆盖在人家的封面图上很难看——
 *   用户的原话是「样式可以稍微显眼点，不至于完全隐藏」，这个配比就是照着调的。
 *
 * 按下反馈（缩一下 + 底色变深）写在 index.css 的 `.back-btn:active`——
 * 内联样式表达不了伪类，而手机上没有 hover，按下那一刻是唯一的反馈时机。
 */

const SKIN = {
  plain: {
    background: '#f2f3f5',
    color: '#3d3d3d',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
  overlay: {
    // 毛玻璃 + 一圈淡白描边：图亮时靠暗底衬出箭头，图暗时靠描边勾出轮廓，两头都不会消失
    background: 'rgba(0,0,0,.34)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.3)',
    boxShadow: '0 2px 8px rgba(0,0,0,.18)',
    backdropFilter: 'saturate(160%) blur(8px)',
    WebkitBackdropFilter: 'saturate(160%) blur(8px)',
  },
}

/** 细笔画的「‹」。viewBox 用 24 见方，路径本身留了内边距，所以不用再额外缩放 */
function Chevron({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 5.5 8 12l6.5 6.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * @param variant  'plain' | 'overlay'
 * @param onClick  自定义动作；不传就走 useGoBack()
 * @param label    箭头右边的文字（桌面端的「返回」）；不传只有一个圆钮
 * @param size     圆钮直径，默认 32
 */
export default function BackButton({ variant = 'plain', onClick, label, size = 32, style }) {
  const goBack = useGoBack()
  const skin = SKIN[variant] || SKIN.plain
  return (
    <span
      role="button"
      aria-label="返回"
      onClick={onClick || goBack}
      className="back-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, borderRadius: '50%', boxSizing: 'border-box',
          transition: 'background .15s, transform .1s',
          ...skin,
        }}
      >
        {/* 箭头比圆钮小一圈才不显得胀；0.56 是照着 iOS 导航栏的比例来的 */}
        <Chevron size={Math.round(size * 0.56)} />
      </span>
      {label && <span style={{ fontSize: 13, color: variant === 'overlay' ? '#fff' : '#666' }}>{label}</span>}
    </span>
  )
}
