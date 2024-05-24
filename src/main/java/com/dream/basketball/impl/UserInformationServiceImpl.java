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
