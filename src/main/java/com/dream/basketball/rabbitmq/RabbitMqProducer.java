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
    * @Description: 新闻点赞mq
    * @param: [newsId]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/5
    * @time: 15:50
    */
    public void goodNewsMq(String newsId, String userId, boolean isGood, DreamUser dreamUser, DreamNews dreamNews) {
        rabbitMqService.goodNewsRmq(newsId, userId, isGood, dreamUser, dreamNews);
    }

}
