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
  // 联盟现有球队代码（来自 player_stats 去重，转会 "A->B" 已拆分）
  listTeams: () => http.get('/player/teams'),

  // ===== 写（superManager） =====
  // 新增行只在前端本地加（带 new- 临时 id），保存时把临时 id 清空交后端补 UUID，故不再用 insertAndSave* 接口。
  savePlayers: (rows) => http.post('/player/savePlayer', new URLSearchParams({ data: JSON.stringify(rows) })),
  savePlayerStats: (rows, playerId) => http.post('/player/savePlayerStats', new URLSearchParams({ data: JSON.stringify(rows), playerId })),
  deletePlayer: (playerId) => http.post('/player/deletePlayer', new URLSearchParams({ playerId })),
  deletePlayerStats: (statsId, playerId) => http.post('/player/deletePlayerStats', new URLSearchParams({ statsId, playerId })),
}
