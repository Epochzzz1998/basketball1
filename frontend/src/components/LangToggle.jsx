import { useTranslation } from 'react-i18next'
import { setLang } from '../i18n'

/**
 * 中 / EN 切换按钮，挂在顶栏刷新按钮旁边。
 *
 * 显示的是**要切过去的那个语言**，不是当前语言：中文界面上写「EN」，英文界面上写「中」。
 * 这是维基百科那类多语站的惯例——按钮说的是"点我去哪"，不是"你在哪"。
 *
 * 两个样子对应顶栏的两种形态（和旁边的刷新按钮保持一致）：
 *   · pill：桌面端，32px 圆胶囊，和刷新按钮同款
 *   · bare：移动端固定顶栏，裸文字，和那个裸的刷新图标同款
 */
export default function LangToggle({ variant = 'pill' }) {
  const { i18n } = useTranslation()
  const en = i18n.language === 'en'
  const label = en ? '中' : 'EN'
  const title = en ? '切换为中文' : 'Switch to English'
  const flip = () => setLang(en ? 'zh' : 'en')

  if (variant === 'bare') {
    return (
      <span
        onClick={flip}
        title={title}
        style={{
          fontSize: 14, fontWeight: 700, color: '#888', flexShrink: 0, cursor: 'pointer',
          lineHeight: 1, userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        }}
      >
        {label}
      </span>
    )
  }
  return (
    <span
      onClick={flip}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, flexShrink: 0, borderRadius: 16,
        border: '1px solid #e8e8e8', background: '#fff', color: '#aaa',
        cursor: 'pointer', fontSize: 12, fontWeight: 700, marginRight: 4, userSelect: 'none',
      }}
    >
      {label}
    </span>
  )
}
