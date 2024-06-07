package com.dream.basketball.rabbitmq;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.BaseUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitHandler;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

import static com.dream.basketball.utils.Constants.GOOD_NEWS;

@Component
@Slf4j
public class RabbitMqConsumer extends BaseUtils {

    @Autowired
    StringRedisTemplate stringRedisTemplate;

    @Autowired
    DreamNewsService dreamNewsService;

    @Autowired
    UserInformationService userInformationService;

    /**
     * @Description: mq监听新闻点赞
     * @param: [newsId]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/6/5
     * @time: 16:41
     */
    @RabbitListener(queues = "good_news_queue")
    @RabbitHandler
    public void receiveGoodNewsQueue(Map<String, Object> dataMap){
        try {
            String newsId = (String) dataMap.get("newsId");
            String userId = (String) dataMap.get("userId");
            DreamUser dreamUser = (DreamUser) dataMap.get("dreamUser");
            DreamNews dreamNews = (DreamNews) dataMap.get("dreamNews");
            boolean isGood = (boolean) dataMap.get("isGood");
            log.info("good_news_queue队列接收到点赞帖子消息，newsId为:{}，userId为:{}", newsId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("good:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.good(newsId, -1);
                // 个人消息提示取消 redis
//      redisUtil.removeMsgFromRedis(dreamNews.getAuthorId(), GOOD_NEWS, newsId, dreamUser.getUserId());
                // 数据库移除点赞信息
                userInformationService.removeUserInformation(GOOD_NEWS, newsId, dreamUser.getUserId());
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("good:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.good(newsId, 1);
                // 个人消息提示 redis
//                redisUtil.addMsgToRedis(dreamNews.getAuthorId(), GOOD_NEWS, newsId, dreamUser.getUserId());
                // 个人消息提示入库
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNews.getAuthorId(), GOOD_NEWS, newsId, "", "", "", "", "");
            }
        } catch (Exception e){
            log.error("good_news_queue队列处理出错！报错信息:{}", e.getMessage());
        }
    }

}