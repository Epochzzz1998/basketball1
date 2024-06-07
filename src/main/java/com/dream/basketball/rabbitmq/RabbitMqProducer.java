package com.dream.basketball.rabbitmq;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.RabbitMqService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;

@Component
public class RabbitMqProducer {

    @Autowired
    RabbitMqService rabbitMqService;

    /**
    * @Description: 新闻帖子点赞或点踩操作
    * @param: [newsId]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/5
    * @time: 15:50
    */
    public void newsActionRmq(String newsId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNews dreamNews, String action) {
        rabbitMqService.newsActionRmq(newsId, userId, whetherClicked, dreamUser, dreamNews, action);
    }

}
