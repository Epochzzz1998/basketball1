import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Input, Segmented, Spin, message } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'
import { useAuth } from '../../auth/AuthContext'
import {
  gameRatingApi, MAX_SCORE, MIN_SCORE, scoreColor, scoreWord,
} from '../../api/gameRating'
import TeamLogo, { HomeAwayTag, TeamNames } from '../../components/TeamLogo'
import { KIND_TAG, reasonText } from './absence'
import RatingComments from './RatingComments'

const BRAND = '#fa541c'

/**
 * 赛后评分：给这场比赛打分写短评，给场上每个人打分写短评。
 *
 * ## 为什么单独一个页签而不是接在 box score 下面
 *
 * 数据表是**横向**读的（一行一个人，一列一项统计），评分是**纵向**读的
 * （一个人一句话）。接在一起的话，滑到底才发现下面换了一种读法，
 * 而且看数据的人多半不想被评论打断。分成页签，各看各的。
 *
 * ## 比赛和球员用**同一套**呈现：平均分 + 分布
 *
 * 平均分回答「好不好」，分布回答「大家看法一不一致」，而后者常常才是重点——
 * 3 分可能是所有人都觉得平庸，也可能是一半人给 5 一半人给 1，
 * 那是两种完全不同的评价。两处都摆出来，读法就只有一种。
 *
 * ## 两队分页签
 *
 * 两队各十几个人竖着排，一页要滑很久，而人们通常只关心一边。
 * 页签上带队标：文字队名在两个中文队名之间要读一下才分得清，队标是一眼的事。
 *
 * ## 未出场的人也能打分，但排在最后并且标出来
 *
 * 「今天该上的人怎么没上」是赛后最常说的一句，没地方表达才是缺失。
 * 但他们和有数据的人不该混在一起排：一个是评表现，一个是评「这个安排」。
 */
export default function GameRating({ gameId, teams, isMobile, onPlayer }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(undefined)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [team, setTeam] = useState(teams[0]?.team)

  const load = () => {
    gameRatingApi.detail(gameId)
      .then((d) => {
        setData(d || null)
        setDraft(d?.mine?.commentTxt || '')
      })
      .catch(() => setData(null))
  }

  useEffect(() => {
    setData(undefined)
    load()
  }, [gameId])   // eslint-disable-line react-hooks/exhaustive-deps

  /** 没登录时不要让人白填一遍再被拒——点第一下就说清楚 */
  const requireLogin = () => {
    if (user) return true
    message.info('请先登录')
    navigate('/login')
    return false
  }

  const myScore = data?.mine?.score ?? null

  // 失败不用自己再弹一次：http 拦截器已经把后端那句更具体的话弹出来了
  const submitGame = (score, comment) => {
    if (!requireLogin()) return
    setSaving(true)
    gameRatingApi.rateGame(gameId, score, comment)
      .then(() => { message.success(score == null && !comment ? '已取消评分' : '已评分'); load() })
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  const submitPlayer = (playerId, score, comment) => {
    if (!requireLogin()) return
    return gameRatingApi.ratePlayer(gameId, playerId, score, comment)
      .then(load)
      .catch(() => {})
  }

  const submitReply = (targetId, content, replyToUser) => {
    if (!requireLogin()) return
    gameRatingApi.reply(gameId, targetId, content, replyToUser).then(load).catch(() => {})
  }

  const removeReply = (replyId) => {
    gameRatingApi.deleteReply(replyId).then(load).catch(() => {})
  }

  if (data === undefined) return <Spin style={{ display: 'block', margin: '60px auto' }} />
  if (data === null) return <Empty description="评分暂时打不开" />

  const g = data.game || {}
  const scored = Number(g.scored || 0)
  const active = teams.find((t) => t.team === team) || teams[0]

  return (
    <>
      <Card style={{ borderRadius: 14, marginBottom: 14 }} styles={{ body: { padding: isMobile ? 16 : 20 } }}>
        <ScorePanel avg={g.avgScore} n={scored} rows={data.histogram} big />

        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 14 }}>
          <div style={{ color: '#666', fontWeight: 700, marginBottom: 8 }}>
            我的评分
            {myScore != null && (
              <span style={{ color: '#ccc', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                再点一次当前分数可取消
              </span>
            )}
          </div>
          <ScoreDots
            value={myScore}
            size={isMobile ? 38 : 42}
            onPick={(s) => submitGame(s === myScore ? null : s, draft || null)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Input.TextArea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="说说这场比赛"
              maxLength={300}
              autoSize={{ minRows: 2, maxRows: 5 }}
              style={{ flex: 1, minWidth: 200, borderRadius: 10 }}
            />
            <Button
              type="primary"
              loading={saving}
              onClick={() => submitGame(myScore, draft || null)}
              style={{ background: BRAND, borderColor: BRAND, alignSelf: 'flex-end' }}
            >
              {data.mine ? '更新' : '发表'}
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title={`这场比赛的短评 (${(data.comments || []).length})`}
        style={{ borderRadius: 14, marginBottom: 14 }}
        styles={{ body: { padding: isMobile ? '4px 12px 12px' : '6px 18px 14px' } }}
      >
        <RatingComments
          comments={data.comments}
          replies={data.replies}
          meId={data.meId}
          onReply={submitReply}
          onDeleteReply={removeReply}
        />
      </Card>

      {/* 队标进页签：两个中文队名并排要读一下才分得清，队标是一眼的事 */}
      <Segmented
        block
        value={active?.team}
        onChange={setTeam}
        style={{ marginBottom: 12 }}
        options={teams.map((t) => ({
          value: t.team,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <TeamLogo code={t.team} size={20} />
              <TeamNames value={t.team} />
              <HomeAwayTag home={t.isHome} size={14} />
            </span>
          ),
        }))}
      />

      {active && (
        <PlayerRatings
          key={active.team}
          rows={active.rows}
          absent={active.absent}
          data={data}
          isMobile={isMobile}
          onPick={submitPlayer}
          onPlayer={onPlayer}
          onReply={submitReply}
          onDeleteReply={removeReply}
        />
      )}
    </>
  )
}

/**
 * 平均分 + 分布。比赛和球员共用，只有尺寸不同。
 *
 * 没人评过时平均分显示破折号而不是 0——0 分是一种评价，「还没人评」不是。
 */
function ScorePanel({ avg, n, rows, big }) {
  const has = Number(n || 0) > 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: big ? 20 : 14, flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center', minWidth: big ? 84 : 56 }}>
        <div style={{
          fontSize: big ? 44 : 22, fontWeight: 800, lineHeight: 1.15,
          color: has ? scoreColor(avg) : '#ddd',
        }}>
          {has ? avg : '—'}
        </div>
        <div style={{ color: '#999', fontSize: big ? 12 : 10, marginTop: big ? 4 : 2 }}>
          {has ? `${n} 人 · ${scoreWord(avg)}` : '还没人打分'}
        </div>
      </div>
      <ScoreBars rows={rows} total={n} big={big} />
    </div>
  )
}

/**
 * 分数分布。五档一档一根柱，每根按自己那档的颜色。
 *
 * 没人评过时整块不画——五根灰柱子和「还没人评」说的是同一件事，画出来只是占地方。
 *
 * ## 容器高度必须**算全**，不能只留柱子的高度
 *
 * 一列不止是柱子：上面（大号）还有人数、下面还有一行档位数字。
 * 早先容器只按柱高留了余量，最高那根一满格，整列就比容器高十来像素——
 * 而 `align-items: flex-end` 是**底部对齐**，超出的部分往上溢，
 * 于是柱子顶进了上面那行球员名字里。
 * 所以这里把三段高度显式加起来，宁可写得啰嗦也别让它靠巧合不重叠。
 */
const LABEL_H = 14        // 底下那行档位数字（10px 字 + 2px 间距）
const COUNT_H = 13        // 大号柱顶上的人数

function ScoreBars({ rows, total, big }) {
  if (!Number(total || 0)) return null
  const byScore = Object.fromEntries((rows || []).map((r) => [Number(r.score), Number(r.n)]))
  const max = Math.max(1, ...Object.values(byScore))
  const h = big ? 56 : 24
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: big ? 6 : 4,
      height: h + LABEL_H + (big ? COUNT_H : 0) + 2,
      flex: 1, minWidth: big ? 150 : 96, maxWidth: big ? 320 : 136,
    }}>
      {Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => {
        const s = MIN_SCORE + i
        const n = byScore[s] || 0
        return (
          <div key={s} style={{ flex: 1, textAlign: 'center' }} title={`${s} 分 · ${n} 人`}>
            {big && (
              <div style={{ color: n ? '#999' : '#eee', fontSize: 10, lineHeight: `${COUNT_H}px` }}>
                {n || ''}
              </div>
            )}
            <div style={{
              height: Math.round((n / max) * h) + (n ? 2 : 0),
              background: n ? scoreColor(s) : '#f5f5f5',
              borderRadius: 3, minHeight: 2,
            }} />
            <div style={{ color: '#ccc', fontSize: 10, lineHeight: '12px', marginTop: 2 }}>{s}</div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 一支球队的球员打分。
 *
 * 每行左边贴上那个人这场的关键数据——不摆出来的话打分变成凭印象，
 * 而这一页存在的前提就是「刚看完这场比赛」。
 *
 * 短评区默认**收起**：一支球队十几个人，每人都展开一段评论区的话，
 * 想找某个人得滑过所有人的讨论。收起之后这一页仍然是一张可扫的名单。
 */
function PlayerRatings({ rows, absent, data, isMobile, onPick, onPlayer, onReply, onDeleteReply }) {
  // 出场的在前、未出场的在后。合成一个数组而不是渲染两段，是为了让「行长什么样」
  // 只有一份实现——两段各写一遍，改一次样式就会有一段忘了改
  const all = [
    ...rows.map((r) => ({ ...r, absent: null })),
    ...(absent || []).map((r) => ({ ...r, absent: r.kind || 'INACTIVE' })),
  ]
  return (
    <Card
      style={{ borderRadius: 14, marginBottom: 14 }}
      styles={{ body: { padding: isMobile ? '4px 10px' : '6px 18px' } }}
    >
      {all.map((r) => (
        <PlayerRow
          key={r.playerId}
          r={r}
          agg={(data.players || {})[r.playerId]}
          hist={(data.playerHist || {})[r.playerId]}
          comments={(data.playerComments || {})[r.playerId]}
          replies={data.replies}
          mine={(data.minePlayers || {})[r.playerId]}
          meId={data.meId}
          isMobile={isMobile}
          onPick={onPick}
          onPlayer={onPlayer}
          onReply={onReply}
          onDeleteReply={onDeleteReply}
        />
      ))}
    </Card>
  )
}

function PlayerRow({
  r, agg, hist, comments, replies, mine, meId, isMobile, onPick, onPlayer, onReply, onDeleteReply,
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(mine?.commentTxt || '')
  const myScore = mine?.score ?? null
  const n = (comments || []).length

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <a
          onClick={() => onPlayer?.(r.playerId)}
          style={{ color: r.absent ? '#999' : '#222', fontWeight: 600 }}
        >
          {r.playerName || r.nameEn || '-'}
        </a>
        {!r.absent && Number(r.starter) === 1 && (
          <span style={{ color: '#bbb', fontSize: 11, border: '1px solid #eee', borderRadius: 4, padding: '0 4px' }}>
            首发
          </span>
        )}
        {r.absent ? (
          <span style={{ color: '#bbb', fontSize: 12 }}>
            {KIND_TAG[r.absent] || '未出场'}
            {r.absent === 'DNP' && reasonText(r.reason) && reasonText(r.reason) !== '未上场'
              && ` · ${reasonText(r.reason)}`}
          </span>
        ) : (
          <span style={{ color: '#999', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {r.pts} 分 {r.reb} 板 {r.ast} 助 · {r.playingTime} 分钟
          </span>
        )}
      </div>

      {/* 平均分 + 分布，和上面比赛那块同一套读法，只是小一号。
          上下都留出空当：柱子是这一行里唯一有高度的东西，贴着上一行的名字看着像溢出来的 */}
      <div style={{ margin: '10px 0 12px' }}>
        <ScorePanel avg={agg?.avgScore} n={agg?.n} rows={hist} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ScoreDots
          value={myScore}
          size={isMobile ? 30 : 32}
          onPick={(s) => onPick(r.playerId, s === myScore ? 0 : s, draft || null)}
        />
        <a
          onClick={() => setOpen((v) => !v)}
          style={{ color: n ? '#666' : '#bbb', fontSize: 12, marginLeft: 'auto' }}
        >
          {open ? <DownOutlined /> : <RightOutlined />} 短评{n ? ` (${n})` : ''}
        </a>
      </div>

      {open && (
        <div style={{ marginTop: 8, background: '#fafafa', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Input.TextArea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`说说${r.playerName || r.nameEn || '他'}这场`}
              maxLength={300}
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ flex: 1, minWidth: 160, borderRadius: 8 }}
            />
            <Button
              size="small"
              type="primary"
              // 只写短评不打分也行：分传 0，后端只有分和短评都空时才删掉这一行
              onClick={() => onPick(r.playerId, myScore ?? 0, draft.trim() || null)}
              style={{ background: BRAND, borderColor: BRAND, alignSelf: 'flex-end' }}
            >
              {mine?.commentTxt ? '更新' : '发表'}
            </Button>
          </div>
          <div style={{ marginTop: 4 }}>
            <RatingComments
              comments={comments}
              replies={replies}
              meId={meId}
              onReply={onReply}
              onDeleteReply={onDeleteReply}
              emptyText="还没有人评价他这场"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 1..5 的打分格。
 *
 * 一格一档、一点就中——不用滑块是因为滑块在手机上很难精确停在某一档，
 * 不用五星是因为半星的可点区域只有一格的一半宽。
 */
function ScoreDots({ value, size, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => {
        const s = MIN_SCORE + i
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            style={{
              width: size, height: size, lineHeight: `${size - 2}px`, padding: 0,
              borderRadius: 9, cursor: 'pointer', fontSize: size > 34 ? 17 : 14,
              fontWeight: on ? 800 : 500,
              // 选中的那一格用它自己那档的颜色，而不是统一的主题色——
              // 这样「我给了 2 分」和「我给了 5 分」隔着屏幕就能分辨
              border: `1px solid ${on ? scoreColor(s) : '#eee'}`,
              background: on ? scoreColor(s) : '#fafafa',
              color: on ? '#fff' : '#999',
              transition: 'none',
            }}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}
