package com.dream.basketball.kafka;

import com.alibaba.fastjson.JSONObject;
import com.dream.basketball.dto.EventDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.Comment;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserService;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.UUID;

import static com.dream.basketball.utils.Constants.*;

//@Component
public class EventConsumer {
//    private static final Logger logger = LoggerFactory.getLogger(EventConsumer.class);
//
//    @Autowired
//    DreamNewsCommentService dreamNewsCommentService;
//
//    @Autowired
//    UserService userService;
//
//    @Autowired
//    NewsService newsService;
//
//    @Autowired
//    DreamNewsService dreamNewsService;
//
//    @KafkaListener(topics = {TOPIC_COMMENT, TOPIC_LIKE, TOPIC_FOLLOW})
//    public void handleCommentMessage(String record) {
//
//        if (StringUtils.isBlank(record)) {
//            logger.error("消息的内容为空");
//            return;
//        }
//
//        EventDto event = JSONObject.parseObject(record, EventDto.class);
//        if (event == null) {
//            logger.error("消息格式错误!");
//        }
//        // 发送站内通知
//        if (StringUtils.isBlank(event.getUserId())) {
//            logger.error("未登录");
//            return;
//        }
//        DreamNewsComment dreamNewsComment = JSONObject.parseObject(event.getData().get("comment").toString(), DreamNewsComment.class);
//        dreamNewsComment.setCommentId(UUID.randomUUID().toString());
//        DreamUser dreamUser = userService.getById(event.getUserId());
//        dreamNewsComment.setUserId(dreamUser.getUserId());
//        dreamNewsComment.setUserName(dreamUser.getUserNickname());
//        dreamNewsComment.setCommentDate(new Date());
//        dreamNewsComment.setGoodNum(0);
//        dreamNewsComment.setBadNum(0);
//        dreamNewsComment.setFloor(dreamNewsCommentService.findMaxFloor(dreamNewsComment.getNewsId()));
//        // 同步帖子新闻的评论数
//        DreamNews dreamNews = dreamNewsService.getById(dreamNewsComment.getNewsId());
//        dreamNews.setCommentNum(dreamNews.getCommentNum() + 1);
//        dreamNewsService.saveOrUpdate(dreamNews);
//        // es同步保存评论
//        Comment commentEs = JSONObject.parseObject(JSONObject.toJSONString(dreamNewsComment), Comment.class);
//        if (commentEs != null) {
//            newsService.saveComment(commentEs);
//        }
//        // 数据库保存评论
//        dreamNewsCommentService.saveOrUpdate(dreamNewsComment);
//    }
}

