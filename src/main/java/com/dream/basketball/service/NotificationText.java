package com.dream.basketball.service;

import com.dream.basketball.entity.UserInformation;
import org.apache.commons.lang3.StringUtils;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 一条站内消息「怎么念、点了去哪」——<b>服务端这一份</b>。
 *
 * <h2>⚠️ 这是第二份，另一份在 {@code frontend/src/utils/notification.js}</h2>
 *
 * 加一种消息类型时<b>两边都要改</b>。改了一边忘了另一边，症状是：
 * 网页通知念得对、安卓 App 的通知落到 default 分支说一句没头没脑的话（或者反过来）。
 *
 * <h2>为什么不得不有第二份</h2>
 *
 * Web Push 那条路刻意<b>只发原始字段</b>，文案由 service worker 现算，
 * 所以规则只有 JS 那一份（见 {@link WebPushSender#payloadOf}）。
 *
 * FCM 做不到这样。它有两种消息：
 *
 * <table border="1">
 *   <tr><th></th><th>data-only</th><th>带 notification 块</th></tr>
 *   <tr><td>App 在前台</td><td>能收到，可以自己渲染</td><td>能收到</td></tr>
 *   <tr><td><b>App 被切后台 / 已退出</b></td><td><b>什么都不弹</b></td><td>系统自动弹</td></tr>
 * </table>
 *
 * 而推送的全部意义就是"App 没开着的时候也能叫到你"，所以只能发带 notification 块的，
 * 而那个块里的标题正文<b>必须服务端就写好</b>。
 *
 * <p>取舍是清楚的：多一份要同步维护的规则，换 App 关着时通知能弹出来。
 * 代价的严重程度也清楚：万一漏同步，后果是某类通知的措辞变旧，不是功能坏掉。
 */
public final class NotificationText {

    /** 点赞/点踩帖子类 msgId=帖子 id；评论类（含评论里@）msgId=评论 id、msgIdSecond=帖子 id */
    private static final Set<String> COMMENT_TYPES = new HashSet<>(Arrays.asList(
            "goodComment", "badComment", "commentComment", "mentionComment"));
    /** 专题类 msgId=专题 id，点进去跳专题页 */
    private static final Set<String> TOPIC_TYPES = new HashSet<>(Arrays.asList(
            "topicApply", "topicApproved", "topicRejected", "mentionChat"));
    /** 日程类：remind 的 msgId=日期；assign 的 msgId=事件 id、msgIdSecond=日期 */
    private static final Set<String> SCHEDULE_TYPES = new HashSet<>(Arrays.asList(
            "scheduleAssign", "scheduleRemind", "scheduleOverdue", "scheduleExpiry"));

    private NotificationText() {
    }

    /** 富文本摘要剥成纯文本——通知栏里不能出现 HTML 标签 */
    public static String stripHtml(String s) {
        return s == null ? "" : s.replaceAll("<[^>]+>", "");
    }

    /**
     * 点开去哪。<b>路径必须和 App.jsx 的路由逐字对得上</b>——
     * JS 那边曾经写成 {@code /myMessages} 而真实路由是 {@code /me}，
     * 点开只会落到 404，而推送场景下没人会去看地址栏，光看现象只知道"点了没反应"。
     */
    public static String linkOf(UserInformation m) {
        String type = StringUtils.trimToEmpty(m.getMsgType());
        String infoId = m.getUserInformationId();
        if ("test".equals(type)) {
            return "/me";
        }
        if ("pm".equals(type)) {
            // 私信不走 user_information 表，msgId 里放的是**发信人 id**
            return "/messages?peerId=" + m.getMsgId();
        }
        if ("follow".equals(type)) {
            return "/users/" + m.getMsgId();
        }
        if (TOPIC_TYPES.contains(type)) {
            return "/news/topic/" + m.getMsgId() + "?userInformationId=" + infoId;
        }
        if (SCHEDULE_TYPES.contains(type)) {
            String date = "scheduleAssign".equals(type)
                    ? StringUtils.trimToEmpty(m.getMsgIdSecond()) : m.getMsgId();
            return "/schedule?date=" + date + "&userInformationId=" + infoId;
        }
        String newsId = COMMENT_TYPES.contains(type) ? m.getMsgIdSecond() : m.getMsgId();
        return "/news/" + newsId + "?userInformationId=" + infoId;
    }

    /**
     * 动作短语。
     *
     * <p>推送场景下拿不到帖子标题（载荷里没有），所以每一支都必须在<b>没有标题</b>时也说得通——
     * 这一点和 JS 那份是一样的，那边的 {@code t} 恒为空串。
     */
    public static String actionTextOf(UserInformation m) {
        String type = StringUtils.trimToEmpty(m.getMsgType());
        String content = StringUtils.trimToEmpty(m.getContent());
        String quoted = content.isEmpty() ? "" : "「" + stripHtml(content) + "」";
        switch (type) {
            case "goodNews":       return "点赞了您的帖子";
            case "badNews":        return "点踩了您的帖子";
            case "commentNews":    return "评论了您的帖子";
            case "goodComment":    return "点赞了您的评论";
            case "badComment":     return "点踩了您的评论";
            case "commentComment": return "回复了您的评论";
            case "mentionComment": return "在评论里@了您";
            case "mentionNews":    return "在帖子里@了您";
            case "mentionChat":    return "在" + (quoted.isEmpty() ? "专题" : quoted) + "的群聊里@了您";
            case "follow":         return "关注了你";
            case "topicApply":     return "申请加入你的专题" + quoted;
            case "topicApproved":  return "通过了你加入" + (quoted.isEmpty() ? "专题" : quoted) + "的申请";
            case "topicRejected":  return "驳回了你加入" + (quoted.isEmpty() ? "专题" : quoted) + "的申请";
            case "scheduleAssign": return "给你指派了一条日程";
            // 这三类的 operatorName 就是「日程提醒」，短语留空避免"日程提醒 日程提醒"
            case "scheduleRemind":
            case "scheduleOverdue":
            case "scheduleExpiry":  return "";
            case "pm":             return "给你发了一条私信";
            case "test":           return "推送已经通了";
            default:               return StringUtils.trimToEmpty(m.getContentMsg());
        }
    }

    /** 第二行明细：评论类给原文，点赞类给原帖摘要 */
    public static String detailOf(UserInformation m) {
        String type = StringUtils.trimToEmpty(m.getMsgType());
        String content = orPlaceholder(m.getContent());
        String contentMsg = orPlaceholder(m.getContentMsg());
        switch (type) {
            case "commentNews":    return "评论内容：" + contentMsg;
            case "commentComment": return "回复内容：" + contentMsg + " ｜ 您的评论：" + content;
            case "goodComment":
            case "badComment":     return "您的评论：" + content;
            case "mentionComment": return "评论内容：" + content;
            case "mentionNews":    return "帖子：" + content;
            case "mentionChat":    return "群聊消息：" + contentMsg;
            case "follow":         return "点击去 TA 的主页看看";
            case "topicApply":     return "点击进入专题，在成员管理里审批";
            case "topicApproved":  return "点击进入该专题";
            case "topicRejected":  return "专题：" + content;
            case "scheduleAssign": return "日程：" + content + " ｜ 点击查看当天日历";
            case "scheduleRemind": return content;
            case "scheduleOverdue": return "⚠️ " + content;
            case "scheduleExpiry":  return "⏳ " + content;
            case "pm":             return contentMsg;
            case "test":           return "收到这条就说明整条链路是通的";
            default:               return "原帖：" + content;   // goodNews / badNews
        }
    }

    /**
     * 标题放「谁 + 做了什么」，正文放细节——手机通知栏折叠时通常只显示标题那一行，
     * 所以最要紧的信息必须在标题里。
     */
    public static String titleOf(UserInformation m) {
        String who = StringUtils.isBlank(m.getOperatorName()) ? "有人" : m.getOperatorName();
        return (who + " " + actionTextOf(m)).trim();
    }

    public static String bodyOf(UserInformation m) {
        String s = stripHtml(detailOf(m));
        return s.length() > 120 ? s.substring(0, 120) : s;
    }

    private static String orPlaceholder(String v) {
        String s = stripHtml(v).trim();
        return s.isEmpty() ? "(无内容)" : s;
    }
}
