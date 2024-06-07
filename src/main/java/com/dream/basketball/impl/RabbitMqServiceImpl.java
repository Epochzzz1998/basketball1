package com.dream.basketball.impl;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.RabbitMqService;
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
    public void goodNewsRmq(String newsId, String userId, boolean isGood, DreamUser dreamUser, DreamNews dreamNews){
        Map<String, Object> dataMap = new HashMap<>(5, 1);
        dataMap.put("newsId", newsId);
        dataMap.put("userId", userId);
        dataMap.put("isGood", isGood);
        dataMap.put("dreamUser", dreamUser);
        dataMap.put("dreamNews", dreamNews);
        amqpTemplate.convertAndSend("exchange", "good.news", dataMap);
    }

}
