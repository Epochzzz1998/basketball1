import http from './http'

/**
 * 球员相关接口。读接口公开；写接口需 superManager（后端 @RequiresRole 兜底）。
 * 写接口沿用后端约定：把数组 JSON.stringify 后作为表单参数 `data` 传。
 */
export const playerApi = {
  // 球员名册（按赛季筛选）
  listPlayers: (params) => http.get('/player/getPlayerData', { params }),
  // 全体球员某赛季数据榜
  listSeasonStats: (params) => http.get('/player/getAllPlayersSeasonStatsList', { params }),
  // 全体球员某赛季季后赛数据榜（与常规赛榜同构）
  listPlayoffSeasonStats: (params) => http.get('/player/getAllPlayersPlayoffSeasonStatsList', { params }),
  // 单个球员生涯逐季数据
  listPlayerCareer: (params) => http.get('/player/getPlayerSeasonStatsList', { params }),
  // 单个球员季后赛逐季数据（含生涯汇总行 + 当季球队季后赛成绩）
  listPlayerPlayoffs: (playerId) => http.get('/player/getPlayerPlayoffStatsList', { params: { playerId } }),
  // 联盟现有球队代码（来自 player_stats 去重，转会 "A->B" 已拆分）
  listTeams: () => http.get('/player/teams'),
  // 球员生涯荣誉（MVP/DPOY/阵容/单项王/总冠军/FMVP/6MOY/MIP）
  playerHonors: (playerId) => http.get('/player/honors', { params: { playerId } }),
  // 某赛季特别奖得主（FMVP/最佳第六人/最快进步球员）
  seasonAwards: (seasonNum) => http.get('/player/seasonAwards', { params: { seasonNum } }),

  // ===== 写（superManager） =====
  // 新增行只在前端本地加（带 new- 临时 id），保存时把临时 id 清空交后端补 UUID，故不再用 insertAndSave* 接口。
  savePlayers: (rows) => http.post('/player/savePlayer', new URLSearchParams({ data: JSON.stringify(rows) })),
  savePlayerStats: (rows, playerId) => http.post('/player/savePlayerStats', new URLSearchParams({ data: JSON.stringify(rows), playerId })),
  deletePlayer: (playerId) => http.post('/player/deletePlayer', new URLSearchParams({ playerId })),
  deletePlayerStats: (statsId, playerId) => http.post('/player/deletePlayerStats', new URLSearchParams({ statsId, playerId })),
}
