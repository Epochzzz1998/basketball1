package com.dream.basketball.impl;

import cn.hutool.json.JSONUtil;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.dto.EventDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.Comment;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.kafka.EventProducer;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.Operator;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.sort.SortBuilders;
import org.elasticsearch.search.sort.SortOrder;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
    EventProducer eventProducer;

    @Autowired
    DreamNewsCommentService dreamNewsCommentService;

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
            dreamNewsCommentDtos.add(dreamNewsCommentDto);
        }
        return dreamNewsCommentDtos;
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
        if (dreamUser == null) {
            return handlerResultJson(false, "尚未登陆！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("good:user:" + userId + ":newsId:" + newsId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("good:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.good(newsId, -1);
                return handlerResultJson(true, "让我再看看这帖子质量怎么样");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("good:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.good(newsId, 1);
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
        if (dreamUser == null) {
            return handlerResultJson(false, "尚未登陆！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("bad:user:" + userId + ":newsId:" + newsId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("bad:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.bad(newsId, -1);
                return handlerResultJson(true, "我觉得还可以再看看");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("bad:user:" + userId + ":newsId:" + newsId, userId);
                dreamNewsService.bad(newsId, 1);
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
        if (dreamUser == null) {
            return handlerResultJson(false, "尚未登陆！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("goodComment:user:" + userId + ":commentId:" + commentId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("goodComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.goodComment(commentId, -1);
                return handlerResultJson(true, "你的想法尚且需要我三思");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("goodComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.goodComment(commentId, 1);
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
        if (dreamUser == null) {
            return handlerResultJson(false, "尚未登陆！");
        } else {
            String userId = dreamUser.getUserId();
            Boolean isGood = stringRedisTemplate.opsForSet().isMember("badComment:user:" + userId + ":commentId:" + commentId, userId);
            if (isGood) {
                // 已经点赞了的，点赞数-1，redis移除
                stringRedisTemplate.opsForSet().remove("badComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.badComment(commentId, -1);
                return handlerResultJson(true, "好像说的也没那么离谱");
            } else {
                // 没点赞的，点赞数+1，redis新增
                stringRedisTemplate.opsForSet().add("badComment:user:" + userId + ":commentId:" + commentId, userId);
                dreamNewsCommentService.badComment(commentId, 1);
                return handlerResultJson(true, "你说你马呢");
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
        Map<String, Object> data = new HashMap<>();
        data.put("comment", dreamNewsComment);
        EventDto event = new EventDto();
        event.setTopic(TOPIC_COMMENT);
        event.setUserId(StringUtils.isNotBlank(SecUtil.getLoginUserIdToSession(request)) ? SecUtil.getLoginUserIdToSession(request) : "");
        event.setData(data);
        eventProducer.fireEvent(event);
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
        DreamNewsComment dreamNewsComment = new DreamNewsComment();
        if (StringUtils.isNotBlank(newsId)) {
            DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
            if (dreamUser == null) {
                return null;
            }
            dreamNewsComment.setUserName(dreamUser.getUserNickname());
            dreamNewsComment.setUserId(dreamUser.getUserId());
            dreamNewsComment.setNewsId(newsId);
            dreamNewsComment.setLevel(level);
            dreamNewsComment.setCommentRelId(commentId);
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
