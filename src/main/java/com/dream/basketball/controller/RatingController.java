package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.config.TopicPermissionService;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumRatingItem;
import com.dream.basketball.entity.ForumRatingVote;
import com.dream.basketball.mapper.ForumRatingItemMapper;
import com.dream.basketball.mapper.ForumRatingVoteMapper;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Post rating items ("为 XX 打分", 1-5 stars) for forum posts and official news.
 * Only the post author opens items — one on the post itself (set when publishing) and
 * follow-ups attached to level-1 comments the author posts (/openFloor). Anyone logged in
 * who can view the post votes; one vote per user per item, revotes update. Aggregates
 * (avg/count/star distribution) are public. Super admin (or the author) may delete an item.
 */
@RestController
@RequestMapping("/rating")
public class RatingController {

    private static final int SUBJECT_MAX = 30;
    private static final int ITEMS_PER_POST_MAX = 50;

    @Autowired
    private ForumRatingItemMapper itemMapper;
    @Autowired
    private ForumRatingVoteMapper voteMapper;
    @Autowired
    private DreamNewsService dreamNewsService;
    @Autowired
    private DreamNewsCommentService dreamNewsCommentService;
    @Autowired
    private NewsService newsService;
    @Autowired
    private TopicPermissionService topicPerms;

    /** 打分对象配图：只收 http(s)/站内相对路径（与评论附件同规则，挡 javascript: 之类），超长/不合法一律置空 */
    private String sanitizeImageUrl(String imageUrl) {
        String url = StringUtils.trimToNull(imageUrl);
        if (url == null || url.length() > 255 || !url.matches("^(https?://|/).*")) {
            return null;
        }
        return url;
    }

    /** 开打分项（楼主）：commentId 为空=主贴项（发帖时调用）；否则必须是楼主自己发的该帖一级楼。 */
    @RequiresRole(Role.USER)
    @PostMapping("/create")
    public Object create(String newsId, String commentId, String subject, String imageUrl, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamNews news = StringUtils.isBlank(newsId) ? null : dreamNewsService.getById(newsId);
        if (news == null) {
            return new Result<>(1, "帖子不存在", null);
        }
        if (!StringUtils.equals(news.getAuthorId(), me.getUserId())) {
            return new Result<>(1, "只有楼主可以开启打分", null);
        }
        String sub = StringUtils.trimToEmpty(subject);
        if (sub.isEmpty()) {
            return new Result<>(1, "请填写打分对象", null);
        }
        if (sub.length() > SUBJECT_MAX) {
            return new Result<>(1, "打分对象不能超过 " + SUBJECT_MAX + " 字", null);
        }
        if (StringUtils.isNotBlank(commentId)) {
            DreamNewsComment c = dreamNewsCommentService.getById(commentId);
            if (c == null || !StringUtils.equals(c.getNewsId(), newsId)
                    || !"1".equals(c.getLevel()) || !StringUtils.equals(c.getUserId(), me.getUserId())) {
                return new Result<>(1, "只能在你自己发的一级楼上开启打分", null);
            }
        }
        Integer already = itemMapper.selectCount(new QueryWrapper<ForumRatingItem>().eq("NEWS_ID", newsId));
        if (already != null && already >= ITEMS_PER_POST_MAX) {
            return new Result<>(1, "该帖打分项已达上限", null);
        }
        ForumRatingItem item = new ForumRatingItem();
        item.setItemId(UUID.randomUUID().toString());
        item.setNewsId(newsId);
        item.setCommentId(StringUtils.trimToNull(commentId));
        item.setSubject(sub);
        item.setImageUrl(sanitizeImageUrl(imageUrl));
        item.setCreateBy(me.getUserId());
        item.setCreateTime(new Date());
        itemMapper.insert(item);
        return new Result<>(0, "已开启打分", item.getItemId());
    }

    /**
     * 楼主"在回复里继续开打分"：一步发一条一级楼（说明文字可空）+ 挂上打分项。
     * 评论本身走 newsService.comment()（禁言/锁定/专题发言权都在里面兜），失败原样透传。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/openFloor")
    public Object openFloor(String newsId, String subject, String content, String imageUrl, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamNews news = StringUtils.isBlank(newsId) ? null : dreamNewsService.getById(newsId);
        if (news == null) {
            return new Result<>(1, "帖子不存在", null);
        }
        if (!StringUtils.equals(news.getAuthorId(), me.getUserId())) {
            return new Result<>(1, "只有楼主可以开启打分", null);
        }
        String sub = StringUtils.trimToEmpty(subject);
        if (sub.isEmpty() || sub.length() > SUBJECT_MAX) {
            return new Result<>(1, "打分对象需为 1-" + SUBJECT_MAX + " 字", null);
        }
        DreamNewsComment c = new DreamNewsComment();
        c.setNewsId(newsId);
        c.setContent(StringUtils.trimToEmpty(content));
        c.setLevel("1");
        Object commentResult = newsService.comment(c, request);
        // comment() 返回统一 Result；非 0 直接把失败原因透传给前端
        if (commentResult instanceof Result && ((Result<?>) commentResult).getCode() != 0) {
            return commentResult;
        }
        // comment() 把生成的 commentId 写回了同一个实体，据此挂打分项
        return create(newsId, c.getCommentId(), sub, imageUrl, request);
    }

    /** 打分/改分（登录）：1-5 星，一人一票，再打=改分。锁定帖不能再打；私密专题要有浏览权。 */
    @RequiresRole(Role.USER)
    @PostMapping("/vote")
    public Object vote(String itemId, Integer score, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumRatingItem item = StringUtils.isBlank(itemId) ? null : itemMapper.selectById(itemId);
        if (item == null) {
            return new Result<>(1, "打分项不存在", null);
        }
        if (score == null || score < 1 || score > 5) {
            return new Result<>(1, "分数需为 1-5 星", null);
        }
        DreamNews news = dreamNewsService.getById(item.getNewsId());
        if (news == null) {
            return new Result<>(1, "帖子不存在", null);
        }
        if ("1".equals(news.getLocked())) {
            return new Result<>(1, "该帖已被锁定，暂不能打分", null);
        }
        if (StringUtils.isNotBlank(news.getTopicId())
                && !topicPerms.canView(me, topicPerms.getTopic(news.getTopicId()))) {
            return new Result<>(1, "你没有权限查看该专题的内容", null);
        }
        ForumRatingVote v = voteMapper.selectOne(new QueryWrapper<ForumRatingVote>()
                .eq("ITEM_ID", itemId).eq("USER_ID", me.getUserId()));
        if (v == null) {
            v = new ForumRatingVote();
            v.setVoteId(UUID.randomUUID().toString());
            v.setItemId(itemId);
            v.setUserId(me.getUserId());
            v.setScore(score);
            v.setCreateTime(new Date());
            v.setUpdateTime(new Date());
            voteMapper.insert(v);
        } else {
            v.setScore(score);
            v.setUpdateTime(new Date());
            voteMapper.updateById(v);
        }
        // 回传该项最新聚合，前端局部刷新
        Map<String, Object> agg = aggregate(Collections.singletonList(itemId)).get(itemId);
        Map<String, Object> out = agg == null ? new HashMap<>() : agg;
        out.put("myScore", score);
        return new Result<>(0, "已打分", out);
    }

    /** 该帖全部打分项 + 聚合 + 我的分（公开；私密专题帖要有浏览权）。 */
    @GetMapping("/list")
    public Object list(String newsId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamNews news = StringUtils.isBlank(newsId) ? null : dreamNewsService.getById(newsId);
        if (news == null) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        if (StringUtils.isNotBlank(news.getTopicId())
                && !topicPerms.canView(me, topicPerms.getTopic(news.getTopicId()))) {
            return new Result<>(1, "你没有权限查看该专题的内容", null);
        }
        List<ForumRatingItem> items = itemMapper.selectList(new QueryWrapper<ForumRatingItem>()
                .eq("NEWS_ID", newsId).orderByAsc("CREATE_TIME"));
        if (items.isEmpty()) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        List<String> ids = new ArrayList<>();
        for (ForumRatingItem it : items) {
            ids.add(it.getItemId());
        }
        Map<String, Map<String, Object>> aggByItem = aggregate(ids);
        // 我的分（登录时一把查）
        Map<String, Integer> mine = new HashMap<>();
        if (me != null) {
            for (ForumRatingVote v : voteMapper.selectList(new QueryWrapper<ForumRatingVote>()
                    .in("ITEM_ID", ids).eq("USER_ID", me.getUserId()))) {
                mine.put(v.getItemId(), v.getScore());
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (ForumRatingItem it : items) {
            Map<String, Object> m = new HashMap<>();
            m.put("itemId", it.getItemId());
            m.put("commentId", it.getCommentId());
            m.put("subject", it.getSubject());
            m.put("imageUrl", it.getImageUrl());
            Map<String, Object> agg = aggByItem.get(it.getItemId());
            m.put("avg", agg == null ? 0 : agg.get("avg"));
            m.put("count", agg == null ? 0 : agg.get("count"));
            m.put("dist", agg == null ? new HashMap<>() : agg.get("dist"));
            m.put("myScore", mine.get(it.getItemId()));
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /** 删打分项（超管或楼主）：连带删票。 */
    @RequiresRole(Role.USER)
    @PostMapping("/delete")
    public Object delete(String itemId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumRatingItem item = StringUtils.isBlank(itemId) ? null : itemMapper.selectById(itemId);
        if (item == null) {
            return new Result<>(1, "打分项不存在", null);
        }
        DreamNews news = dreamNewsService.getById(item.getNewsId());
        boolean isSuper = Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER;
        boolean isAuthor = news != null && StringUtils.equals(news.getAuthorId(), me.getUserId());
        if (!isSuper && !isAuthor) {
            return new Result<>(1, "无权删除该打分项", null);
        }
        voteMapper.delete(new QueryWrapper<ForumRatingVote>().eq("ITEM_ID", itemId));
        itemMapper.deleteById(itemId);
        return new Result<>(0, "已删除", null);
    }

    /** 批量聚合：itemId → {avg(1位小数), count, dist{1..5:人数}} */
    private Map<String, Map<String, Object>> aggregate(List<String> itemIds) {
        Map<String, Map<String, Object>> byItem = new HashMap<>();
        if (itemIds.isEmpty()) {
            return byItem;
        }
        for (Map<String, Object> row : voteMapper.selectMaps(new QueryWrapper<ForumRatingVote>()
                .select("ITEM_ID AS itemId", "SCORE AS score", "COUNT(*) AS cnt")
                .in("ITEM_ID", itemIds).groupBy("ITEM_ID", "SCORE"))) {
            String id = String.valueOf(row.get("itemId"));
            int score = ((Number) row.get("score")).intValue();
            int cnt = ((Number) row.get("cnt")).intValue();
            Map<String, Object> agg = byItem.computeIfAbsent(id, (k) -> {
                Map<String, Object> a = new HashMap<>();
                a.put("count", 0);
                a.put("sum", 0);
                a.put("dist", new HashMap<Integer, Integer>());
                return a;
            });
            agg.put("count", (int) agg.get("count") + cnt);
            agg.put("sum", (int) agg.get("sum") + score * cnt);
            @SuppressWarnings("unchecked")
            Map<Integer, Integer> dist = (Map<Integer, Integer>) agg.get("dist");
            dist.put(score, cnt);
        }
        for (Map<String, Object> agg : byItem.values()) {
            int count = (int) agg.get("count");
            int sum = (int) agg.get("sum");
            agg.put("avg", count == 0 ? 0 : Math.round(sum * 10.0 / count) / 10.0);
            agg.remove("sum");
        }
        return byItem;
    }
}
