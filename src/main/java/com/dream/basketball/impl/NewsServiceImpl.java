package com.dream.basketball.impl;

import cn.hutool.json.JSONUtil;
import com.alibaba.fastjson.JSONObject;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.dto.UserInformationDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.Comment;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.RedisUtil;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.Operator;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.sort.SortBuilders;
import org.elasticsearch.search.sort.SortOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchRestTemplate;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.NativeSearchQuery;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

import static com.dream.basketball.utils.Constants.*;

@Service
public class NewsServiceImpl implements NewsService {

    @Autowired
    ElasticsearchRestTemplate template;

    @Autowired
    StringRedisTemplate stringRedisTemplate;

    @Autowired
    DreamNewsService dreamNewsService;

//    @Autowired
//    EventProducer eventProducer;

    @Autowired
    DreamNewsCommentService dreamNewsCommentService;

    @Autowired
    RedisUtil redisUtil;

    @Autowired
    UserInformationService userInformationService;

    public void create(Class<?> clazz) {
        template.indexOps(clazz);
    }

    public void saveAll(Iterable<?> entities) {
        template.save(entities);
    }

    /**
     * @Description: 保存方法
     * @param: [news]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/10
     * @time: 17:34
     */
    public void save(News news) {
        if (news.getPublishDate() == null) {
            news.setPublishDate(new Date());
        }
        template.save(news);
    }

    /**
    * @Description: es同步保存评论
    * @param: [comment]
    * @Author: Epoch
    * @return: void
    * @Date: 2024/1/19
    * @time: 14:06
    */
    public void saveComment(Comment comment) {
        template.save(comment);
    }

    /**
     * @Description: 根据id删除新闻
     * @param: [newsId, clazz]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/10
     * @time: 14:05
     */
    public void deleteNewsById(String newsId, Class<?> clazz) {
        template.delete(newsId, clazz);
    }

    /**
     * @Description: 批量删除
     * @param: [newsId, clazz]
     * @Author: Epoch
     * @return: void
     * @Date: 2024/1/10
     * @time: 14:50
     */
    public void deleteNewsListByIds(String newsIds, Class<?> clazz) {
        List<String> newsIdList = Arrays.asList(newsIds.split(","));
        for (String newsId : newsIdList) {
            deleteNewsById(newsId, clazz);
        }
    }

    /**
     * @Description: 新闻列表查询
     * @param: [params]
     * @Author: Epoch
     * @return: java.util.List<com.dream.basketball.esEntity.News>
     * @Date: 2024/1/10
     * @time: 10:19
     */
    public List<NewsDto> getNewsByParams(NewsDto params) {
        NativeSearchQueryBuilder builder = getMatchSearch(params);
        NativeSearchQuery nativeSearchQuery = builder.build();
        // 设置分页信息
//        builder.withPageable(PageRequest.of(0, 5));
        // 设置排序
//        builder.withSort(SortBuilders.fieldSort("publishDate").order(SortOrder.DESC));
        SearchHits<News> search = template.search(nativeSearchQuery, News.class);
        List<SearchHit<News>> searchHits = search.getSearchHits();
        List<NewsDto> newsList = new ArrayList<>();
        for (SearchHit hit : searchHits) {
            NewsDto newsDto = JSONUtil.toBean(JSONUtil.toJsonStr((News) hit.getContent()), NewsDto.class);
            if (newsDto != null) {
                DreamNews dreamNews = dreamNewsService.getById(newsDto.getNewsId());
                if (dreamNews != null) {
                    newsDto.setGoodNum(dreamNews.getGoodNum());
                    newsDto.setBadNum(dreamNews.getBadNum());
                    newsDto.setCommentNum(dreamNews.getCommentNum());
                }
            }
            newsList.add(newsDto);
        }
        return newsList;
    }

    /**
    * @Description: 获取评论
    * @param: [params]
    * @Author: Epoch
    * @return: java.util.List<java.util.HashMap<java.lang.String,java.lang.Object>>
    * @Date: 2024/1/19
    * @time: 11:22
    */
    public List<DreamNewsCommentDto> getCommentListByParams(DreamNewsCommentDto params){
        NativeSearchQueryBuilder builder = getCommentMatchSearch(params);
        NativeSearchQuery nativeSearchQuery = builder.build();
        // 设置分页信息
//        builder.withPageable(PageRequest.of(0, 5));
        // 设置排序
        builder.withSort(SortBuilders.fieldSort("floor").order(SortOrder.DESC));
        SearchHits<Comment> search = template.search(nativeSearchQuery, Comment.class);
        List<SearchHit<Comment>> searchHits = search.getSearchHits();
        List<DreamNewsCommentDto> dreamNewsCommentDtos = new ArrayList<>();
        for (SearchHit hit : searchHits) {
            DreamNewsCommentDto dreamNewsCommentDto = JSONUtil.toBean(JSONUtil.toJsonStr((Comment) hit.getContent()), DreamNewsCommentDto.class);
            dreamNewsCommentDto.setCommentNum(getCommentNum(dreamNewsCommentDto.getCommentId()));
            dreamNewsCommentDtos.add(dreamNewsCommentDto);
        }
        return dreamNewsCommentDtos;
    }

    /**
    * @Description: 获取评论条数
    * @param: [commentRelId]
    * @Author: Epoch
    * @return: java.lang.Integer
    * @Date: 2024/1/29
    * @time: 10:05
    */
    public Integer getCommentNum(String commentRelId){
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();
        BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
        queryBuilder.must(QueryBuilders.matchQuery("commentRelId", commentRelId).operator(Operator.AND));
        NativeSearchQueryBuilder builderFinish = builder.withQuery(queryBuilder);
        NativeSearchQuery nativeSearchQuery = builderFinish.build();
        SearchHits<Comment> search = template.search(nativeSearchQuery, Comment.class);
        return search.getSearchHits().size();
    }

    /**
     * @Description: 搜索条件
     * @param: [params]
     * @Author: Epoch
     * @return: org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder
     * @Date: 2024/1/10
     * @time: 10:19
     */
    private NativeSearchQueryBuilder getMatchSearch(NewsDto params) {
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();
        BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
        builder.withPageable(PageRequest.of(0, 10000));
        if (params != null) {
            if (StringUtils.isNotBlank(params.getNewsId())) {
                queryBuilder.must(QueryBuilders.matchQuery("newsId", params.getNewsId()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getTeam())) {
                queryBuilder.must(QueryBuilders.matchQuery("team", params.getTeam()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getNewsType())) {
                queryBuilder.must(QueryBuilders.matchQuery("newsType", params.getNewsType()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getContent())) {
                queryBuilder.must(QueryBuilders.matchQuery("content", params.getContent()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getAuthor())) {
                queryBuilder.must(QueryBuilders.matchQuery("author", params.getAuthor()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getTitle())) {
                queryBuilder.must(QueryBuilders.matchQuery("title", params.getTitle()).operator(Operator.AND));
            }
        }
        return builder.withQuery(queryBuilder);
    }

    /**
    * @Description: 评论查找条件
    * @param: [params]
    * @Author: Epoch
    * @return: org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder
    * @Date: 2024/1/19
    * @time: 11:23
    */
    private NativeSearchQueryBuilder getCommentMatchSearch(DreamNewsCommentDto params) {
        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder();
        BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
        if (params != null) {
            if (StringUtils.isNotBlank(params.getNewsId())) {
                queryBuilder.must(QueryBuilders.matchQuery("newsId", params.getNewsId()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getUserId())) {
                queryBuilder.must(QueryBuilders.matchQuery("userId", params.getUserId()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getTeam())) {
                queryBuilder.must(QueryBuilders.matchQuery("team", params.getTeam()).operator(Operator.AND));
            }
            if (params.getFloor() != null) {
                queryBuilder.must(QueryBuilders.matchQuery("floor", params.getFloor()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getContent())) {
                queryBuilder.must(QueryBuilders.matchQuery("content", params.getContent()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getLevel())) {
                queryBuilder.must(QueryBuilders.matchQuery("level", params.getLevel()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getCommentRelId())) {
                queryBuilder.must(QueryBuilders.matchQuery("commentRelId", params.getCommentRelId()).operator(Operator.AND));
            }
            if (StringUtils.isNotBlank(params.getCommentId())) {
                queryBuilder.must(QueryBuilders.matchQuery("commentId", params.getCommentId()).operator(Operator.AND));
            }
            builder.withSort(SortBuilders.fieldSort("floor").order(SortOrder.ASC));
        }
        return builder.withQuery(queryBuilder);
    }

    /**
     * @Description: 点赞功能
     * @param: [newsId]
     * @Author: Epoch
     * @return: boolean
     * @Date: 2024/1/18
     * @time: 9:24
     */
    public Object good(String newsId, HttpServletRequest request) {
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        DreamNews dreamNews = dreamNewsService.getById(newsId);
        if (dreamUser == null) {
            return handlerResultJson(false, "请先登录！");
        } else if (dreamNews == null){
            return handlerResultJson(false, "原帖已删除！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("good:user:" + userId + ":newsId:" + newsId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("good:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.good(newsId, -1);
                // 个人消息提示取消 redis
//                redisUtil.removeMsgFromRedis(dreamNews.getAuthorId(), GOOD_NEWS, newsId, dreamUser.getUserId());
                // 数据库移除点赞信息
                userInformationService.removeUserInformation(GOOD_NEWS, newsId, dreamUser.getUserId());
                return handlerResultJson(true, "让我再看看这帖子质量怎么样");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("good:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.good(newsId, 1);
                // 个人消息提示 redis
//                redisUtil.addMsgToRedis(dreamNews.getAuthorId(), GOOD_NEWS, newsId, dreamUser.getUserId());
                // 个人消息提示入库
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNews.getAuthorId(), GOOD_NEWS, newsId, "", "", "", "", "");
                return handlerResultJson(true, "好帖，顶！");
            }
        }
    }

    /**
     * @Description: 点踩
     * @param: [newsId, request]
     * @Author: Epoch
     * @return: java.lang.Object
     * @Date: 2024/1/18
     * @time: 12:51
     */
    public Object bad(String newsId, HttpServletRequest request) {
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        DreamNews dreamNews = dreamNewsService.getById(newsId);
        if (dreamUser == null) {
            return handlerResultJson(false, "请先登录！");
        } else if (dreamNews == null){
            return handlerResultJson(false, "原帖已删除！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("bad:user:" + userId + ":newsId:" + newsId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("bad:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.bad(newsId, -1);
                // 个人消息提示
//                redisUtil.removeMsgFromRedis(dreamNews.getAuthorId(), BAD_NEWS, newsId, dreamUser.getUserId());
                // 数据库移除点灭信息
                userInformationService.removeUserInformation(BAD_NEWS, newsId, dreamUser.getUserId());
                return handlerResultJson(true, "我觉得还可以再看看");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("bad:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.bad(newsId, 1);
                // 个人消息提示
//                redisUtil.addMsgToRedis(dreamNews.getAuthorId(), BAD_NEWS, newsId, dreamUser.getUserId());
                // 个人消息提示入库
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNews.getAuthorId(), BAD_NEWS, newsId, "", "","", "", "");
                return handlerResultJson(true, "什么垃圾帖子，滚！");
            }
        }
    }

    /**
    * @Description: 评论点赞
    * @param: [commentId, request]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/19
    * @time: 16:24
    */
    public Object goodComment(String commentId, HttpServletRequest request){
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        DreamNewsComment dreamNewsComment = dreamNewsCommentService.getById(commentId);
        if (dreamUser == null) {
            return handlerResultJson(false, "请先登录！");
        } else if (dreamNewsComment == null) {
            return handlerResultJson(false, "原评论已删除！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("goodComment:user:" + userId + ":commentId:" + commentId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("goodComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.goodComment(commentId, -1);
                // 个人消息提示 redis
//                redisUtil.removeMsgFromRedis(dreamNewsComment.getUserId(), GOOD_COMMENT, commentId, dreamUser.getUserId());
                // 数据库移除点赞信息
                userInformationService.removeUserInformation(GOOD_COMMENT, commentId, dreamUser.getUserId());
                return handlerResultJson(true, "你的想法尚且需要我三思");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("goodComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.goodComment(commentId, 1);
                // 个人消息提示 redis
//                redisUtil.addMsgToRedis(dreamNewsComment.getUserId(), GOOD_COMMENT, commentId, dreamUser.getUserId());
                // 个人消息提示入库
                String level = String.valueOf(Integer.parseInt(dreamNewsComment.getLevel()) + 1);
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNewsComment.getUserId(), GOOD_COMMENT, commentId, dreamNewsComment.getNewsId(), "", level, "", StringUtils.equals("2", level) ? "" : dreamNewsComment.getCommentRelId());
                return handlerResultJson(true, "说得好！");
            }
        }
    }

    /**
     * @Description: 评论点踩
     * @param: [commentId, request]
     * @Author: Epoch
     * @return: java.lang.Object
     * @Date: 2024/1/19
     * @time: 16:24
     */
    public Object badComment(String commentId, HttpServletRequest request){
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        DreamNewsComment dreamNewsComment = dreamNewsCommentService.getById(commentId);
        if (dreamUser == null) {
            return handlerResultJson(false, "请先登录！");
        } else if (dreamNewsComment == null) {
            return handlerResultJson(false, "原评论已删除！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("badComment:user:" + userId + ":commentId:" + commentId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("badComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.badComment(commentId, -1);
                // 个人消息提示redis
//                redisUtil.removeMsgFromRedis(dreamNewsComment.getUserId(), BAD_COMMENT, commentId, dreamUser.getUserId());
                // 数据库移除点灭信息
                userInformationService.removeUserInformation(BAD_COMMENT, commentId, dreamUser.getUserId());
                return handlerResultJson(true, "好像说的也没那么离谱");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("badComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.badComment(commentId, 1);
                // 个人消息提示 redis
//                redisUtil.addMsgToRedis(dreamNewsComment.getUserId(), BAD_COMMENT, commentId, dreamUser.getUserId());
                // 个人消息提示入库
                String level = String.valueOf(Integer.parseInt(dreamNewsComment.getLevel()) + 1);
                userInformationService.saveUserInformation(userId, dreamUser.getUserNickname(), dreamNewsComment.getUserId(), BAD_COMMENT, commentId, dreamNewsComment.getNewsId(), "", level, "", StringUtils.equals("2", level) ? "" : dreamNewsComment.getCommentRelId());
                return handlerResultJson(true, "我觉得这完全没道理");
            }
        }
    }

    /**
    * @Description: 评论
    * @param: [newsId, comment, request]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/1/19
    * @time: 8:55
    */
    public Object comment(DreamNewsComment dreamNewsComment, HttpServletRequest request){
//        Map<String, Object> data = new HashMap<>();
//        data.put("comment", dreamNewsComment);
//        EventDto event = new EventDto();
//        event.setTopic(TOPIC_COMMENT);
//        event.setUserId(StringUtils.isNotBlank(SecUtil.getLoginUserIdToSession(request)) ? SecUtil.getLoginUserIdToSession(request) : "");
//        event.setData(data);
//        eventProducer.fireEvent(event);
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        if (dreamUser == null) {
            return handlerResultJson(false, "请先登录！");
        }
        dreamNewsComment.setCommentId(UUID.randomUUID().toString());
        dreamNewsComment.setUserId(dreamUser.getUserId());
        dreamNewsComment.setUserName(dreamUser.getUserNickname());
        dreamNewsComment.setCommentDate(new Date());
        dreamNewsComment.setGoodNum(0);
        dreamNewsComment.setBadNum(0);
        dreamNewsComment.setFloor(dreamNewsCommentService.findMaxFloor(dreamNewsComment.getNewsId()));
        // 同步帖子新闻的评论数
        DreamNews dreamNews = dreamNewsService.getById(dreamNewsComment.getNewsId());
        dreamNews.setCommentNum(dreamNews.getCommentNum() + 1);
        dreamNewsService.saveOrUpdate(dreamNews);
        // es同步保存评论
        Comment commentEs = JSONObject.parseObject(JSONObject.toJSONString(dreamNewsComment), Comment.class);
        if (commentEs != null) {
            saveComment(commentEs);
        }
        // 数据库保存评论
        dreamNewsCommentService.saveOrUpdate(dreamNewsComment);
        // 个人消息提示入库
        String receiverId = "";
        String commentType = "";
        String msgId = "";
        String msgIdSecond = "";
        String msgIdThird = dreamNewsComment.getCommentId();
        String level = dreamNewsComment.getLevel();
        String commentRelRelId = "";
        // 评论新闻
        if (StringUtils.isBlank(dreamNewsComment.getCommentRelId())) {
            receiverId = dreamNews.getAuthorId();
            commentType = COMMENT_NEWS;
            msgId = dreamNewsComment.getNewsId();
        }
        // 评论评论
        else {
            receiverId = dreamNewsCommentService.getById(dreamNewsComment.getCommentRelId()).getUserId();
            commentType = COMMENT_COMMENT;
            msgId = dreamNewsComment.getCommentRelId();
            msgIdSecond = dreamNewsComment.getNewsId();
            commentRelRelId = dreamNewsCommentService.getById(dreamNewsComment.getCommentRelId()).getCommentRelId();
        }
        // 个人消息提示 redis
//        redisUtil.addMsgToRedis(receiverId, COMMENT, dreamNewsComment.getCommentId(), dreamUser.getUserId());
        // 数据库
        userInformationService.saveUserInformation(dreamUser.getUserId(), dreamUser.getUserNickname(), receiverId, commentType, msgId, msgIdSecond, msgIdThird, level, dreamNewsComment.getContent(), commentRelRelId);
        return handlerResultJson(true, "评论成功！");
    }

    /**
     * @Description: 组织返回参数
     * @param: [result, msg]
     * @Author: Epoch
     * @return: java.lang.Object
     * @Date: 2024/1/18
     * @time: 9:56
     */
    public Object handlerResultJson(boolean result, String msg) {
        Map<String, Object> map = new HashMap<String, Object>();
        map.put("msg", msg);
        map.put("result", result);
        return map;
    }

    /**
    * @Description: 初始化评论
    * @param: [newsId, request]
    * @Author: Epoch
    * @return: com.dream.basketball.entity.DreamNewsComment
    * @Date: 2024/1/19
    * @time: 10:13
    */
    public DreamNewsComment getCommentInit(String newsId, HttpServletRequest request, String level, String commentId){
        commentId = StringUtils.equals("''", commentId) ? "" : commentId;
        DreamNewsComment dreamNewsComment = new DreamNewsComment();
        if (StringUtils.isNotBlank(newsId)) {
            DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
            if (dreamUser == null) {
                return null;
            }
            dreamNewsComment.setUserName(dreamUser.getUserNickname());
            dreamNewsComment.setUserId(dreamUser.getUserId());
            dreamNewsComment.setNewsId(newsId);
            dreamNewsComment.setCommentRelId(commentId);
            DreamNewsComment dreamNewsCommentOrigin = dreamNewsCommentService.getById(commentId);
            if (dreamNewsCommentOrigin == null){
                dreamNewsComment.setLevel("1");
            } else {
                Integer levelNum = Integer.parseInt(dreamNewsCommentOrigin.getLevel());
                dreamNewsComment.setLevel(String.valueOf(++levelNum));
            }
        }
        return dreamNewsComment;
    }

    /**
     * @Description: 初始化新增新闻和修改新闻实体类信息
     * @param: [newsId, request]
     * @Author: Epoch
     * @return: com.dream.basketball.esEntity.News
     * @Date: 2024/1/18
     * @time: 10:32
     */
    public News getInputAndEditNews(String newsId, HttpServletRequest request) {
        News news = new News();
        if (StringUtils.isNotBlank(newsId)) {
            NewsDto newsDto = new NewsDto();
            newsDto.setNewsId(newsId);
            List<NewsDto> newsList = getNewsByParams(newsDto);
            if (!CollectionUtils.isEmpty(newsList)) {
                news = newsList.get(0);
            }
        }
        if (StringUtils.isBlank(news.getAuthor())) {
            news.setAuthor(SecUtil.getLoginUserToSession(request).getUserNickname());
        }
        if (StringUtils.isBlank(news.getAuthorId())) {
            news.setAuthorId(SecUtil.getLoginUserToSession(request).getUserId());
        }
        if (StringUtils.isBlank(news.getNewsId())) {
            news.setNewsId(UUID.randomUUID().toString());
        }
        return news;
    }

    /**
     * @Description: 查看新闻论坛详情
     * @param: [newsId]
     * @Author: Epoch
     * @return: com.dream.basketball.esEntity.News
     * @Date: 2024/1/18
     * @time: 11:04
     */
    public News getNewsShow(String newsId) {
        News news = new News();
        if (StringUtils.isNotBlank(newsId)) {
            NewsDto newsDto = new NewsDto();
            newsDto.setNewsId(newsId);
            List<NewsDto> newsList = getNewsByParams(newsDto);
            if (!CollectionUtils.isEmpty(newsList)) {
                news = newsList.get(0);
            }
        }
        return news;
    }

}
