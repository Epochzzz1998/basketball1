import { fmtNum as f } from './rankConfig'

/** 荣誉小字：进攻类=得分/篮板/助攻；防守类=抢断/盖帽/篮板 */
const offSub = (r) => `${f(r.playerAvgScore)}分 ${f(r.playerAvgReb)}板 ${f(r.playerAvgAss)}助`
const defSub = (r) => `${f(r.playerAvgSteal)}断 ${f(r.playerAvgBlock)}帽 ${f(r.playerAvgReb)}板`

const byMvp = (a, b) => a.mvpRank - b.mvpRank
const byDpoy = (a, b) => a.dpoyRank - b.dpoyRank

/**
 * 赛季荣誉分组：pick(rows) 取该组成员（已排序），sub(row) 出小字，rankOf(row) 出名次角标。
 * key 同时用于完整数据页路由 /rankings/honors/:key。
 */
export const HONOR_GROUPS = [
  { key: 'mvp', title: 'MVP 榜', note: '常规赛价值排名', span: 12,
    pick: (rows) => [...rows].sort(byMvp).slice(0, 10), sub: offSub, rankOf: (r) => r.mvpRank },
  { key: 'dpoy', title: 'DPOY 榜', note: '最佳防守球员排名', span: 12,
    pick: (rows) => [...rows].sort(byDpoy).slice(0, 10), sub: defSub, rankOf: (r) => r.dpoyRank },
  { key: 'all1', title: '最佳一阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDbaTeam === '一阵').sort(byMvp), sub: offSub, rankOf: (r) => r.mvpRank },
  { key: 'all2', title: '最佳二阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDbaTeam === '二阵').sort(byMvp), sub: offSub, rankOf: (r) => r.mvpRank },
  { key: 'all3', title: '最佳三阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDbaTeam === '三阵').sort(byMvp), sub: offSub, rankOf: (r) => r.mvpRank },
  { key: 'def1', title: '最佳防守一阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDefTeam === '一阵').sort(byDpoy), sub: defSub, rankOf: (r) => r.dpoyRank },
  { key: 'def2', title: '最佳防守二阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDefTeam === '二阵').sort(byDpoy), sub: defSub, rankOf: (r) => r.dpoyRank },
  { key: 'def3', title: '最佳防守三阵', span: 8,
    pick: (rows) => rows.filter((r) => r.allDefTeam === '三阵').sort(byDpoy), sub: defSub, rankOf: (r) => r.dpoyRank },
]
