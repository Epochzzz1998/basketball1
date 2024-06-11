package com.dream.basketball.impl;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.RabbitMqService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.core.AmqpTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class RabbitMqServiceImpl implements RabbitMqService {

    @Autowired
    AmqpTemplate amqpTemplate;

    /**
    * @Description: 点赞新闻/帖子
    * @param: [newsId, request]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/7
    * @time: 15:54
    */
    @Override
    public void newsActionRmq(String newsId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNews dreamNews, String action){
        Map<String, Object> dataMap = new HashMap<>(5, 1);
        dataMap.put("newsId", newsId);
        dataMap.put("userId", userId);
        dataMap.put("whetherClicked", whetherClicked);
        dataMap.put("dreamUser", dreamUser);
        dataMap.put("dreamNews", dreamNews);
        if (StringUtils.equals("good", action)) {
            amqpTemplate.convertAndSend("exchange", "good.news", dataMap);
        } else if (StringUtils.equals("bad", action)) {
            amqpTemplate.convertAndSend("exchange", "bad.news", dataMap);
        }
    }

    /**
    * @Description: 点赞/点踩评论
    * @param: [commentId, userId, whetherClicked, dreamUser, dreamNewsComment, action]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/11
    * @time: 11:00
    */
    @Override
    public void commentActionRmq(String commentId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNewsComment dreamNewsComment, String action) {
        Map<String, Object> dataMap = new HashMap<>(5, 1);
        dataMap.put("commentId", commentId);
        dataMap.put("userId", userId);
        dataMap.put("whetherClicked", whetherClicked);
        dataMap.put("dreamUser", dreamUser);
        dataMap.put("dreamNewsComment", dreamNewsComment);
        if (StringUtils.equals("good", action)) {
            amqpTemplate.convertAndSend("exchange", "good.comment", dataMap);
        } else if (StringUtils.equals("bad", action)) {
            amqpTemplate.convertAndSend("exchange", "bad.comment", dataMap);
        }
    }

}
