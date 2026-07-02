import http from './http'

/** 球队榜单（公开）：战绩/胜率/季后赛 + 全队场均数据合计，按赛季查询 */
export const teamApi = {
  rankings: (seasonNum) => http.get('/team/rankings', { params: { seasonNum } }),
  // 某队队史：逐季 战绩/季后赛/全队场均
  history: (teamCode) => http.get('/team/history', { params: { teamCode } }),
  // 某赛季季后赛球队榜（季后赛全队场均，季后赛内排名用）
  playoffRankings: (seasonNum) => http.get('/team/playoffRankings', { params: { seasonNum } }),
  // 某队季后赛队史（只含进季后赛的赛季）
  playoffHistory: (teamCode) => http.get('/team/playoffHistory', { params: { teamCode } }),
}
