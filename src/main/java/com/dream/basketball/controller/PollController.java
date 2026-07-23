package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.config.TopicPermissionService;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumPollItem;
import com.dream.basketball.entity.ForumPollVote;
import com.dream.basketball.mapper.ForumPollItemMapper;
import com.dream.basketball.mapper.ForumPollVoteMapper;
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
 * Post polls ("投票") — same ownership/permission model as rating items (RatingController):
 * only the post author opens polls (one on the post at publish time, follow-ups via /openFloor
 * as new level-1 comments); any logged-in viewer votes for ONE option, revote = change;
 * per-option counts are public; super admin or the author deletes (votes cascade).
 */
@RestController
@RequestMapping("/poll")
public class PollController {

    private static final int SUBJECT_MAX = 30;
    private static final int OPTION_MAX_LEN = 20;
    private static final int OPTIONS_MIN = 2;
    private static final int OPTIONS_MAX = 10;
    private static final int ITEMS_PER_POST_MAX = 50;

    @Autowired
    private ForumPollItemMapper itemMapper;
    @Autowired
    private ForumPollVoteMapper voteMapper;
    @Autowired
    private DreamNewsService dreamNewsService;
    @Autowired
    private DreamNewsCommentService dreamNewsCommentService;
    @Autowired
    private NewsService newsService;
    @Autowired
    private TopicPermissionService topicPerms;

    /** 选项清洗：JSON 数组 → 去空/去重/截断校验；不合法返回 null */
    private List<String> parseOptions(String optionsJson) {
        if (StringUtils.isBlank(optionsJson)) {
            return null;
        }
        List<String> out = new ArrayList<>();
        try {
            for (Object o : JSON.parseArray(optionsJson)) {
                String s = o == null ? "" : o.toString().trim();
                if (!s.isEmpty() && s.length() <= OPTION_MAX_LEN && !out.contains(s)) {
                    out.add(s);
                }
            }
        } catch (Exception e) {
            return null;
        }
        return (out.size() < OPTIONS_MIN || out.size() > OPTIONS_MAX) ? null : out;
    }

    /** 发起投票（楼主）：commentId 为空=主贴项（发帖时调用）；否则必须是楼主自己发的该帖一级楼。 */
    @RequiresRole(Role.USER)
    @PostMapping("/create")
    public Object create(String newsId, String commentId, String subject, String options, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamNews news = StringUtils.isBlank(newsId) ? null : dreamNewsService.getById(newsId);
        if (news == null) {
            return new Result<>(1, "帖子不存在", null);
        }
        if (!StringUtils.equals(news.getAuthorId(), me.getUserId())) {
            return new Result<>(1, "只有楼主可以发起投票", null);
        }
        String sub = StringUtils.trimToEmpty(subject);
        if (sub.isEmpty() || sub.length() > SUBJECT_MAX) {
            return new Result<>(1, "投票主题需为 1-" + SUBJECT_MAX + " 字", null);
        }
        List<String> opts = parseOptions(options);
        if (opts == null) {
            return new Result<>(1, "选项需为 " + OPTIONS_MIN + "-" + OPTIONS_MAX + " 个、每个不超过 " + OPTION_MAX_LEN + " 字且互不重复", null);
        }
        if (StringUtils.isNotBlank(commentId)) {
            DreamNewsComment c = dreamNewsCommentService.getById(commentId);
            if (c == null || !StringUtils.equals(c.getNewsId(), newsId)
                    || !"1".equals(c.getLevel()) || !StringUtils.equals(c.getUserId(), me.getUserId())) {
                return new Result<>(1, "只能在你自己发的一级楼上发起投票", null);
            }
        }
        Integer already = itemMapper.selectCount(new QueryWrapper<ForumPollItem>().eq("NEWS_ID", newsId));
        if (already != null && already >= ITEMS_PER_POST_MAX) {
            return new Result<>(1, "该帖投票已达上限", null);
        }
        ForumPollItem item = new ForumPollItem();
        item.setItemId(UUID.randomUUID().toString());
        item.setNewsId(newsId);
        item.setCommentId(StringUtils.trimToNull(commentId));
        item.setSubject(sub);
        item.setOptions(JSON.toJSONString(opts));
        item.setCreateBy(me.getUserId());
        item.setCreateTime(new Date());
        itemMapper.insert(item);
        return new Result<>(0, "已发起投票", item.getItemId());
    }

    /** 楼主"在回复里继续发投票"：一步发一条一级楼（说明文字可空）+ 挂上投票项。 */
    @RequiresRole(Role.USER)
    @PostMapping("/openFloor")
    public Object openFloor(String newsId, String subject, String options, String content, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamNews news = StringUtils.isBlank(newsId) ? null : dreamNewsService.getById(newsId);
        if (news == null) {
            return new Result<>(1, "帖子不存在", null);
        }
        if (!StringUtils.equals(news.getAuthorId(), me.getUserId())) {
            return new Result<>(1, "只有楼主可以发起投票", null);
        }
        String sub = StringUtils.trimToEmpty(subject);
        if (sub.isEmpty() || sub.length() > SUBJECT_MAX) {
            return new Result<>(1, "投票主题需为 1-" + SUBJECT_MAX + " 字", null);
        }
        if (parseOptions(options) == null) {
            return new Result<>(1, "选项需为 " + OPTIONS_MIN + "-" + OPTIONS_MAX + " 个、每个不超过 " + OPTION_MAX_LEN + " 字且互不重复", null);
        }
        DreamNewsComment c = new DreamNewsComment();
        c.setNewsId(newsId);
        c.setContent(StringUtils.trimToEmpty(content));
        c.setLevel("1");
        Object commentResult = newsService.comment(c, request);
        if (commentResult instanceof Result && ((Result<?>) commentResult).getCode() != 0) {
            return commentResult;
        }
        return create(newsId, c.getCommentId(), sub, options, request);
    }

    /** 投票/改票（登录）：一人一票，再投=改选。锁定帖不能投；私密专题要有浏览权。 */
    @RequiresRole(Role.USER)
    @PostMapping("/vote")
    public Object vote(String itemId, Integer optionIndex, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumPollItem item = StringUtils.isBlank(itemId) ? null : itemMapper.selectById(itemId);
        if (item == null) {
            return new Result<>(1, "投票不存在", null);
        }
        List<String> opts;
        try {
            opts = JSON.parseArray(item.getOptions(), String.class);
        } catch (Exception e) {
            opts = new ArrayList<>();
        }
        if (optionIndex == null || optionIndex < 0 || optionIndex >= opts.size()) {
            return new Result<>(1, "选项不存在", null);
        }
        DreamNews news = dreamNewsService.getById(item.getNewsId());
        if (news == null) {
            return new Result<>(1, "帖子不存在", null);
        }
        if ("1".equals(news.getLocked())) {
            return new Result<>(1, "该帖已被锁定，暂不能投票", null);
        }
        if (StringUtils.isNotBlank(news.getTopicId())
                && !topicPerms.canView(me, topicPerms.getTopic(news.getTopicId()))) {
            return new Result<>(1, "你没有权限查看该专题的内容", null);
        }
        ForumPollVote v = voteMapper.selectOne(new QueryWrapper<ForumPollVote>()
                .eq("ITEM_ID", itemId).eq("USER_ID", me.getUserId()));
        if (v == null) {
            v = new ForumPollVote();
            v.setVoteId(UUID.randomUUID().toString());
            v.setItemId(itemId);
            v.setUserId(me.getUserId());
            v.setOptionIndex(optionIndex);
            v.setCreateTime(new Date());
            v.setUpdateTime(new Date());
            voteMapper.insert(v);
        } else {
            v.setOptionIndex(optionIndex);
            v.setUpdateTime(new Date());
            voteMapper.updateById(v);
        }
        Map<String, Object> agg = aggregate(Collections.singletonList(itemId)).get(itemId);
        Map<String, Object> out = agg == null ? new HashMap<>() : agg;
        out.put("myChoice", optionIndex);
        return new Result<>(0, "已投票", out);
    }

    /** 该帖全部投票项 + 每项各选项票数 + 我的选择（公开；私密专题帖要有浏览权）。 */
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
        List<ForumPollItem> items = itemMapper.selectList(new QueryWrapper<ForumPollItem>()
                .eq("NEWS_ID", newsId).orderByAsc("CREATE_TIME"));
        if (items.isEmpty()) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        List<String> ids = new ArrayList<>();
        for (ForumPollItem it : items) {
            ids.add(it.getItemId());
        }
        Map<String, Map<String, Object>> aggByItem = aggregate(ids);
        Map<String, Integer> mine = new HashMap<>();
        if (me != null) {
            for (ForumPollVote v : voteMapper.selectList(new QueryWrapper<ForumPollVote>()
                    .in("ITEM_ID", ids).eq("USER_ID", me.getUserId()))) {
                mine.put(v.getItemId(), v.getOptionIndex());
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (ForumPollItem it : items) {
            Map<String, Object> m = new HashMap<>();
            m.put("itemId", it.getItemId());
            m.put("commentId", it.getCommentId());
            m.put("subject", it.getSubject());
            List<String> opts;
            try {
                opts = JSON.parseArray(it.getOptions(), String.class);
            } catch (Exception e) {
                opts = new ArrayList<>();
            }
            m.put("options", opts);
            Map<String, Object> agg = aggByItem.get(it.getItemId());
            m.put("count", agg == null ? 0 : agg.get("count"));
            m.put("counts", agg == null ? new HashMap<>() : agg.get("counts"));
            m.put("myChoice", mine.get(it.getItemId()));
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /** 删投票（超管或楼主）：连带删票。 */
    @RequiresRole(Role.USER)
    @PostMapping("/delete")
    public Object delete(String itemId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumPollItem item = StringUtils.isBlank(itemId) ? null : itemMapper.selectById(itemId);
        if (item == null) {
            return new Result<>(1, "投票不存在", null);
        }
        DreamNews news = dreamNewsService.getById(item.getNewsId());
        boolean isSuper = Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER;
        boolean isAuthor = news != null && StringUtils.equals(news.getAuthorId(), me.getUserId());
        if (!isSuper && !isAuthor) {
            return new Result<>(1, "无权删除该投票", null);
        }
        voteMapper.delete(new QueryWrapper<ForumPollVote>().eq("ITEM_ID", itemId));
        itemMapper.deleteById(itemId);
        return new Result<>(0, "已删除", null);
    }

    /** 批量聚合：itemId → {count(总票数), counts{选项下标: 票数}} */
    private Map<String, Map<String, Object>> aggregate(List<String> itemIds) {
        Map<String, Map<String, Object>> byItem = new HashMap<>();
        if (itemIds.isEmpty()) {
            return byItem;
        }
        for (Map<String, Object> row : voteMapper.selectMaps(new QueryWrapper<ForumPollVote>()
                .select("ITEM_ID AS itemId", "OPTION_INDEX AS idx", "COUNT(*) AS cnt")
                .in("ITEM_ID", itemIds).groupBy("ITEM_ID", "OPTION_INDEX"))) {
            String id = String.valueOf(row.get("itemId"));
            int idx = ((Number) row.get("idx")).intValue();
            int cnt = ((Number) row.get("cnt")).intValue();
            Map<String, Object> agg = byItem.computeIfAbsent(id, (k) -> {
                Map<String, Object> a = new HashMap<>();
                a.put("count", 0);
                a.put("counts", new HashMap<Integer, Integer>());
                return a;
            });
            agg.put("count", (int) agg.get("count") + cnt);
            @SuppressWarnings("unchecked")
            Map<Integer, Integer> counts = (Map<Integer, Integer>) agg.get("counts");
            counts.put(idx, cnt);
        }
        return byItem;
    }
}
