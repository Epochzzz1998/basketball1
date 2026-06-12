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
  // 单个球员生涯逐季数据
  listPlayerCareer: (params) => http.get('/player/getPlayerSeasonStatsList', { params }),

  // ===== 写（superManager） =====
  savePlayers: (rows) => http.post('/player/savePlayer', new URLSearchParams({ data: JSON.stringify(rows) })),
  insertAndSavePlayers: (rows) => http.post('/player/insertAndSavePlayer', new URLSearchParams({ data: JSON.stringify(rows) })),
  savePlayerStats: (rows, playerId) => http.post('/player/savePlayerStats', new URLSearchParams({ data: JSON.stringify(rows), playerId })),
  insertAndSavePlayerStats: (rows, playerId) => http.post('/player/insertAndSavePlayerStats', new URLSearchParams({ data: JSON.stringify(rows), playerId })),
  deletePlayer: (playerId) => http.post('/player/deletePlayer', new URLSearchParams({ playerId })),
}
