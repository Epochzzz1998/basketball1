import { useState } from 'react'
import { Avatar, Button, Pagination, Popconfirm } from 'antd'
import { DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { scoreColor } from '../../api/gameRating'
import MentionTextArea from '../../components/MentionTextArea'
import { renderMentions } from '../../components/mentionText'

/**
 * 短评列表 + 回复。比赛短评和球员短评共用这一个。
 *
 * ## 为什么不直接用帖子那套 CommentSection
 *
 * 那个组件八百行，长在 `newsApi` 上：@提及、附件上传、点赞点踩、投票卡、打分卡、
 * 楼层号、锁帖状态。这里要的只是「一条短评 + 底下几句回复」，
 * 把那套搬过来意味着要给评分接口造出一整套它并不需要的概念。
 * 所以**照搬的是样子，不是代码**——头像在左、昵称加时间在上、回复缩进带竖线，
 * 看起来是一家人，实现各管各的。
 *
 * ## 分页在前端做
 *
 * 一场比赛的短评连回复也就几十条，整场评分数据本来就一次取回来了。
 * 为翻页再开一个接口，换来的是每翻一页闪一下白——而数据早就在手里。
 *
 * ## 回复只有两层
 *
 * 回复不能再被回复，想指名道姓就 `@`。无限层级在这种体量的讨论里只会
 * 缩成一条越来越窄的竖条，而想说的其实就是「我在回你」。
 */
const PAGE_SIZE = 5

const avatarColor = (name) => {
  let h = 0
  for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360
  return `hsl(${h}, 52%, 52%)`
}

function UserAvatar({ name, src, size }) {
  return src ? <Avatar size={size} src={src} style={{ flexShrink: 0 }} /> : (
    <Avatar size={size} style={{ flexShrink: 0, background: avatarColor(name), fontWeight: 700 }}>
      {String(name || '匿')[0].toUpperCase()}
    </Avatar>
  )
}

export default function RatingComments({
  comments, replies, meId, onReply, onDeleteReply, onDeleteComment, emptyText = '还没有人说话',
}) {
  const [page, setPage] = useState(1)
  // 哪一条的回复框开着，以及回复给谁。开一个而不是全开：
  // 全部展开的话每条短评下面都挂一个输入框，列表读起来全是空盒子
  const [replyAt, setReplyAt] = useState(null)   // {targetId, toUser, toName} | null
  const [draft, setDraft] = useState('')

  const list = comments || []
  if (!list.length) {
    return <div style={{ color: '#bbb', fontSize: 13, padding: '10px 0' }}>{emptyText}</div>
  }
  // 翻页之后条数变少（有人撤了短评）时，当前页可能已经越界，落回最后一页
  const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const cur = Math.min(page, maxPage)
  const shown = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)

  const openReply = (targetId, toUser, toName) => {
    setReplyAt({ targetId, toUser, toName })
    setDraft('')
  }

  const submit = () => {
    const text = draft.trim()
    if (!text || !replyAt) return
    onReply(replyAt.targetId, text, replyAt.toUser)
    setReplyAt(null)
    setDraft('')
  }

  return (
    <>
      {shown.map((c) => {
        const rs = (replies || {})[c.commentId] || []
        return (
          <div key={c.commentId} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
            <UserAvatar name={c.nickname} src={c.avatar} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nickname || '（未知）'}</span>
                {/* 作者当前的分。**现查不是快照**——分可以改，存快照的话
                    同一个人的两条短评会显示两个不同的分 */}
                {c.myScore != null && (
                  <span style={{ color: scoreColor(c.myScore), fontWeight: 800, fontSize: 14 }}>
                    {c.myScore} 分
                  </span>
                )}
                <span style={{ color: '#ccc', fontSize: 12, marginLeft: 'auto' }}>
                  {dayjs(c.createTime).format('M-D HH:mm')}
                </span>
              </div>
              <div style={{ fontSize: 14, marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {renderMentions(c.content, c.mentions)}
              </div>

              {/* 回复区，缩进 + 左边一条竖线，和帖子里的楼中楼一个样子 */}
              {rs.length > 0 && (
                <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid #f0f0f0' }}>
                  {rs.map((r) => (
                    <div key={r.replyId} style={{ display: 'flex', gap: 7, padding: '5px 0' }}>
                      <UserAvatar name={r.nickname} src={r.avatar} size={22} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{r.nickname || '（未知）'}</span>
                        {r.replyToName && (
                          <span style={{ color: '#999' }}>
                            {' '}回复{' '}
                            <span style={{ color: '#1677ff' }}>@{r.replyToName}</span>
                          </span>
                        )}
                        <span style={{ color: '#ccc', marginLeft: 6, fontSize: 11 }}>
                          {dayjs(r.createTime).format('M-D HH:mm')}
                        </span>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderMentions(r.content, r.mentions)}</div>
                        {/* 「我要做点什么」一律靠右、带图标，和帖子评论区同一套（见那边的说明） */}
                        <div style={{ marginTop: 2, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                          <a
                            onClick={() => openReply(c.commentId, r.userId, r.nickname)}
                            style={{ color: '#bbb', fontSize: 12 }}
                          >
                            <MessageOutlined /> 回复
                          </a>
                          {r.userId === meId && (
                            <Popconfirm title="删除这条回复？" okText="删除" okButtonProps={{ danger: true }}
                              onConfirm={() => onDeleteReply(r.replyId)}>
                              <a style={{ color: '#ff4d4f', fontSize: 12 }}><DeleteOutlined /> 删除</a>
                            </Popconfirm>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replyAt?.targetId === c.commentId ? (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <MentionTextArea
                    value={draft}
                    onChange={setDraft}
                    placeholder={replyAt.toName ? `回复 @${replyAt.toName}` : `回复 ${c.nickname || ''}`}
                    maxLength={300}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    autoFocus
                    style={{ minWidth: 160 }}
                  />
                  <Button size="small" type="primary" onClick={submit}>发送</Button>
                  <Button size="small" onClick={() => setReplyAt(null)}>取消</Button>
                </div>
              ) : (
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <a
                    onClick={() => openReply(c.commentId, null, null)}
                    style={{ color: '#bbb', fontSize: 12 }}
                  >
                    <MessageOutlined /> 回复{rs.length > 0 ? ` (${rs.length})` : ''}
                  </a>
                  {/* 只能删不能改：改会让别人已经回复过的话悄悄变成另一句，
                      删不会——回复跟着一起消失，不留答非所问的残句 */}
                  {c.userId === meId && (
                    <Popconfirm title="删除这条短评？底下的回复一并删除" okText="删除"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => onDeleteComment?.(c.commentId)}>
                      <a style={{ color: '#ff4d4f', fontSize: 12 }}><DeleteOutlined /> 删除</a>
                    </Popconfirm>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* 一页放不下才出分页器：只有三条短评时底下挂一个「1」的翻页条是噪音 */}
      {list.length > PAGE_SIZE && (
        <Pagination
          size="small"
          current={cur}
          pageSize={PAGE_SIZE}
          total={list.length}
          onChange={setPage}
          showSizeChanger={false}
          style={{ textAlign: 'center', marginTop: 10 }}
        />
      )}
    </>
  )
}
