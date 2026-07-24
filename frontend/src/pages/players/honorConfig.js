import { fmtNum as f } from './rankConfig'

/** 荣誉小字：进攻类=得分/篮板/助攻；防守类=抢断/盖帽/篮板 */
const offSub = (r) => `${f(r.playerAvgScore)}分 ${f(r.playerAvgReb)}板 ${f(r.playerAvgAss)}助`
const defSub = (r) => `${f(r.playerAvgSteal)}断 ${f(r.playerAvgBlock)}帽 ${f(r.playerAvgReb)}板`

// 空名次垫底（数据源只给获奖者名次；手工补 2-10 名后自然按名次排）
const byMvp = (a, b) => (a.mvpRank ?? 999) - (b.mvpRank ?? 999)
const byDpoy = (a, b) => (a.dpoyRank ?? 999) - (b.dpoyRank ?? 999)

// 该季存在官方投票名次时只列名次内球员（并列共享名次）；一个名次都没有的
// 赛季回退为全员预览前 10——避免"8 个正主 + 2 个凑数行"的混排
const ranked = (rows, rankOf, by) => rows.filter((r) => rankOf(r) != null).sort(by)
const pickVoted = (rankOf, by, cap) => (rows) => {
  const rk = ranked(rows, rankOf, by)
  return rk.length ? (cap ? rk.slice(0, cap) : rk) : [...rows].sort(by).slice(0, 10)
}

/**
 * 赛季荣誉分组：pick(rows) 取该组成员（已排序），sub(row) 出小字，rankOf(row) 出名次角标；
 * MVP/DPOY 另有 pickFull（完整数据页不截前 10，得票并列一并展示）。
 * key 同时用于完整数据页路由 /rankings/honors/:key。
 */
export const HONOR_GROUPS = [
  { key: 'mvp', title: 'MVP 榜', note: '常规赛价值排名', span: 12,
    pick: pickVoted((r) => r.mvpRank, byMvp, 10), pickFull: pickVoted((r) => r.mvpRank, byMvp, 0),
    sub: offSub, rankOf: (r) => r.mvpRank },
  { key: 'dpoy', title: 'DPOY 榜', note: '最佳防守球员排名', span: 12,
    pick: pickVoted((r) => r.dpoyRank, byDpoy, 10), pickFull: pickVoted((r) => r.dpoyRank, byDpoy, 0),
    sub: defSub, rankOf: (r) => r.dpoyRank },
  // 入阵是"当选"不是"名次"——阵容卡不带名次角标（无 rankOf），只按投票名次排个顺
  { key: 'all1', title: '最佳一阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDbaTeam === '一阵').sort(byMvp), sub: offSub },
  { key: 'all2', title: '最佳二阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDbaTeam === '二阵').sort(byMvp), sub: offSub },
  { key: 'all3', title: '最佳三阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDbaTeam === '三阵').sort(byMvp), sub: offSub },
  // 现实中最佳防守阵容只评一/二阵，不存在三阵
  { key: 'def1', title: '最佳防守一阵', span: 12,
    pick: (rows) => rows.filter((r) => r.allDefTeam === '一阵').sort(byDpoy), sub: defSub },
  { key: 'def2', title: '最佳防守二阵', span: 12,
    pick: (rows) => rows.filter((r) => r.allDefTeam === '二阵').sort(byDpoy), sub: defSub },
]

// 生涯荣誉柜 / 赛季资料卡共用的荣誉元数据（gold=顶级荣誉金卡）
export const CAREER_AWARDS = [
  { key: 'champion', label: '总冠军', icon: '🏆', gold: true },
  { key: 'fmvp', label: '总决赛 FMVP', icon: '🏅', gold: true },
  { key: 'mvp', label: '常规赛 MVP', icon: '👑', gold: true },
  { key: 'dpoy', label: '最佳防守球员', icon: '🛡️', gold: true },
  { key: 'smoy', label: '最佳第六人', icon: '🪑' },
  { key: 'mip', label: '最快进步球员', icon: '📈' },
  { key: 'roy', label: '最佳新秀', icon: '🌱' },
  { key: 'scoring', label: '得分王', icon: '🔥' },
  { key: 'rebounds', label: '篮板王', icon: '💪' },
  { key: 'assists', label: '助攻王', icon: '🎯' },
  { key: 'steals', label: '抢断王', icon: '⚡' },
  { key: 'blocks', label: '盖帽王', icon: '🚫' },
  { key: 'all1', label: '最佳一阵', icon: '⭐' },
  { key: 'all2', label: '最佳二阵', icon: '✨' },
  { key: 'all3', label: '最佳三阵', icon: '🌟' },
  { key: 'def1', label: '防守一阵', icon: '🔒' },
  { key: 'def2', label: '防守二阵', icon: '🔐' },
]
