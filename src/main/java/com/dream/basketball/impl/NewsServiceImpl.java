package com.dream.basketball.impl;

import cn.hutool.json.JSONUtil;
import com.alibaba.fastjson.JSONObject;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.Comment;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.rabbitmq.RabbitMqProducer;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.RedisUtil;
import com.dream.basketball.utils.SecUtil;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
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

    @Autowired
    com.dream.basketball.config.TopicPermissionService topicPerms;

    @Autowired
    com.dream.basketball.config.UserPermService userPerms;

    @Autowired
    com.dream.basketball.mapper.UserMapper userMapper;

    @Autowired
    com.dream.basketball.service.PlayerService playerService;

    @Autowired
    RabbitMqProducer rabbitMqProducer;

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
        // ES refreshes for search only ~1s after a write by default; force it so the admin list
        // and detail reflect a new/edited article immediately (read-after-write consistency).
        template.indexOps(News.class).refresh();
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
        // ES 近实时（NRT）：不强刷的话，紧跟着的评论列表查询看不到刚发的评论
        template.indexOps(Comment.class).refresh();
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
        // Force an index refresh so a reload right after delete no longer shows the removed rows.
        // Without this, ES's ~1s refresh delay made the UI need a second delete to "take".
        template.indexOps(clazz).refresh();
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
                    // 置顶/精华/浏览计数存在 MySQL，读时合并进来（ES 不索引这些字段）
                    newsDto.setTop(dreamNews.getTop());
                    newsDto.setEssence(dreamNews.getEssence());
                    newsDto.setViewCount(dreamNews.getViewCount());
                    newsDto.setViewerCount(dreamNews.getViewerCount());
                }
            }
            newsList.add(newsDto);
        }
        // 置顶帖优先，其次按发布时间倒序。内存排序：查询已拉全量（<=10000），也不依赖 ES 日期可排序。
        newsList.sort(java.util.Comparator
                .comparingInt((News n) -> "1".equals(n.getTop()) ? 0 : 1)
                .thenComparing(News::getPublishDate, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())));
        fillAuthorAvatar(newsList);
        return newsList;
    }

    /** Batch-fill authors' uploaded avatars (one IN query; rows without an avatar stay null). */
    private void fillAuthorAvatar(List<NewsDto> newsList) {
        java.util.Set<String> authorIds = new java.util.HashSet<>();
        for (NewsDto n : newsList) {
            if (n != null && StringUtils.isNotBlank(n.getAuthorId())) {
                authorIds.add(n.getAuthorId());
            }
        }
        if (authorIds.isEmpty()) {
            return;
        }
        java.util.Map<String, DreamUser> userMap = new java.util.HashMap<>();
        for (DreamUser u : userMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<DreamUser>()
                .in("USER_ID", authorIds))) {
            userMap.put(u.getUserId(), u);
        }
        // 已认证球员作者：一把批查球员姓名（和评论区 fillVerifiedPlayer 同款）
        java.util.Set<String> playerIds = new java.util.HashSet<>();
        for (DreamUser u : userMap.values()) {
            if (com.dream.basketball.utils.Constants.IDENTIFICATION.equals(u.getPlayerIdentification())
                    && StringUtils.isNotBlank(u.getPlayerId())) {
                playerIds.add(u.getPlayerId());
            }
        }
        java.util.Map<String, String> playerNames = new java.util.HashMap<>();
        if (!playerIds.isEmpty()) {
            for (com.dream.basketball.entity.DreamPlayer p : playerService.listByIds(playerIds)) {
                playerNames.put(p.getPlayerId(), p.getPlayerName());
            }
        }
        for (NewsDto n : newsList) {
            if (n == null || StringUtils.isBlank(n.getAuthorId())) {
                continue;
            }
            DreamUser u = userMap.get(n.getAuthorId());
            if (u == null) {
                continue;
            }
            n.setAuthorAvatar(u.getAvatar());
            n.setAuthorSuperManager(com.dream.basketball.config.Role.fromUserRole(u.getUserRole())
                    == com.dream.basketball.config.Role.SUPER_MANAGER);
            if (com.dream.basketball.utils.Constants.IDENTIFICATION.equals(u.getPlayerIdentification())
                    && StringUtils.isNotBlank(u.getPlayerId())) {
                n.setAuthorVerifiedPlayerId(u.getPlayerId());
                n.setAuthorVerifiedPlayerName(playerNames.get(u.getPlayerId()));
            }
        }
    }

    /**
     * 全局搜索：标题前缀匹配加权 + 标题/正文/作者分词匹配，限定频道，按相关度取前 N。
     */
    @Override
    public List<News> searchNews(String keyword, String newsChannel, int size) {
        BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
        BoolQueryBuilder kw = new BoolQueryBuilder();
        kw.should(QueryBuilders.matchPhrasePrefixQuery("title", keyword).boost(3f));
        kw.should(QueryBuilders.matchQuery("title", keyword).boost(2f));
        kw.should(QueryBuilders.matchQuery("content", keyword));
        kw.should(QueryBuilders.matchQuery("author", keyword));
        kw.minimumShouldMatch(1);
        queryBuilder.must(kw);
        if (StringUtils.equals(NEWS_CHANNEL_FORUM, newsChannel)) {
            // 与列表查询同款：老文档没有 channel 字段，缺失视作论坛帖
            BoolQueryBuilder channel = new BoolQueryBuilder();
            channel.should(QueryBuilders.matchQuery("newsChannel", NEWS_CHANNEL_FORUM));
            channel.should(new BoolQueryBuilder().mustNot(QueryBuilders.existsQuery("newsChannel")));
            queryBuilder.must(channel);
        } else {
            queryBuilder.must(QueryBuilders.matchQuery("newsChannel", newsChannel));
        }
        NativeSearchQuery query = new NativeSearchQueryBuilder()
                .withQuery(queryBuilder)
                .withPageable(PageRequest.of(0, size))
                .build();
        List<News> result = new ArrayList<>();
        for (SearchHit<News> hit : template.search(query, News.class).getSearchHits()) {
            result.add(hit.getContent());
        }
        return result;
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
        fillVerifiedPlayer(dreamNewsCommentDtos);
        return dreamNewsCommentDtos;
    }

    /** 批量回填评论者信息（一把 IN 查询）：头像 + 已认证（IDENTIFICATION=1）的绑定球员 ID/姓名 */
    private void fillVerifiedPlayer(List<DreamNewsCommentDto> comments) {
        java.util.Set<String> userIds = new java.util.HashSet<>();
        for (DreamNewsCommentDto c : comments) {
            if (StringUtils.isNotBlank(c.getUserId())) {
                userIds.add(c.getUserId());
            }
        }
        if (userIds.isEmpty()) {
            return;
        }
        java.util.Map<String, DreamUser> users = new java.util.HashMap<>();
        for (DreamUser u : userMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<DreamUser>()
                .in("USER_ID", userIds))) {
            users.put(u.getUserId(), u);
        }
        // 认证者的球员姓名一把批查
        java.util.Set<String> playerIds = new java.util.HashSet<>();
        for (DreamUser u : users.values()) {
            if (com.dream.basketball.utils.Constants.IDENTIFICATION.equals(u.getPlayerIdentification())
                    && StringUtils.isNotBlank(u.getPlayerId())) {
                playerIds.add(u.getPlayerId());
            }
        }
        java.util.Map<String, String> playerNames = new java.util.HashMap<>();
        if (!playerIds.isEmpty()) {
            for (com.dream.basketball.entity.DreamPlayer p : playerService.listByIds(playerIds)) {
                playerNames.put(p.getPlayerId(), p.getPlayerName());
            }
        }
        for (DreamNewsCommentDto c : comments) {
            DreamUser u = users.get(c.getUserId());
            if (u == null) {
                continue;
            }
            c.setCommenterAvatar(u.getAvatar());
            c.setSuperManager(com.dream.basketball.config.Role.fromUserRole(u.getUserRole())
                    == com.dream.basketball.config.Role.SUPER_MANAGER);
            if (com.dream.basketball.utils.Constants.IDENTIFICATION.equals(u.getPlayerIdentification())
                    && StringUtils.isNotBlank(u.getPlayerId())) {
                c.setVerifiedPlayerId(u.getPlayerId());
                c.setVerifiedPlayerName(playerNames.get(u.getPlayerId()));
            }
        }
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
            if (StringUtils.isNotBlank(params.getNewsChannel())) {
                if (StringUtils.equals(NEWS_CHANNEL_FORUM, params.getNewsChannel())) {
                    // Legacy docs predate the channel field: treat a missing channel as forum,
                    // so old user posts keep showing without a data migration.
                    BoolQueryBuilder channel = new BoolQueryBuilder();
                    channel.should(QueryBuilders.matchQuery("newsChannel", NEWS_CHANNEL_FORUM));
                    channel.should(new BoolQueryBuilder().mustNot(QueryBuilders.existsQuery("newsChannel")));
                    queryBuilder.must(channel);
                } else {
                    queryBuilder.must(QueryBuilders.matchQuery("newsChannel", params.getNewsChannel()));
                }
            }
            // 专题过滤：列某个专题的帖子（topicId 是 keyword 精确匹配）
            if (StringUtils.isNotBlank(params.getTopicId())) {
                queryBuilder.must(QueryBuilders.termQuery("topicId", params.getTopicId()));
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
        try {
            DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
            DreamNews dreamNews = dreamNewsService.getById(newsId);
            if (dreamUser == null) {
                return handlerResultJson(false, "请先登录！");
            } else if (dreamNews == null){
                return handlerResultJson(false, "原帖已删除！");
            } else {
                String userId = dreamUser.getUserId();
                boolean whetherClicked = Boolean.TRUE.equals(stringRedisTemplate.opsForSet().isMember("good:user:" + userId + ":newsId:" + newsId, userId));
                // rabbitmq处理点赞
                rabbitMqProducer.newsActionRmq(newsId, userId, whetherClicked, dreamUser, dreamNews, "good");
                return likeResult(whetherClicked, whetherClicked ? "让我再看看这帖子质量怎么样" : "好帖，顶！");
            }
        } catch (Exception e){
            e.printStackTrace();
            return handlerResultJson(false, "后台出错！<br>" + e.getMessage());
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
            boolean whetherClicked = Boolean.TRUE.equals(stringRedisTemplate.opsForSet().isMember("bad:user:" + userId + ":newsId:" + newsId, userId));
            // rabbitmq处理点踩
            rabbitMqProducer.newsActionRmq(newsId, userId, whetherClicked, dreamUser, dreamNews, "bad");
            return likeResult(whetherClicked, whetherClicked ? "我觉得还可以再看看" : "什么垃圾帖子，滚！");
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
            boolean whetherClicked = Boolean.TRUE.equals(stringRedisTemplate.opsForSet().isMember("goodComment:user:" + userId + ":commentId:" + commentId, userId));
            // rabbitmq处理评论点赞
            rabbitMqProducer.commentActionRmq(commentId, userId, whetherClicked, dreamUser, dreamNewsComment, "good");
            return likeResult(whetherClicked, whetherClicked ? "你的想法尚且需要我三思" : "说得好！");
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
            boolean whetherClicked = Boolean.TRUE.equals(stringRedisTemplate.opsForSet().isMember("badComment:user:" + userId + ":commentId:" + commentId, userId));
            // rabbitmq处理评论点踩
            rabbitMqProducer.commentActionRmq(commentId, userId, whetherClicked, dreamUser, dreamNewsComment, "bad");
            return likeResult(whetherClicked, whetherClicked ? "好像说的也没那么离谱" : "我觉得这完全没道理");
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
        // 全局限制：被超管禁止发言的用户不能评论
        if (!userPerms.canComment(dreamUser.getUserId())) {
            return handlerResultJson(false, "你已被限制发言");
        }
        // 专题帖：评论要有该专题的发言权
        DreamNews postForGate = dreamNewsService.getById(dreamNewsComment.getNewsId());
        if (postForGate != null && StringUtils.isNotBlank(postForGate.getTopicId())
                && !topicPerms.canComment(dreamUser, topicPerms.getTopic(postForGate.getTopicId()))) {
            return handlerResultJson(false, "你在该专题没有评论权限");
        }
        dreamNewsComment.setCommentId(UUID.randomUUID().toString());
        dreamNewsComment.setUserId(dreamUser.getUserId());
        dreamNewsComment.setUserName(dreamUser.getUserNickname());
        dreamNewsComment.setAttachments(sanitizeAttachments(dreamNewsComment.getAttachments()));
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
        // @-mention 通知：评论里被 @ 到的人各发一条（排除自己，也排除刚收到评论/回复通知的 receiverId，避免重复打扰）
        for (String mentionedId : com.dream.basketball.utils.MentionUtil.parseCommentMentionIds(dreamNewsComment.getMentions())) {
            if (StringUtils.equals(mentionedId, dreamUser.getUserId()) || StringUtils.equals(mentionedId, receiverId)) {
                continue;
            }
            userInformationService.saveUserInformation(dreamUser.getUserId(), dreamUser.getUserNickname(), mentionedId,
                    MENTION_COMMENT, dreamNewsComment.getCommentId(), dreamNewsComment.getNewsId(),
                    dreamNewsComment.getCommentId(), level, dreamNewsComment.getContent(), "");
        }
        return handlerResultJson(true, "评论成功！");
    }

    /**
     * 清洗评论附件 JSON：只保留 url 指向本站上传目录的条目（挡掉伪造的外链 / javascript: URL）。
     * 返回过滤后的 JSON 数组字符串；无有效附件时返回 null。
     */
    private String sanitizeAttachments(String attachmentsJson) {
        if (org.apache.commons.lang3.StringUtils.isBlank(attachmentsJson)) {
            return null;
        }
        try {
            com.alibaba.fastjson.JSONArray arr = com.alibaba.fastjson.JSON.parseArray(attachmentsJson);
            com.alibaba.fastjson.JSONArray kept = new com.alibaba.fastjson.JSONArray();
            for (int i = 0; i < arr.size(); i++) {
                com.alibaba.fastjson.JSONObject o = arr.getJSONObject(i);
                if (o != null && com.dream.basketball.utils.FileUtils.isLocalUploadUrl(o.getString("url"))) {
                    kept.add(o);
                }
            }
            return kept.isEmpty() ? null : kept.toJSONString();
        } catch (Exception e) {
            return null;
        }
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
     * 点赞/点踩响应。点赞是切换：whetherClicked=该用户此前是否已点过。
     * 附带 delta（本次计数增量：已点过→取消=-1，未点过→点亮=+1）与 liked（点击后状态），
     * 供前端即时更新数字——计数本身经 MQ 异步落库，前端据 delta 乐观更新即可与之一致。
     */
    private Map<String, Object> likeResult(boolean whetherClicked, String msg) {
        Map<String, Object> map = new HashMap<>();
        map.put("result", true);
        map.put("msg", msg);
        map.put("liked", !whetherClicked);
        map.put("delta", whetherClicked ? -1 : 1);
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
