package com.dream.basketball.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.UserInformationDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserInformation;
import com.dream.basketball.mapper.UserInformationMapper;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.service.UserService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

import static com.dream.basketball.utils.Constants.*;

@Service
public class UserInformationServiceImpl extends ServiceImpl<UserInformationMapper, UserInformation> implements UserInformationService {

    @Autowired
    DreamNewsService dreamNewsService;

    @Autowired
    DreamNewsCommentService dreamNewsCommentService;

    @Autowired
    UserService userService;

    @Autowired
    com.dream.basketball.mapper.ForumTopicMapper forumTopicMapper;

    /** 消息落库后顺手推到手机（Web Push）。内部异步，不会拖慢这里的事务。 */
    @Autowired
    com.dream.basketball.service.WebPushSender webPushSender;

    /**
    * @Description: 发送消息
    * @param: [operatorId, operatorName, receiverId, msgType, msgId, commentContent]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/2/1
    * @time: 13:42
    */
    @Override
    public void saveUserInformation(String operatorId, String operatorName, String receiverId, String msgType, String msgId, String msgIdSecond, String msgIdThird, String level, String commentContent, String commentRelRelId){
        // 自己对自己内容的操作不产生提示（给自己帖子点赞/评论自己的帖子等）；无接收者的也跳过。
        // 这里是全站消息的唯一入口，一处拦截各调用方（点赞 MQ 消费者/评论/@/关注/专题）全部生效。
        if (StringUtils.isBlank(receiverId) || StringUtils.equals(operatorId, receiverId)) {
            return;
        }
        UserInformation userInformation = getMsgContentInit(msgType, msgId, commentContent);
        userInformation.setUserInformationId(UUID.randomUUID().toString());
        userInformation.setMsgType(msgType);
        userInformation.setMsgId(msgId);
        userInformation.setMsgIdSecond(msgIdSecond);
        userInformation.setOperatorId(operatorId);
        userInformation.setOperatorName(operatorName);
        userInformation.setReceiverId(receiverId);
        userInformation.setReceiverName(userService.getById(receiverId) == null ? "" : userService.getById(receiverId).getUserNickname());
        userInformation.setWhetherRead(TO_READ);
        userInformation.setMsgDate(new Date());
        userInformation.setLevel(level);
        userInformation.setMsgIdThird(msgIdThird);
        userInformation.setCommentRelRelId(commentRelRelId);
        saveOrUpdate(userInformation);
        // 推到手机上。挂在这里是因为这里是全站消息的唯一入口——各调用方（点赞 MQ 消费者/
        // 评论/@/关注/专题/日程）都经过这一行，推送的接入点就只有这一个。
        // 哪些类型真的会响手机由 WebPushSender.PUSHABLE 决定，不是每条都推
        webPushSender.notifyAsync(userInformation);
    }

    /**
    * @Description: 删除取消的点赞或者点灭消息
    * @param: [msgType, msgId, dreamUser]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/2/1
    * @time: 13:56
    */
    public void removeUserInformation(String msgType, String msgId, String operatorId){
        Map<String, Object> paramMap = new HashMap<>();
        paramMap.put("MSG_TYPE", msgType);
        paramMap.put("MSG_ID", msgId);
        paramMap.put("OPERATOR_ID", operatorId);
        baseMapper.deleteByMap(paramMap);
    }

    /**
    * @Description: 根据消息类型加载消息内容
    * @param: [msgType, msgId, commentContent]
    * @Author: Epoch
    * @return: com.dream.basketball.entity.UserInformation
    * @Date: 2024/2/1
    * @time: 13:42
    */
    public UserInformation getMsgContentInit(String msgType, String msgId, String commentContent){
        UserInformation userInformation = new UserInformation();
        String content = "消息类型错误！";
        String contentMsg = "消息类型错误！";
        if (StringUtils.equals(GOOD_NEWS, msgType) || StringUtils.equals(BAD_NEWS, msgType)) {
            DreamNews dreamNews = dreamNewsService.getById(msgId);
            if (dreamNews != null) {
                content = dreamNews.getContent().length() > 30 ? dreamNews.getContent().substring(0, 30) + "......" : dreamNews.getContent();
            } else {
                content = "原帖已删除！";
            }
            contentMsg = StringUtils.equals(GOOD_NEWS, msgType) ? "点赞了您的帖子" : "点踩了您的帖子";
        } else if (StringUtils.equals(GOOD_COMMENT, msgType) || StringUtils.equals(BAD_COMMENT, msgType)) {
            DreamNewsComment dreamNewsComment = dreamNewsCommentService.getById(msgId);
            if (dreamNewsComment != null) {
                content = dreamNewsComment.getContent().length() > 30 ? dreamNewsComment.getContent().substring(0, 30) + "......" : dreamNewsComment.getContent();
            } else {
                content = "原评论已删除！";
            }
            contentMsg = StringUtils.equals(GOOD_COMMENT, msgType) ? "点赞了您的评论" : "点踩了您的评论";
        } else if (StringUtils.equals(COMMENT_COMMENT, msgType)) {
            DreamNewsComment dreamNewsComment = dreamNewsCommentService.getById(msgId);
            if (dreamNewsComment != null) {
                content = dreamNewsComment.getContent().length() > 30 ? dreamNewsComment.getContent().substring(0, 30) + "......" : dreamNewsComment.getContent();
            } else {
                content = "原评论已删除！";
            }
            contentMsg = commentContent;
        } else if (StringUtils.equals(COMMENT_NEWS, msgType)){
            DreamNews dreamNews = dreamNewsService.getById(msgId);
            if (dreamNews != null) {
                content = dreamNews.getContent().length() > 30 ? dreamNews.getContent().substring(0, 30) + "......" : dreamNews.getContent();
            } else {
                content = "原帖已删除！";
            }
            contentMsg = commentContent;
        } else if (StringUtils.equals(MENTION_COMMENT, msgType)) {
            // msgId=评论 id：明细展示 @ 了你的那条评论原文
            DreamNewsComment dreamNewsComment = dreamNewsCommentService.getById(msgId);
            content = dreamNewsComment == null ? "原评论已删除！"
                    : (dreamNewsComment.getContent().length() > 30 ? dreamNewsComment.getContent().substring(0, 30) + "......" : dreamNewsComment.getContent());
            contentMsg = "在评论里@了您";
        } else if (StringUtils.equals(MENTION_NEWS, msgType)) {
            // msgId=帖子 id：明细展示帖子摘要
            DreamNews dreamNews = dreamNewsService.getById(msgId);
            content = dreamNews == null ? "原帖已删除！"
                    : (dreamNews.getContent().length() > 30 ? dreamNews.getContent().substring(0, 30) + "......" : dreamNews.getContent());
            contentMsg = "在帖子里@了您";
        } else if (StringUtils.equals(SCHEDULE_ASSIGN, msgType) || StringUtils.equals(SCHEDULE_REMIND, msgType)
                || StringUtils.equals(SCHEDULE_OVERDUE, msgType) || StringUtils.equals(SCHEDULE_EXPIRY, msgType)) {
            // 日程类：正文用调用方传入的摘要（指派=事件标题+日期；提醒=当日事件清单）；msgId=事件id/日期，前端据此跳日历
            content = StringUtils.defaultIfBlank(commentContent, "日程");
            contentMsg = StringUtils.equals(SCHEDULE_ASSIGN, msgType) ? "给你指派了一条日程"
                    : StringUtils.equals(SCHEDULE_OVERDUE, msgType) ? "日程超时提醒"
                    : StringUtils.equals(SCHEDULE_EXPIRY, msgType) ? "循环日程即将结束" : "今日日程提醒";
        } else if (StringUtils.equals(FOLLOW, msgType)) {
            // msgId=关注者的用户 id（点击跳他的主页）。前端这一类现在不显示 content，
            // 但那是碰巧不是设计——库里躺着 "消息类型错误！" 迟早会漏到界面上。
            DreamUser follower = userService.getById(msgId);
            content = follower == null ? "用户已注销" : follower.getUserNickname();
            contentMsg = "关注了你";
        } else if (StringUtils.equals(MENTION_CHAT, msgType)) {
            // msgId=专题 id（点击要跳回那个专题的群聊），commentContent=被 @ 的那条群聊原文。
            // 漏掉这一支的后果不是报错而是**默认值原样落库**：content 存成 "消息类型错误！"，
            // 消息列表照着显示，看起来像系统坏了。
            com.dream.basketball.entity.ForumTopic topic = forumTopicMapper.selectById(msgId);
            content = topic == null ? "专题已删除" : topic.getName();
            contentMsg = StringUtils.length(commentContent) > 30
                    ? StringUtils.substring(commentContent, 0, 30) + "......"
                    : StringUtils.defaultIfBlank(commentContent, "(图片或附件)");
        } else if (StringUtils.equals(MENTION_LOL, msgType) || StringUtils.equals(REPLY_LOL, msgType)) {
            // msgId=Riot 的 matchId，commentContent=那条短评/回复的原文。
            // 和 MENTION_GAME 一样不去查那一局——要展示的就是那句话本身
            content = StringUtils.length(commentContent) > 30
                    ? StringUtils.substring(commentContent, 0, 30) + "......"
                    : StringUtils.defaultIfBlank(commentContent, "(空)");
            contentMsg = StringUtils.equals(REPLY_LOL, msgType) ? "回复了您在对局里的短评" : "在对局短评里@了您";
        } else if (StringUtils.equals(MENTION_GAME, msgType) || StringUtils.equals(REPLY_GAME, msgType)) {
            // msgId=比赛 id（点击跳 /games/:gameId），commentContent=那条短评/回复的原文。
            // 这里**不去查比赛**：查一场比赛要对 player_game_stats 做 group by，
            // 而消息里真正要展示的就是那句话本身，比赛信息点进去就看到了。
            content = StringUtils.length(commentContent) > 30
                    ? StringUtils.substring(commentContent, 0, 30) + "......"
                    : StringUtils.defaultIfBlank(commentContent, "(空)");
            contentMsg = StringUtils.equals(REPLY_GAME, msgType) ? "回复了您的赛后短评" : "在赛后短评里@了您";
        } else if (StringUtils.equals(TOPIC_APPLY, msgType) || StringUtils.equals(TOPIC_APPROVED, msgType)
                || StringUtils.equals(TOPIC_REJECTED, msgType)) {
            // msgId=专题 id：content 存专题名，供"我的消息"展示与跳转
            com.dream.basketball.entity.ForumTopic topic = forumTopicMapper.selectById(msgId);
            content = topic == null ? "专题已删除" : topic.getName();
            if (StringUtils.equals(TOPIC_APPLY, msgType)) {
                contentMsg = "申请加入你的专题";
            } else if (StringUtils.equals(TOPIC_APPROVED, msgType)) {
                contentMsg = "通过了你的加入申请";
            } else {
                contentMsg = "驳回了你的加入申请";
            }
        }
        userInformation.setContent(content);
        userInformation.setContentMsg(contentMsg);
        return userInformation;
    }

    public List<UserInformationDto> getUserInformationListByParam(UserInformationDto param){
        return baseMapper.getUserInformationListByParam(param);
    }

    /**
    * @Description: 更新信息状态为已读
    * @param: [userInformationId]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/2/2
    * @time: 10:43
    */
    public void updateInformationRead(String userInformationId){
        if (StringUtils.isNotBlank(userInformationId)) {
            UserInformation userInformation = getById(userInformationId);
            if (userInformation != null && StringUtils.equals(TO_READ, userInformation.getWhetherRead())) {
                userInformation.setWhetherRead(READ);
                saveOrUpdate(userInformation);
            }
        }
    }

    /**
     * @Description: 更新信息状态为未读
     * @param: [userInformationId]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/2/2
     * @time: 10:43
     */
    public void updateInformationToRead(String userInformationId){
        if (StringUtils.isNotBlank(userInformationId)) {
            UserInformation userInformation = getById(userInformationId);
            if (userInformation != null && StringUtils.equals(READ, userInformation.getWhetherRead())) {
                userInformation.setWhetherRead(TO_READ);
                saveOrUpdate(userInformation);
            }
        }
    }

}
