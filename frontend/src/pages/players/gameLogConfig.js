import { useEffect, useState } from 'react'
import { playerApi } from '../../api/player'

/** player_game_stats.SEASON_TYPE 的取值，与后端一致 */
export const SEASON_TYPE = { REG: 2, PO: 3 }

/** 季后赛轮次编号 → 中文 */
export const ROUND_LABEL = { 1: '首轮', 2: '半决赛', 3: '分区决赛', 4: '总决赛' }

/**
 * 该球员有逐场数据的赛季，按类型分好：{ 2: [{seasonNum, games}], 3: [...] }，各自按赛季倒序。
 * 逐场数据是逐步回补的（先季后赛、常规赛在后），覆盖范围一律现查，不在前端写死；
 * 返回 null 表示还在加载中。
 */
export function useGameLogSeasons(playerId) {
  const [map, setMap] = useState(null)
  useEffect(() => {
    let alive = true
    setMap(null)
    playerApi
      .playerGameLogSeasons(playerId)
      .then((rs) => {
        if (!alive) return
        const out = { [SEASON_TYPE.REG]: [], [SEASON_TYPE.PO]: [] }
        for (const r of rs || []) {
          const t = Number(r.seasonType)
          if (out[t]) out[t].push({ seasonNum: Number(r.seasonNum), games: Number(r.games) })
        }
        for (const t of Object.keys(out)) out[t].sort((a, b) => b.seasonNum - a.seasonNum)
        setMap(out)
      })
      .catch(() => alive && setMap({ [SEASON_TYPE.REG]: [], [SEASON_TYPE.PO]: [] }))
    return () => { alive = false }
  }, [playerId])
  return map
}
