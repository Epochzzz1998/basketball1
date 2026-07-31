import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useAuth } from '../../auth/AuthContext'
import { gameRatingApi } from '../../api/gameRating'

/**
 * 一局开黑的打分与短评：整局一份，十个人各一份。
 *
 * ## 和每日赛场是同一套东西
 *
 * 接口、数据表、显示部件全部复用（`kind='lol'`，见 api/gameRating.js 的说明）。
 * 对这几张表来说 NBA 的 `nba-6606` 和 LoL 的 PUUID 没有区别——它们只按
 * `(GAME_ID, PLAYER_ID)` 键。
 *
 * ## 十个人都能评，包括路人和对面
 *
 * 站内成员只占一场里的一两个人，其余全是路人；而「这把辅助真该被开除」正是
 * 最想说的那句话。所以校验用的是**这一局原始数据里的十个 PUUID**，
 * 不是只存自己人的 `lol_match_player`（见后端 matchParticipants）。
 *
 * ## 状态提在这里，不在各自的组件里
 *
 * 整局那块在十人表**下面**，按人那块在每一行**展开里**，两处隔着一整张表。
 * 各自拉一次接口的话，给某个人打完分之后整局的平均分不会跟着变，
 * 而它们本来就是同一份数据。所以由详情页拉一次，两边共用。
 */
export default function useMatchRating(matchId) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(undefined)   // undefined=加载中 null=拉不到

  const load = useCallback(() => {
    if (!matchId) return
    gameRatingApi.detail(matchId, undefined, 'lol')
      .then((d) => setData(d || null))
      .catch(() => setData(null))
  }, [matchId])

  useEffect(() => {
    setData(undefined)
    load()
  }, [matchId, load])

  /** 没登录时别让人白填一遍再被拒——点第一下就说清楚 */
  const requireLogin = () => {
    message.info('登录后可以评分')
    navigate('/login')
    return false
  }

  const run = async (fn) => {
    if (!user) return requireLogin()
    try {
      await fn()
      load()
      return true
    } catch {
      return false
    }
  }

  return {
    data,
    user,
    matchId,
    rateGame: (s) => run(() => gameRatingApi.rateGame(matchId, s, 'lol')),
    ratePlayer: (puuid, s) => run(() => gameRatingApi.ratePlayer(matchId, puuid, s, 'lol')),
    comment: (puuid, text) => run(() => gameRatingApi.comment(matchId, puuid, text, 'lol')),
    reply: (targetId, text, toUser) => run(() => gameRatingApi.reply(matchId, targetId, text, toUser, 'lol')),
    delComment: (cid) => run(() => gameRatingApi.deleteComment(cid)),
    delReply: (rid) => run(() => gameRatingApi.deleteReply(rid)),
  }
}
