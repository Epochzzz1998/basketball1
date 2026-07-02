import { Button } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import AllPlayerSeasonStats from './AllPlayerSeasonStats'

/** 某支球队的球员数据（/players/team/:teamCode）：复用赛季榜表格，锁定球队过滤 */
export default function TeamPlayers() {
  const { teamCode } = useParams()
  const navigate = useNavigate()
  return (
    <>
      <Button style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>← 返回</Button>
      <AllPlayerSeasonStats team={teamCode} />
    </>
  )
}
