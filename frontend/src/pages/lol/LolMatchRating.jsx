import { useState } from 'react'
import { Button, Spin } from 'antd'
import { scoreColor } from '../../api/gameRating'
import { ScoreDots, ScorePanel } from '../games/ratingParts'
import MentionTextArea from '../../components/MentionTextArea'
import RatingComments from '../games/RatingComments'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * 一局开黑的打分与短评的三个显示块：整局、单人、行里那枚角标。
 * 数据由 {@link useMatchRating} 一次拉好传进来（为什么见那个文件的说明）。
 */

/** 打分 + 短评输入 + 短评列表。整局和单人共用这一块，只有标题和目标不同 */
function RatingBlock({ r, puuid, title, placeholder, big }) {
  const isMobile = useIsMobile()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const d = r.data
  if (!d) return null

  const forPlayer = !!puuid
  const agg = forPlayer ? (d.players || {})[puuid] : d.game
  const hist = forPlayer ? (d.playerHist || {})[puuid] : d.histogram
  const comments = forPlayer ? (d.playerComments || {})[puuid] : d.comments
  const mine = forPlayer ? (d.minePlayers || {})[puuid] : d.mine?.score
  const myScore = typeof mine === 'object' ? mine?.score ?? null : mine ?? null

  const send = async () => {
    const t = draft.trim()
    if (!t) return
    setSaving(true)
    const ok = await r.comment(puuid || '', t)
    setSaving(false)
    if (ok) setDraft('')
  }

  return (
    <div>
      {title && <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>}
      <ScorePanel avg={agg?.avgScore} n={agg?.scored ?? agg?.n} rows={hist} big={big} />
      <div style={{ marginTop: big ? 12 : 8 }}>
        <ScoreDots
          value={myScore}
          size={big ? (isMobile ? 38 : 42) : 30}
          // 再点一次已选中的那格 = 撤销（传 0），和每日赛场同一个手势
          onPick={(s) => (forPlayer ? r.ratePlayer(puuid, s === myScore ? 0 : s)
            : r.rateGame(s === myScore ? 0 : s))}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <MentionTextArea
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          maxLength={300}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ minWidth: 160 }}
        />
        {/* 「发布」不是「更新」：每次都是新的一条，上一条原样留着 */}
        <Button
          type="primary"
          size={big ? 'middle' : 'small'}
          loading={saving}
          disabled={!draft.trim()}
          onClick={send}
          style={{ alignSelf: 'flex-end' }}
        >
          发布
        </Button>
      </div>
      <div style={{ marginTop: 4 }}>
        <RatingComments
          comments={comments}
          replies={d.replies}
          meId={r.user?.userId}
          onReply={r.reply}
          onDeleteReply={r.delReply}
          onDeleteComment={r.delComment}
          emptyText="还没有人说话"
        />
      </div>
    </div>
  )
}

/** 整局的打分，挂在十人表下面 */
export default function LolMatchRating({ rating }) {
  if (rating.data === undefined) {
    return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
  }
  if (rating.data === null) return null
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
      <RatingBlock r={rating} title="这一局怎么样" placeholder="说说这一局，打 @ 提到别人" big />
    </div>
  )
}

/** 单个人的打分，挂在那一行展开里 */
export function PlayerRating({ rating, puuid, name }) {
  if (!rating.data) return null
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #eee' }}>
      <RatingBlock
        r={rating}
        puuid={puuid}
        title={`给 ${name || '他'} 打分`}
        placeholder={`说说${name || '他'}这一把`}
      />
    </div>
  )
}

/**
 * 行里那枚平均分角标。**不展开也看得见**——十行里谁被骂了谁被夸了，
 * 得一眼扫出来，不能逼人一行行点开。
 */
export function PlayerScoreBadge({ rating, puuid }) {
  const agg = (rating.data?.players || {})[puuid]
  const n = Number(agg?.scored ?? agg?.n ?? 0)
  if (!n) return <span style={{ color: '#ddd' }}>—</span>
  return (
    <span style={{ color: scoreColor(agg.avgScore), fontWeight: 700 }}>
      {agg.avgScore}
      <span style={{ color: '#bbb', fontWeight: 400, fontSize: 11, marginLeft: 3 }}>({n})</span>
    </span>
  )
}
