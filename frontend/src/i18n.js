import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

/**
 * 界面文案的中英切换。**中文原文就是 key。**
 *
 * 为什么不另起英文 key 名（`nba.rankings.title` 这种）：全站有一千六百多条文案，
 * 逐条起名本身就是一项工程，而且起完之后代码里只剩 `t('nba.rankings.title')`，
 * 读代码的人得去翻 JSON 才知道这一行显示什么。用原文当 key，代码照样一眼能读，
 * 中文也不需要资源文件——`t('薪资计算')` 在中文模式下就是原样返回。
 *
 * 由此推出三条：
 *   · 只维护一份 `locales/en.json`：`{ "薪资计算": "Wage Calculation" }`
 *   · **英文缺翻译时回落到中文**（fallbackLng 关掉，key 即中文），漏翻的地方在英文界面上
 *     会直接显示中文，肉眼就能找出来——比静默显示一个 key 名要好得多
 *   · keySeparator / nsSeparator 必须关：中文文案里常有「：」「.」「:」，
 *     不关的话 `t('时薪：$12.5')` 会被当成命名空间和路径切开
 *
 * 语言选择存 localStorage，刷新不丢；没存过默认中文。
 * dayjs 的 locale 这一步**故意没动**：现在的日期都是手写格式串（`M月D日`），
 * 那些格式串本身就是文案、走 t() 就能换；一旦把 dayjs 切成 zh-cn，
 * 中文模式下所有 `dddd`/`MMM` 也会跟着变，那是另一件事。
 */
export const LANG_KEY = 'lang'

const saved = (() => {
  try { return localStorage.getItem(LANG_KEY) } catch { return null }
})()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: {} }, // 空包：只为不让 i18next 报「zh 没有资源」
  },
  lng: saved === 'en' ? 'en' : 'zh',
  fallbackLng: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false }, // React 自己转义，这里再转会把 & 显示成 &amp;
  react: { useSuspense: false },          // 资源是打包进来的，不需要异步等待
  // 同步初始化。资源是内联的，没有任何要异步加载的东西；不写这一条的话 init 会推到下一个
  // tick，而 rankConfig 那类模块在被 import 的那一刻就会调 i18n.t（算表头字段列表），
  // 拿到的会是还没设好语言的实例。这些模块级调用的结果本身不显示，但没必要留一个时序坑。
  initImmediate: false,
})

/** 切换语言并记住。组件里用它，不要直接调 i18n.changeLanguage——会忘了存 */
export const setLang = (lang) => {
  const next = lang === 'en' ? 'en' : 'zh'
  try { localStorage.setItem(LANG_KEY, next) } catch { /* 隐私模式等：不存也能用 */ }
  return i18n.changeLanguage(next)
}

export default i18n
