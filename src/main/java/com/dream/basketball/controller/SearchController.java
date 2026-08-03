package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.NewsService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.dream.basketball.utils.Constants.NEWS_CHANNEL_FORUM;
import static com.dream.basketball.utils.Constants.NEWS_CHANNEL_OFFICIAL;

/**
 * 全局搜索（公开）：一个关键词同时模糊查 球员 / 新闻 / 资讯帖 / 用户，
 * 各取前几条供顶栏搜索面板分组展示。
 */
@RestController
@RequestMapping("/search")
public class SearchController {

    @Autowired
    private NewsService newsService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private com.dream.basketball.config.TopicPermissionService topicPerms;

    @Autowired
    private com.dream.basketball.mapper.UserRemarkMapper remarkMapper;

    @Autowired
    private com.dream.basketball.mapper.DreamNewsMapper dreamNewsMapper;

    @Autowired
    private com.dream.basketball.mapper.ForumTopicMapper forumTopicMapper;

    @Autowired
    private com.dream.basketball.mapper.PlayerMapper playerMapper;

    @Autowired
    private com.dream.basketball.config.UserPermService userPerms;

    private static final int GROUP_LIMIT = 6;

    @GetMapping("/global")
    public Result<Map<String, Object>> global(String keyword, javax.servlet.http.HttpServletRequest request) {
        Map<String, Object> data = new HashMap<>();
        String kw = keyword == null ? "" : keyword.trim();
        if (StringUtils.isBlank(kw) || kw.length() > 50) {
            return new Result<>(0, "成功", data);
        }

        // 只搜「对本人开放的功能」范围内的内容：某模块被超管关掉，其内容不进搜索结果（否则搜到却点不动）。
        // 实时读库拿开关（session 里是登录快照）；未登录=公开可搜全部；超管全放行。
        DreamUser me = com.dream.basketball.utils.SecUtil.getLoginUserToSession(request);
        DreamUser meFresh = me == null ? null : userMapper.selectById(me.getUserId());
        boolean isSuper = meFresh != null
                && com.dream.basketball.config.Role.fromUserRole(meFresh.getUserRole()) == com.dream.basketball.config.Role.SUPER_MANAGER;
        // NBA 是「默认关、超管放行」，与下面两项相反：未登录也搜不到球员（模块本身就不对游客开放）
        boolean featData = isSuper || com.dream.basketball.config.Feature.NBA_DATA.granted(meFresh);
        boolean featForum = meFresh == null || isSuper || !"0".equals(meFresh.getFeatForum()); // 百家说：论坛帖
        // 官方新闻整站关闭中：不管谁搜都不返回（Constants.NEWS_MODULE_ENABLED）
        boolean featNews = com.dream.basketball.utils.Constants.NEWS_MODULE_ENABLED
                && (meFresh == null || isSuper || !"0".equals(meFresh.getFeatNews()));

        // 球员：中文名 / 英文名 / 外号模糊（仅当 Dream Union 对本人开放）。
        // 走的是发帖 @球员 那条 mapper——名次规则（整名或外号精确的排最前，其余按生涯总得分）
        // 全站只能有一份。这儿原来是自己拼的无序 limit 6：搜"詹姆斯"（命中 37 人）勒布朗排第三，
        // 搜"库里"斯蒂芬排第四，而 @球员 那条早把这个坑填了，只是没人把两边并起来。
        List<Map<String, Object>> players = featData
                ? playerMapper.searchMentionPlayers(kw, GROUP_LIMIT)
                : new ArrayList<>();
        data.put("players", players);

        // 新闻 / 资讯：ES 相关度前 N（标题前缀加权）。论坛结果滤掉无权浏览的私密/不可见专题帖（防泄露）
        java.util.Set<String> hidden = topicPerms.hiddenTopicIds(me);
        hidden.addAll(topicPerms.unlistedTopicIds()); // 不可见专题：帖子对所有人都不进搜索
        // 隐藏帖：搜索里对所有人都不出现（管理者从专题列表管；ES 里没有 HIDDEN 字段，按 id 集合滤）
        java.util.Set<String> hiddenIds = new java.util.HashSet<>();
        for (com.dream.basketball.entity.DreamNews dn : dreamNewsMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.dream.basketball.entity.DreamNews>()
                        .select("NEWS_ID").eq("HIDDEN", "1"))) {
            hiddenIds.add(dn.getNewsId());
        }
        // 论坛帖：仅当「百家说」对本人开放
        List<News> forum = new ArrayList<>();
        if (featForum) {
            forum = newsService.searchNews(kw, NEWS_CHANNEL_FORUM, GROUP_LIMIT + hidden.size() + hiddenIds.size());
            forum = forum.stream()
                    .filter(n -> hidden.isEmpty() || n.getTopicId() == null || !hidden.contains(n.getTopicId()))
                    .filter(n -> !hiddenIds.contains(n.getNewsId()))
                    .collect(java.util.stream.Collectors.toList());
            if (forum.size() > GROUP_LIMIT) {
                forum = forum.subList(0, GROUP_LIMIT);
            }
        }
        // 官方新闻：仅当「新闻」对本人开放
        List<News> official = new ArrayList<>();
        if (featNews) {
            official = newsService.searchNews(kw, NEWS_CHANNEL_OFFICIAL, GROUP_LIMIT + hiddenIds.size());
            official = official.stream().filter(n -> !hiddenIds.contains(n.getNewsId())).collect(java.util.stream.Collectors.toList());
            if (official.size() > GROUP_LIMIT) {
                official = official.subList(0, GROUP_LIMIT);
            }
        }
        data.put("news", slimNews(official));
        data.put("forum", slimNews(forum));

        // 专题：名称/简介模糊（仅当「百家说」开放）。下架(LISTED='0')的绝对不进搜索；
        // 私密专题照常可搜（与专题列表行为一致，点进去才看权限）。
        List<Map<String, Object>> topics = new ArrayList<>();
        if (featForum) {
            for (com.dream.basketball.entity.ForumTopic t : forumTopicMapper.selectList(
                    new QueryWrapper<com.dream.basketball.entity.ForumTopic>()
                            .and(w -> w.like("NAME", kw).or().like("DESCRIPTION", kw))
                            .apply("(LISTED IS NULL OR LISTED <> '0')")
                            .last("limit " + GROUP_LIMIT))) {
                Map<String, Object> m = new HashMap<>();
                m.put("topicId", t.getTopicId());
                m.put("name", t.getName());
                m.put("description", t.getDescription());
                m.put("visibility", t.getVisibility());
                topics.add(m);
            }
        }
        data.put("topics", topics);

        // 用户：用户名/昵称模糊，外加**我给别人起的备注名**——备注在前端替换显示，
        // 搜索却只认真名的话，屏幕上写着「阿明」却搜不到，等于备注只做了一半
        java.util.Set<String> remarkHitIds = remarkTargetIds(request, kw);
        List<Map<String, Object>> users = new ArrayList<>();
        java.util.Set<String> seenUserIds = new java.util.HashSet<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>()
                .and(w -> w.like("USER_NAME", kw).or().like("USER_NICKNAME", kw))
                .last("limit " + GROUP_LIMIT))) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userName", u.getUserName());
            m.put("userNickname", u.getUserNickname());
            users.add(m);
            seenUserIds.add(u.getUserId());
        }
        for (String hitId : remarkHitIds) {
            if (seenUserIds.contains(hitId) || users.size() >= GROUP_LIMIT) {
                continue;
            }
            DreamUser u = userMapper.selectById(hitId);
            if (u == null) {
                continue;
            }
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userName", u.getUserName());
            m.put("userNickname", u.getUserNickname());
            users.add(m);
        }
        data.put("users", users);

        return new Result<>(0, "成功", data);
    }

    /**
     * 热帖榜（公开）：全站论坛帖按热度取前 N，给整页搜索的落地内容用
     * （还没输入关键词时，总得有点东西可看）。
     *
     * <p>热度口径与右栏热榜完全一致：{@code 点赞×2 + 评论×3}。抄一份系数很容易两边跑偏，
     * 但这里是 SQL 排序、那边是前端 sort，天然没法共用一个函数——所以两处都写了注释互相指认。
     *
     * <p><b>可见范围</b>：这是一个「跨专题的公开展示位」，沿用首页热榜那条既定规则——
     * 私密专题与已下架（LISTED='0'）专题的帖子对<b>所有人</b>都不出现，包括题主和超管本人。
     * 比"按本人权限过滤"更严，好处是这块位置的内容对谁都一样，不会因为看的人不同而泄露
     * "某个私密专题里有一篇很火的帖"这件事本身。隐藏帖与草稿同样排除。
     */
    @GetMapping("/hotPosts")
    public Result<List<Map<String, Object>>> hotPosts(Integer limit, javax.servlet.http.HttpServletRequest request) {
        int n = limit == null || limit < 1 ? 10 : Math.min(limit, 30);
        List<Map<String, Object>> out = new ArrayList<>();

        DreamUser me = com.dream.basketball.utils.SecUtil.getLoginUserToSession(request);
        // 被限制浏览的用户：论坛内容一条都不给
        if (me != null && !userPerms.canBrowse(me.getUserId())) {
            return new Result<>(0, "成功", out);
        }
        DreamUser meFresh = me == null ? null : userMapper.selectById(me.getUserId());
        boolean isSuper = meFresh != null
                && com.dream.basketball.config.Role.fromUserRole(meFresh.getUserRole()) == com.dream.basketball.config.Role.SUPER_MANAGER;
        // 百家说被关掉的用户看不到热帖榜（和 /global 里 featForum 的判断同一套）
        if (!(meFresh == null || isSuper || !"0".equals(meFresh.getFeatForum()))) {
            return new Result<>(0, "成功", out);
        }

        java.util.Set<String> exclude = topicPerms.privateTopicIds();
        exclude.addAll(topicPerms.unlistedTopicIds());

        QueryWrapper<com.dream.basketball.entity.DreamNews> qw =
                new QueryWrapper<com.dream.basketball.entity.DreamNews>()
                        .eq("NEWS_CHANNEL", NEWS_CHANNEL_FORUM)
                        // HIDDEN / DRAFT 老数据可能是 NULL，只写 <>'1' 会把 NULL 行一起筛掉（NULL 比较结果是 NULL）
                        .and(w -> w.isNull("HIDDEN").or().ne("HIDDEN", "1"))
                        .and(w -> w.isNull("DRAFT").or().ne("DRAFT", "1"));
        if (!exclude.isEmpty()) {
            qw.and(w -> w.isNull("TOPIC_ID").or().notIn("TOPIC_ID", exclude));
        }
        // 排序表达式不能走 orderByDesc（它按列名处理），只能整段拼在 last 里。
        // n 是 int，拼进去没有注入面。
        //
        // 最后那道 NEWS_ID 不是凑数的：PUBLISH_DATE 是 **date** 不是 datetime，
        // 同一天发的帖子在前两个条件上完全打平（实测有 30 篇同日、热度都是 0）。
        // 不给一个稳定的兜底，同一份榜单每次刷新的顺序都可能不一样。
        qw.last("order by (ifnull(GOOD_NUM,0)*2 + ifnull(COMMENT_NUM,0)*3) desc, PUBLISH_DATE desc, NEWS_ID desc limit " + n);
        List<com.dream.basketball.entity.DreamNews> rows = dreamNewsMapper.selectList(qw);

        // 专题名一把查完再分发：榜单最多 30 条，逐条 selectById 就是 30 次往返
        java.util.Set<String> tids = new java.util.HashSet<>();
        for (com.dream.basketball.entity.DreamNews r : rows) {
            if (StringUtils.isNotBlank(r.getTopicId())) {
                tids.add(r.getTopicId());
            }
        }
        Map<String, String> topicName = new HashMap<>();
        if (!tids.isEmpty()) {
            for (com.dream.basketball.entity.ForumTopic t : forumTopicMapper.selectList(
                    new QueryWrapper<com.dream.basketball.entity.ForumTopic>().in("TOPIC_ID", tids))) {
                topicName.put(t.getTopicId(), t.getName());
            }
        }
        for (com.dream.basketball.entity.DreamNews r : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("newsId", r.getNewsId());
            m.put("title", r.getTitle());
            m.put("author", r.getAuthor());
            m.put("goodNum", r.getGoodNum() == null ? 0 : r.getGoodNum());
            m.put("commentNum", r.getCommentNum() == null ? 0 : r.getCommentNum());
            m.put("topicId", r.getTopicId());
            m.put("topicName", topicName.get(r.getTopicId()));
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /**
     * @-mention 候选（公开）：按昵称/用户名模糊，回 id/昵称/头像，供评论框与富文本编辑器的 @ 下拉用。
     * 比 /global 轻——只查用户表，不跑球员/ES 查询，适合边打字边搜。
     */
    @GetMapping("/mentionUsers")
    public Result<List<Map<String, Object>>> mentionUsers(String keyword,
                                                          javax.servlet.http.HttpServletRequest request) {
        List<Map<String, Object>> users = new ArrayList<>();
        String kw = keyword == null ? "" : keyword.trim();
        if (kw.length() > 50) {
            return new Result<>(0, "成功", users);
        }
        QueryWrapper<DreamUser> qw = new QueryWrapper<>();
        if (StringUtils.isNotBlank(kw)) {
            qw.and(w -> w.like("USER_NICKNAME", kw).or().like("USER_NAME", kw));
        }
        // 关键词为空时给一批用户垫底（刚打 @ 还没输入时有东西可选）
        qw.last("limit 8");
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (DreamUser u : userMapper.selectList(qw)) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userNickname", u.getUserNickname());
            m.put("avatar", u.getAvatar());
            users.add(m);
            seen.add(u.getUserId());
        }
        // 还要认**我给别人起的备注名**：加成员、@ 联想这些地方屏幕上显示的就是备注名，
        // 只匹配真名的话，看得见却搜不出来
        for (String targetId : remarkTargetIds(request, kw)) {
            if (seen.contains(targetId) || users.size() >= 8) {
                continue;
            }
            DreamUser u = userMapper.selectById(targetId);
            if (u == null) {
                continue;
            }
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userNickname", u.getUserNickname());
            m.put("avatar", u.getAvatar());
            users.add(m);
        }
        return new Result<>(0, "成功", users);
    }

    /**
     * @-mention 候选·球员（公开）：NBA 专区发帖时 @ 球员用，按中/英文名模糊。
     * 和 mentionUsers 分成两个接口而不是合一个：调用方只在 NBA 专区开这个面板，
     * 混着回用户会让"@ 出来的到底是谁"变得不确定。
     */
    @GetMapping("/mentionPlayers")
    public Result<List<Map<String, Object>>> mentionPlayers(String keyword,
                                                            javax.servlet.http.HttpServletRequest request) {
        String kw = keyword == null ? "" : keyword.trim();
        // 没被放行 NBA 模块的人也能进 NBA 专区发帖，但 @ 不出球员——@ 出来的金标点进去是资料卡，
        // 他本来就进不去。这里静默返回空列表而不是 403：@ 面板每敲一个字都会调，弹一串「权限不足」很吵
        DreamUser me = com.dream.basketball.utils.SecUtil.getLoginUserToSession(request);
        DreamUser meFresh = me == null ? null : userMapper.selectById(me.getUserId());
        boolean isSuper = meFresh != null
                && com.dream.basketball.config.Role.fromUserRole(meFresh.getUserRole()) == com.dream.basketball.config.Role.SUPER_MANAGER;
        if (kw.length() > 50 || !(isSuper || com.dream.basketball.config.Feature.NBA_DATA.granted(meFresh))) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        return new Result<>(0, "成功", playerMapper.searchMentionPlayers(kw, 8));
    }

    /** 当前登录用户的备注里，备注名命中 kw 的那些目标用户 id（未登录/空词返回空集）。 */
    private java.util.Set<String> remarkTargetIds(javax.servlet.http.HttpServletRequest request, String kw) {
        java.util.Set<String> out = new java.util.HashSet<>();
        DreamUser viewer = com.dream.basketball.utils.SecUtil.getLoginUserToSession(request);
        if (viewer == null || StringUtils.isBlank(kw)) {
            return out;
        }
        for (com.dream.basketball.entity.UserRemark r : remarkMapper.selectList(
                new QueryWrapper<com.dream.basketball.entity.UserRemark>()
                        .eq("OWNER_ID", viewer.getUserId()).like("REMARK", kw))) {
            out.add(r.getTargetId());
        }
        return out;
    }

    /** 只保留面板需要的字段，避免整篇正文进响应 */
    private List<Map<String, Object>> slimNews(List<News> list) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (News n : list) {
            Map<String, Object> m = new HashMap<>();
            m.put("newsId", n.getNewsId());
            m.put("title", n.getTitle());
            m.put("author", n.getAuthor());
            m.put("publishDate", n.getPublishDate());
            out.add(m);
        }
        return out;
    }
}
