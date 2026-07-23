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
        } else if (StringUtils.equals(SCHEDULE_ASSIGN, msgType) || StringUtils.equals(SCHEDULE_REMIND, msgType)) {
            // 日程类：正文用调用方传入的摘要（指派=事件标题+日期；提醒=当日事件清单）；msgId=事件id/日期，前端据此跳日历
            content = StringUtils.defaultIfBlank(commentContent, "日程");
            contentMsg = StringUtils.equals(SCHEDULE_ASSIGN, msgType) ? "给你指派了一条日程" : "今日日程提醒";
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
