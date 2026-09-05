/**
 * 一条站内消息「怎么念、点了去哪」——消息页和 service worker **共用这一份**。
 *
 * 抽出来的原因：手机推送弹出来的那条通知，和「我的消息」列表里的那一行，说的必须是同一件事。
 * 各写一份的话，加一种消息类型时改了列表忘了推送，通知上就会冒出 default 分支的兜底文案，
 * 而且只有真机上才看得见。
 *
 * 这里**不能 import 任何 React/antd 的东西**：service worker 里没有 DOM，
 * 引进去构建能过、运行时直接炸。config/modules.js 是纯常量，可以引。
 */
import { LOL_TOPIC_ID } from '../config/modules'

// 点赞/点踩帖子类消息 msgId=帖子 id；评论类（含评论里@）msgId=评论 id、msgIdSecond=帖子 id
const COMMENT_TYPES = ['goodComment', 'badComment', 'commentComment', 'mentionComment']
// 专题类消息 msgId=专题 id，点进去跳专题页
const TOPIC_TYPES = ['topicApply', 'topicApproved', 'topicRejected', 'mentionChat']
// 日程类：remind 的 msgId=日期；assign 的 msgId=事件id、msgIdSecond=日期。点进日历对应那天（顺便标已读）
const SCHEDULE_TYPES = ['scheduleAssign', 'scheduleRemind', 'scheduleOverdue', 'scheduleExpiry']
// 每日赛场的短评/回复：被 @ 或被回复，msgId=比赛 id，点进去跳那场比赛（短评没有自己的页面）
const GAME_TYPES = ['mentionGame', 'replyGame']
// 开黑对局的短评/回复：同上，msgId=Riot 的 matchId。对局详情是战绩流里的一个浮层、
// 没有自己的路由，所以带 ?match= 进去让战绩流自己展开那一局
const LOL_TYPES = ['mentionLol', 'replyLol']

const newsIdOf = (m) => (COMMENT_TYPES.includes(m.msgType) ? m.msgIdSecond : m.msgId)

/** 富文本摘要剥成纯文本（通知里不能出现 HTML 标签） */
export const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '')

/**
 * 点击一条消息去哪：私信→会话，专题类→专题页，日程类→日历，关注→主页，其余→帖子详情。
 * 都带 userInformationId 顺便标已读。
 *
 * 路径必须和 App.jsx 里的路由**逐字对得上**。这里曾经写成 /myMessages，
 * 而真实路由是 /me，点开只会落到 404——推送场景下没人会去看地址栏，光看现象
 * 只知道"点了没反应"。
 */
export const linkOf = (m) =>
  m.msgType === 'test'
    ? '/me'
    : m.msgType === 'pm'
      // 私信不走 user_information 表，msgId 里放的是**发信人 id**，深链直接开那个会话
      ? `/messages?peerId=${m.msgId}`
      : m.msgType === 'follow'
      ? `/users/${m.msgId}` // follow 的 msgId=关注者 id → 跳其主页（已读由消息页统一处理）
      : TOPIC_TYPES.includes(m.msgType)
        ? `/news/topic/${m.msgId}?userInformationId=${m.userInformationId}`
        : SCHEDULE_TYPES.includes(m.msgType)
          ? `/schedule?date=${m.msgType === 'scheduleAssign' ? (m.msgIdSecond || '') : m.msgId}&userInformationId=${m.userInformationId}`
          : GAME_TYPES.includes(m.msgType)
            ? `/games/${m.msgId}?userInformationId=${m.userInformationId}`
          : LOL_TYPES.includes(m.msgType)
            ? `/news/topic/${LOL_TOPIC_ID}/lol/feed?match=${m.msgId}&userInformationId=${m.userInformationId}`
            : `/news/${newsIdOf(m)}?userInformationId=${m.userInformationId}`

/**
 * 动作短语。库里 commentNews/commentComment 的 contentMsg 存的是评论原文而不是短语，
 * 直接显示会变成「xxx "评论内容"」，很怪；这里统一按 msgType 映射，老消息也能正确显示。
 *
 * 帖子类：动作对象就是帖子 → 「xxx 点赞了您的帖子《标题》」；
 * 评论类：动作对象是评论、标题只是位置 → 「xxx 点赞了您在《标题》下的评论」（标题缺失=原帖已删，退回短句）。
 *
 * 推送场景下 newsTitle 是拿不到的（载荷里没有），所以每一支都要能在没有标题时说得通。
 */
/**
 * 翻译函数从外面传进来：消息页传 react-i18next 的 t；不传就是下面这个 plain——原样返回中文，
 * 只做 {{x}} 插值。**这里故意不 import i18n**：service worker 也用这个文件，把 i18next 打进 sw
 * 没意义（sw 读不到页面的 localStorage，不知道当前语言），所以系统推送永远是中文。
 */
const plain = (key, vars) => (vars ? key.replace(/\{\{(\w+)\}\}/g, (_, n) => (vars[n] ?? '')) : key)

export const actionTextOf = (m, tr = plain) => {
  const t = m.newsTitle ? tr('「{{title}}」', { title: m.newsTitle }) : ''
  switch (m.msgType) {
    case 'goodNews': return tr("点赞了您的帖子{{t}}", { t })
    case 'badNews': return tr("点踩了您的帖子{{t}}", { t })
    case 'commentNews': return tr("评论了您的帖子{{t}}", { t })
    case 'goodComment': return t ? tr("点赞了您在{{t}}下的评论", { t }) : tr("点赞了您的评论")
    case 'badComment': return t ? tr("点踩了您在{{t}}下的评论", { t }) : tr("点踩了您的评论")
    case 'commentComment': return t ? tr("回复了您在{{t}}下的评论", { t }) : tr("回复了您的评论")
    case 'mentionComment': return t ? tr("在{{t}}的评论里@了您", { t }) : tr("在评论里@了您")
    case 'mentionNews': return t ? tr("在帖子{{t}}里@了您", { t }) : tr("在帖子里@了您")
    case 'mentionChat': return tr("在{{v0}}的群聊里@了您", { v0: m.content ? tr('「{{title}}」', { title: m.content }) : tr('专题', { context: 'sentence' }) })
    case 'mentionGame': return tr("在赛后短评里@了您")
    case 'mentionLol': return tr("在开黑对局的短评里@了您")
    case 'replyGame': return tr("回复了您的赛后短评")
    case 'replyLol': return tr("回复了您在开黑对局里的短评")
    case 'follow': return tr("关注了你")
    case 'topicApply': return tr("申请加入你的专题{{v0}}", { v0: m.content ? tr('「{{title}}」', { title: m.content }) : '' })
    case 'topicApproved': return tr("通过了你加入{{v0}}的申请", { v0: m.content ? tr('「{{title}}」', { title: m.content }) : tr('专题', { context: 'sentence' }) })
    case 'topicRejected': return tr("驳回了你加入{{v0}}的申请", { v0: m.content ? tr('「{{title}}」', { title: m.content }) : tr('专题', { context: 'sentence' }) })
    case 'scheduleAssign': return tr("给你指派了一条日程")
    case 'scheduleRemind': return '' // operatorName 即「日程提醒」，短语留空避免重复
    case 'scheduleOverdue': return ''
    case 'scheduleExpiry': return ''
    case 'pm': return tr("给你发了一条私信")
    case 'test': return tr("推送已经通了")
    default: return m.contentMsg || ''
  }
}

/** 第二行明细：评论类展示评论/回复原文（存在 contentMsg 里），点赞类展示原帖/原评论摘要（存在 content 里） */
export const detailOf = (m, tr = plain) => {
  const s = (v) => stripHtml(v) || tr("(无内容)")
  switch (m.msgType) {
    case 'commentNews': return tr("评论内容：{{v0}}", { v0: s(m.contentMsg) })
    case 'commentComment': return tr("回复内容：{{v0}} ｜ 您的评论：{{v1}}", { v0: s(m.contentMsg), v1: s(m.content) })
    case 'goodComment':
    case 'badComment': return tr("您的评论：{{v0}}", { v0: s(m.content) })
    case 'mentionComment': return tr("评论内容：{{v0}}", { v0: s(m.content) })
    case 'mentionNews': return tr("帖子：{{v0}}", { v0: s(m.content) })
    // 群聊没有「原帖」这回事：content 存的是专题名（已进标题），明细给那条群聊原文
    case 'mentionChat': return tr("群聊消息：{{v0}}", { v0: s(m.contentMsg) })
    // 比赛信息点进去就看到了，消息里要展示的是那句话本身（content 存的就是它）
    case 'mentionGame': return tr("短评：{{v0}}", { v0: s(m.content) })
    case 'mentionLol': return tr("短评：{{v0}}", { v0: s(m.content) })
    // 回复类展示的是**对方那句回复**（content 存的就是它），点进去才看得到上下文
    case 'replyGame':
    case 'replyLol': return tr("回复：{{v0}}", { v0: s(m.content) })
    case 'follow': return tr("点击去 TA 的主页看看")
    case 'topicApply': return tr("点击进入专题，在成员管理里审批")
    case 'topicApproved': return tr("点击进入该专题")
    case 'topicRejected': return tr("专题：{{v0}}", { v0: s(m.content) })
    case 'scheduleAssign': return tr("日程：{{v0}} ｜ 点击查看当天日历", { v0: s(m.content) })
    case 'scheduleRemind': return s(m.content)
    case 'scheduleOverdue': return `⚠️ ${s(m.content)}`
    case 'scheduleExpiry': return `⏳ ${s(m.content)}`
    case 'pm': return s(m.contentMsg)
    case 'test': return tr("收到这条就说明整条链路是通的")
    default: return tr("原帖：{{v0}}", { v0: s(m.content) }) // goodNews / badNews
  }
}

/**
 * 一条消息渲染成系统通知的标题和正文。只有 service worker 用。
 *
 * 标题放「谁 + 做了什么」，正文放细节——手机的通知栏折叠时通常只显示标题那一行，
 * 所以最要紧的信息必须在标题里。
 */
export const toNotification = (m) => ({
  title: `${m.operatorName || '有人'} ${actionTextOf(m)}`.trim(),
  body: stripHtml(detailOf(m)).slice(0, 120),
  url: linkOf(m),
})
