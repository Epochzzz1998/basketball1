import http from './http'

/** 球队榜单（公开）：战绩/胜率/季后赛 + 全队场均数据合计，按赛季查询 */
export const teamApi = {
  rankings: (seasonNum) => http.get('/team/rankings', { params: { seasonNum } }),
}
