// 头衔颜色板（20 色）。key 存进库，前端按 key→hex 渲染统一的浅色小标签。
// 前 11 个沿用 antd 预设色名（保证旧数据里的 purple 等仍认），后面是扩充色。与后端 setUserTitles 白名单一致。
export const TITLE_PALETTE = [
  'red', 'volcano', 'orange', 'gold', 'yellow', 'lime', 'green', 'teal', 'cyan', 'sky',
  'blue', 'geekblue', 'indigo', 'purple', 'magenta', 'pink', 'brown', 'slate', 'gray', 'crimson',
]

export const TITLE_HEX = {
  red: '#f5222d', volcano: '#fa541c', orange: '#fa8c16', gold: '#d48806', yellow: '#ca8a04',
  lime: '#7cb305', green: '#52c41a', teal: '#08979c', cyan: '#13c2c2', sky: '#0ea5e9',
  blue: '#1677ff', geekblue: '#2f54eb', indigo: '#4338ca', purple: '#722ed1', magenta: '#eb2f96',
  pink: '#e84393', brown: '#a0522d', slate: '#64748b', gray: '#6b7280', crimson: '#c41d43',
}

/** 解析头衔串 → [{t,c}]。新格式是 JSON 数组 [{"t","c"}]；兼容旧的逗号分隔纯文本（给默认色 blue）。未知颜色回落 blue。 */
export function parseTitles(raw) {
  if (!raw) return []
  try {
    const a = JSON.parse(raw)
    if (Array.isArray(a)) {
      return a.filter((x) => x && x.t).map((x) => ({ t: String(x.t), c: TITLE_HEX[x.c] ? x.c : 'blue' }))
    }
  } catch {
    /* 旧格式（逗号分隔）走下面 */
  }
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean).map((t) => ({ t, c: 'blue' }))
}
