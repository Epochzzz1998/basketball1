// 头衔颜色板（antd Tag 预设色）+ 对应 hex（画色板小圆点用）。与后端 setUserTitles 的白名单一致。
export const TITLE_PALETTE = ['red', 'volcano', 'orange', 'gold', 'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple', 'magenta']

export const TITLE_HEX = {
  red: '#f5222d', volcano: '#fa541c', orange: '#fa8c16', gold: '#faad14', lime: '#a0d911',
  green: '#52c41a', cyan: '#13c2c2', blue: '#1677ff', geekblue: '#2f54eb', purple: '#722ed1', magenta: '#eb2f96',
}

/** 解析头衔串 → [{t,c}]。新格式是 JSON 数组 [{"t","c"}]；兼容旧的逗号分隔纯文本（给默认色 blue）。 */
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
