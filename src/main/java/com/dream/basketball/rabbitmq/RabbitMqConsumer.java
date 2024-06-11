package com.dream.basketball.rabbitmq;

import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.BaseUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.amqp.rabbit.annotation.RabbitHandler;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

import static com.dream.basketball.utils.Constants.*;

@Component
@Slf4j
public class RabbitMqConsumer extends BaseUtils {

    @Autowired
    StringRedisTemplate stringRedisTemplate;

    @Autowired
    DreamNewsService dreamNewsService;

    @Autowired
    UserInformationService userInformationService;

    @Autowired
    DreamNewsCommentService dreamNewsCommentService;

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
            boolean whetherClicked = (boolean) dataMap.get("whetherClicked");
            log.info("good_news_queue队列接收到点赞帖子消息，newsId为:{}，userId为:{}", newsId, userId);
            if (whetherClicked) {
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
            e.printStackTrace();
        }
    }

    /**
    * @Description: mq监听点踩
    * @param: [dataMap]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/7
    * @time: 17:21
    */
    @RabbitListener(queues = "bad_news_queue")
    @RabbitHandler
    public void receiveBadNewsQueue(Map<String, Object> dataMap){
        try {
            String newsId = (String) dataMap.get("newsId");
            String userId = (String) dataMap.get("userId");
            DreamUser dreamUser = (DreamUser) dataMap.get("dreamUser");
            DreamNews dreamNews = (DreamNews) dataMap.get("dreamNews");
            boolean whetherClicked = (boolean) dataMap.get("whetherClicked");
            log.info("good_news_queue队列接收到点踩帖子消息，newsId为:{}，userId为:{}", newsId, userId);
            if (whetherClicked) {
                // 已经点踩了的，点踩数-1，redis移除
                stringRedisTemplate.opsForSet().remove("bad:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.bad(newsId, -1);
                // 个人消息提示
//                redisUtil.removeMsgFromRedis(dreamNews.getAuthorId(), BAD_NEWS, newsId, dreamUser.getUserId());
                // 数据库移除点灭信息
                userInformationService.removeUserInformation(BAD_NEWS, newsId, dreamUser.getUserId());
            } else {
                // 没点踩的，点踩数+1，redis新增
                stringRedisTemplate.opsForSet().add("bad:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.bad(newsId, 1);
                // 个人消息提示
//                redisUtil.addMsgToRedis(dreamNews.getAuthorId(), BAD_NEWS, newsId, dreamUser.getUserId());
                // 个人消息提示入库
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNews.getAuthorId(), BAD_NEWS, newsId, "", "","", "", "");
            }
        } catch (Exception e){
            log.error("bad_news_queue队列处理出错！报错信息:{}", e.getMessage());
            e.printStackTrace();
        }
    }

    /**
    * @Description: mq监听评论点赞
    * @param: [dataMap]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/11
    * @time: 11:06
    */
    @RabbitListener(queues = "good_comment_queue")
    @RabbitHandler
    public void receiveGoodCommentQueue(Map<String, Object> dataMap) {
        try {
            String commentId = (String) dataMap.get("commentId");
            String userId = (String) dataMap.get("userId");
            DreamUser dreamUser = (DreamUser) dataMap.get("dreamUser");
            DreamNewsComment dreamNewsComment = (DreamNewsComment) dataMap.get("dreamNewsComment");
            boolean whetherClicked = (boolean) dataMap.get("whetherClicked");
            log.info("good_comment_queue队列接收到点赞评论消息，commentId:{}，userId为:{}", commentId, userId);
            if (whetherClicked) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("goodComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.goodComment(commentId, -1);
                // 个人消息提示 redis
//                redisUtil.removeMsgFromRedis(dreamNewsComment.getUserId(), GOOD_COMMENT, commentId, dreamUser.getUserId());
                // 数据库移除点赞信息
                userInformationService.removeUserInformation(GOOD_COMMENT, commentId, dreamUser.getUserId());
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("goodComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.goodComment(commentId, 1);
                // 个人消息提示 redis
//                redisUtil.addMsgToRedis(dreamNewsComment.getUserId(), GOOD_COMMENT, commentId, dreamUser.getUserId());
                // 个人消息提示入库
                String level = String.valueOf(Integer.parseInt(dreamNewsComment.getLevel()) + 1);
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNewsComment.getUserId(), GOOD_COMMENT, commentId, dreamNewsComment.getNewsId(), "", level, "", StringUtils.equals("2", level) ? "" : dreamNewsComment.getCommentRelId());
            }
        } catch (Exception e) {
            log.error("good_comment_queue队列处理出错！报错信息:{}", e.getMessage());
            e.printStackTrace();
        }
    }

    /**
    * @Description: mq监听评论点踩
    * @param: [dataMap]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/6/11
    * @time: 11:10
    */
    @RabbitListener(queues = "bad_comment_queue")
    @RabbitHandler
    public void receiveBadCommentQueue(Map<String, Object> dataMap) {
        try {
            String commentId = (String) dataMap.get("commentId");
            String userId = (String) dataMap.get("userId");
            DreamUser dreamUser = (DreamUser) dataMap.get("dreamUser");
            DreamNewsComment dreamNewsComment = (DreamNewsComment) dataMap.get("dreamNewsComment");
            boolean whetherClicked = (boolean) dataMap.get("whetherClicked");
            log.info("bad_comment_queue队列接收到点赞评论消息，commentId:{}，userId为:{}", commentId, userId);
            if (whetherClicked) {
                // 已经点踩了的，点踩数-1，redis移除
                stringRedisTemplate.opsForSet().remove("badComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.badComment(commentId, -1);
                // 个人消息提示redis
//                redisUtil.removeMsgFromRedis(dreamNewsComment.getUserId(), BAD_COMMENT, commentId, dreamUser.getUserId());
                // 数据库移除点灭信息
                userInformationService.removeUserInformation(BAD_COMMENT, commentId, dreamUser.getUserId());
            } else {
                // 没点踩的，点踩数+1，redis新增
                stringRedisTemplate.opsForSet().add("badComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.badComment(commentId, 1);
                // 个人消息提示 redis
//                redisUtil.addMsgToRedis(dreamNewsComment.getUserId(), BAD_COMMENT, commentId, dreamUser.getUserId());
                // 个人消息提示入库
                String level = String.valueOf(Integer.parseInt(dreamNewsComment.getLevel()) + 1);
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNewsComment.getUserId(), BAD_COMMENT, commentId, dreamNewsComment.getNewsId(), "", level, "", StringUtils.equals("2", level) ? "" : dreamNewsComment.getCommentRelId());

            }
        } catch (Exception e) {
            log.error("bad_comment_queue队列处理出错！报错信息:{}", e.getMessage());
            e.printStackTrace();
        }
    }

}
