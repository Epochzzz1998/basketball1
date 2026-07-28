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
  careerTotals: (playerId) => http.get('/player/careerTotals', { params: { playerId } }),
  allTimeBoard: (field, limit) => http.get('/player/allTimeBoard', { params: { field, limit } }),
  historyPlayer: (brId) => http.get('/player/historyPlayer', { params: { brId } }),
  awardHistory: (award) => http.get('/player/awardHistory', { params: { award } }),
  // 单个球员季后赛逐季数据（含生涯汇总行 + 当季球队季后赛成绩）
  listPlayerPlayoffs: (playerId) => http.get('/player/getPlayerPlayoffStatsList', { params: { playerId } }),
  // 联盟现有球队代码（来自 player_stats 去重，转会 "A->B" 已拆分）
  listTeams: () => http.get('/player/teams'),
  // 球员生涯荣誉（MVP/DPOY/阵容/单项王/总冠军/FMVP/6MOY/MIP）
  playerHonors: (playerId) => http.get('/player/honors', { params: { playerId } }),
  // 某赛季特别奖得主（FMVP/最佳第六人/最快进步球员）
  seasonAwards: (seasonNum) => http.get('/player/seasonAwards', { params: { seasonNum } }),
  // 某队某赛季单轮次阵容数据（1 首轮 / 2 半决赛 / 3 分区决赛 / 4 总决赛）
  playoffRoundStats: (params) => http.get('/player/playoffRoundStats', { params }),
  // 某队某赛季打过哪几轮（含对手与场次），没打过季后赛返回空数组
  teamPlayoffRounds: (seasonNum, teamCode) => http.get('/player/teamPlayoffRounds', { params: { seasonNum, teamCode } }),
  // 单个球员某赛季逐场数据（seasonType：2 常规赛 / 3 季后赛）
  playerGameLog: (params) => http.get('/player/playerGameLog', { params }),
  // 该球员有逐场数据的赛季，空数组说明还没回补到他
  playerGameLogSeasons: (playerId) => http.get('/player/playerGameLogSeasons', { params: { playerId } }),

  // ===== 每日赛场 =====
  // 某一天的全部比赛
  gamesByDate: (date) => http.get('/player/gamesByDate', { params: { date } }),
  // 有比赛的最后一天：逐场数据还在回补，"今天"多半没有比赛，页面默认落在这天
  latestGameDate: () => http.get('/player/latestGameDate'),
  // 某个月哪几天有比赛（yyyy-MM），日期选择器据此标记
  gameDates: (month) => http.get('/player/gameDates', { params: { month } }),
  // 单场详情：比赛信息 + 每节得分 + 两队球员 + 两队合计
  gameDetail: (gameId) => http.get('/player/gameDetail', { params: { gameId } }),

  // ===== 写（superManager） =====
  // 新增行只在前端本地加（带 new- 临时 id），保存时把临时 id 清空交后端补 UUID，故不再用 insertAndSave* 接口。
  savePlayers: (rows) => http.post('/player/savePlayer', new URLSearchParams({ data: JSON.stringify(rows) })),
  // 球员照片：一人一张，重传即覆盖（后端先清旧目录）；返回 { url }
  uploadPhoto: (file, playerId) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('playerId', playerId)
    return http.post('/player/uploadPhoto', fd)
  },
  deletePhoto: (playerId) => http.post('/player/deletePhoto', new URLSearchParams({ playerId })),
  savePlayerStats: (rows, playerId) => http.post('/player/savePlayerStats', new URLSearchParams({ data: JSON.stringify(rows), playerId })),
  deletePlayer: (playerId) => http.post('/player/deletePlayer', new URLSearchParams({ playerId })),
  deletePlayerStats: (statsId, playerId) => http.post('/player/deletePlayerStats', new URLSearchParams({ statsId, playerId })),
}
