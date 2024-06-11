package com.dream.basketball.rabbitmq;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
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

    /**
    * @Description: 点在/点踩评论
    * @param: [commentId, userId, whetherClicked, dreamUser, dreamNewsComment, action]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/11
    * @time: 11:01
    */
    public void commentActionRmq(String commentId, String userId, boolean whetherClicked, DreamUser dreamUser, DreamNewsComment dreamNewsComment, String action) {
        rabbitMqService.commentActionRmq(commentId, userId, whetherClicked, dreamUser, dreamNewsComment, action);
    }

}
