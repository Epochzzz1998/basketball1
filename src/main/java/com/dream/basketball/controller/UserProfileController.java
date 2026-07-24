package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.DreamNewsCommentMapper;
import com.dream.basketball.mapper.DreamNewsMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.PasswordUtil;
import com.dream.basketball.utils.SecUtil;
import com.dream.basketball.utils.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 用户空间：公开主页聚合 + 本人资料编辑。
 */
@RestController
@RequestMapping("/user")
public class UserProfileController {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private DreamNewsMapper dreamNewsMapper;

    @Autowired
    private DreamNewsCommentMapper dreamNewsCommentMapper;

    @Autowired
    private com.dream.basketball.mapper.UserFollowMapper followMapper;

    @Autowired
    private com.dream.basketball.mapper.UserBlockMapper blockMapper;

    @Autowired
    private com.dream.basketball.mapper.NewsFavoriteMapper favoriteMapper;

    @Autowired
    private com.dream.basketball.mapper.ForumTopicMapper forumTopicMapper;

    @Autowired
    private com.dream.basketball.config.TopicPermissionService topicPerms;

    @Value("${picPath.uploadPath:}")
    private String uploadPath;

    private static final int LIST_LIMIT = 100;

    /* ==================== 公开主页 ==================== */

    @GetMapping("/profile")
    public Result<Map<String, Object>> profile(String userId, HttpServletRequest request) {
        DreamUser u = StringUtils.isBlank(userId) ? null : userMapper.selectById(userId);
        if (u == null) {
            return new Result<>(1, "用户不存在", null);
        }

        // 隐私：本人看自己不隐藏；他人看时按开关隐藏发帖/评论列表
        String me = SecUtil.getLoginUserIdToSession(request);
        boolean isOwner = StringUtils.isNotBlank(me) && me.equals(userId);
        boolean hidePosts = "1".equals(u.getHidePosts()) && !isOwner;
        boolean hideComments = "1".equals(u.getHideComments()) && !isOwner;
        boolean hideFavorites = "1".equals(u.getHideFavorites()) && !isOwner;

        Map<String, Object> user = new HashMap<>();
        user.put("userId", u.getUserId());
        user.put("userName", u.getUserName());
        user.put("userNickname", u.getUserNickname());
        user.put("userRole", u.getUserRole());
        user.put("avatar", u.getAvatar());
        user.put("titles", u.getTitles()); // 头衔（逗号分隔），主页展示在名字旁
        user.put("registTime", u.getRegistTime());
        user.put("lastLoginTime", u.getLastLoginTime());
        // 原始隐藏开关（本人视角用来回显开关状态）
        user.put("hidePosts", "1".equals(u.getHidePosts()));
        user.put("hideComments", "1".equals(u.getHideComments()));
        user.put("hideFollows", "1".equals(u.getHideFollows()));
        user.put("hideFavorites", "1".equals(u.getHideFavorites()));
        user.put("pmPolicy", u.getPmPolicy());

        // 帖子（官方+论坛都算，最新在前，取前 N；计数/获赞用全量聚合）。本人隐私隐藏时不下发列表；
        // 被题主/管理者隐藏(HIDDEN)的帖，他人视角也不出现在足迹里（本人仍可见自己的）。
        QueryWrapper<DreamNews> postsQw = new QueryWrapper<DreamNews>().eq("AUTHOR_ID", userId);
        if (!isOwner) {
            postsQw.ne("HIDDEN", "1");
        }
        postsQw.orderByDesc("PUBLISH_DATE").last("limit " + LIST_LIMIT);
        List<DreamNews> posts = hidePosts ? new ArrayList<>() : dreamNewsMapper.selectList(postsQw);
        // 论坛帖标出所属话题名（批量查一次）；官方新闻无话题
        Map<String, String> topicNameMap = new HashMap<>();
        List<String> postTopicIds = posts.stream().map(DreamNews::getTopicId)
                .filter(StringUtils::isNotBlank).distinct().collect(Collectors.toList());
        if (!postTopicIds.isEmpty()) {
            for (com.dream.basketball.entity.ForumTopic t : forumTopicMapper.selectBatchIds(postTopicIds)) {
                topicNameMap.put(t.getTopicId(), t.getName());
            }
        }
        List<Map<String, Object>> postList = new ArrayList<>();
        for (DreamNews n : posts) {
            Map<String, Object> m = new HashMap<>();
            m.put("newsId", n.getNewsId());
            m.put("title", n.getTitle());
            m.put("publishDate", n.getPublishDate());
            m.put("goodNum", n.getGoodNum());
            m.put("commentNum", n.getCommentNum());
            m.put("newsChannel", n.getNewsChannel());
            m.put("topicName", topicNameMap.get(n.getTopicId()));
            postList.add(m);
        }

        // 评论足迹（带所在帖子标题；帖子可能已删 → 标题空由前端兜底）。隐藏时不下发列表。
        // 已删评论（含墓碑）不进足迹
        List<DreamNewsComment> comments = hideComments ? new ArrayList<>() : dreamNewsCommentMapper.selectList(new QueryWrapper<DreamNewsComment>()
                .eq("USER_ID", userId).apply("(DELETED IS NULL OR DELETED <> '1')")
                .orderByDesc("COMMENT_DATE").last("limit " + LIST_LIMIT));
        Map<String, String> titleMap = new HashMap<>();
        List<String> newsIds = comments.stream().map(DreamNewsComment::getNewsId)
                .filter(StringUtils::isNotBlank).distinct().collect(Collectors.toList());
        if (!newsIds.isEmpty()) {
            for (DreamNews n : dreamNewsMapper.selectBatchIds(newsIds)) {
                titleMap.put(n.getNewsId(), n.getTitle());
            }
        }
        List<Map<String, Object>> commentList = new ArrayList<>();
        for (DreamNewsComment c : comments) {
            Map<String, Object> m = new HashMap<>();
            m.put("commentId", c.getCommentId());
            m.put("content", c.getContent());
            m.put("commentDate", c.getCommentDate());
            m.put("goodNum", c.getGoodNum());
            m.put("newsId", c.getNewsId());
            m.put("newsTitle", titleMap.get(c.getNewsId()));
            m.put("level", c.getLevel()); // >1 = 楼中楼回复
            commentList.add(m);
        }

        // 统计（全量，不受列表截断影响）
        Map<String, Object> stats = new HashMap<>();
        stats.put("posts", dreamNewsMapper.selectCount(new QueryWrapper<DreamNews>().eq("AUTHOR_ID", userId)));
        stats.put("comments", dreamNewsCommentMapper.selectCount(new QueryWrapper<DreamNewsComment>().eq("USER_ID", userId)));
        long likes = sumGood(dreamNewsMapper.selectObjs(new QueryWrapper<DreamNews>()
                .select("IFNULL(SUM(GOOD_NUM),0)").eq("AUTHOR_ID", userId)))
                + sumGood(dreamNewsCommentMapper.selectObjs(new QueryWrapper<DreamNewsComment>()
                .select("IFNULL(SUM(GOOD_NUM),0)").eq("USER_ID", userId)));
        stats.put("likes", likes);

        Map<String, Object> data = new HashMap<>();
        data.put("user", user);
        data.put("stats", stats);
        data.put("posts", postList);
        data.put("comments", commentList);
        data.put("postsHidden", hidePosts);       // 他人视角：该用户隐藏了发帖
        data.put("commentsHidden", hideComments); // 他人视角：该用户隐藏了评论
        // 收藏足迹（第三个 Tab）：同款隐私开关；对看客还要按其权限过滤（已删/被隐藏/私密专题无权的帖不露）
        List<Map<String, Object>> favoriteList = new ArrayList<>();
        if (!hideFavorites) {
            DreamUser favViewer = SecUtil.getLoginUserToSession(request);
            for (com.dream.basketball.entity.NewsFavorite f : favoriteMapper.selectList(
                    new QueryWrapper<com.dream.basketball.entity.NewsFavorite>()
                            .eq("USER_ID", userId).orderByDesc("CREATE_TIME").last("limit " + LIST_LIMIT))) {
                DreamNews n = dreamNewsMapper.selectById(f.getNewsId());
                if (n == null || "1".equals(n.getHidden())) {
                    continue;
                }
                String favTopicName = null;
                if (StringUtils.isNotBlank(n.getTopicId())) {
                    com.dream.basketball.entity.ForumTopic ft = topicPerms.getTopic(n.getTopicId());
                    if (!topicPerms.canView(favViewer, ft)) {
                        continue;
                    }
                    favTopicName = ft == null ? null : ft.getName();
                }
                Map<String, Object> m = new HashMap<>();
                m.put("newsId", n.getNewsId());
                m.put("title", n.getTitle());
                m.put("newsChannel", n.getNewsChannel());
                m.put("topicName", favTopicName);
                m.put("publishDate", n.getPublishDate());
                m.put("goodNum", n.getGoodNum());
                m.put("commentNum", n.getCommentNum());
                m.put("favTime", f.getCreateTime());
                favoriteList.add(m);
            }
        }
        data.put("favorites", favoriteList);
        data.put("favoritesHidden", hideFavorites); // 他人视角：该用户隐藏了收藏
        // 关注/粉丝计数 + 观察者是否已关注（横幅关注按钮与统计条用）
        data.put("followerCount", followMapper.selectCount(
                new QueryWrapper<com.dream.basketball.entity.UserFollow>().eq("FOLLOWEE_ID", userId)));
        data.put("followingCount", followMapper.selectCount(
                new QueryWrapper<com.dream.basketball.entity.UserFollow>().eq("FOLLOWER_ID", userId)));
        DreamUser profileViewer = SecUtil.getLoginUserToSession(request);
        data.put("following", profileViewer != null && followMapper.selectCount(
                new QueryWrapper<com.dream.basketball.entity.UserFollow>()
                        .eq("FOLLOWER_ID", profileViewer.getUserId()).eq("FOLLOWEE_ID", userId)) > 0);
        // 我是否拉黑了 TA（他人主页的拉黑/解除按钮用）
        data.put("blockedByMe", profileViewer != null && blockMapper.selectCount(
                new QueryWrapper<com.dream.basketball.entity.UserBlock>()
                        .eq("USER_ID", profileViewer.getUserId()).eq("BLOCKED_ID", userId)) > 0);
        // 他人视角：该用户是否隐藏了关注/粉丝列表（计数照常展示，列表点不开）
        boolean isProfileSelf = profileViewer != null && StringUtils.equals(profileViewer.getUserId(), userId);
        data.put("followsHidden", !isProfileSelf && "1".equals(u.getHideFollows()));
        return new Result<>(0, "成功", data);
    }

    /* ==================== 本人资料编辑 ==================== */

    /** 改昵称（查重 + 会话同步） */
    @RequiresRole(Role.USER)
    @PostMapping("/updateProfile")
    public Result<Object> updateProfile(String userNickname, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        String nick = StringUtils.trimToEmpty(userNickname);
        if (nick.isEmpty() || nick.length() > 20) {
            return new Result<>(1, "昵称需为 1-20 个字符", null);
        }
        Integer dup = userMapper.selectCount(new QueryWrapper<DreamUser>()
                .eq("USER_NICKNAME", nick).ne("USER_ID", me.getUserId()));
        if (dup != null && dup > 0) {
            return new Result<>(1, "该昵称已被占用", null);
        }
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", me.getUserId()).set("USER_NICKNAME", nick));
        me.setUserNickname(nick);
        SecUtil.setLoginUserToSession(request, me);
        return new Result<>(0, "昵称已更新", null);
    }

    /** 上传头像（图片白名单/限 5MB，每人一个文件夹，先清旧再存新，返回可访问 URL） */
    @RequiresRole(Role.USER)
    @PostMapping("/uploadAvatar")
    public Result<Map<String, Object>> uploadAvatar(MultipartFile file, HttpServletRequest request) throws IOException {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        String folderKey = "avatar-" + me.getUserId();
        FileUtils.deleteUploadFolder(uploadPath, folderKey); // 只保留最新一张
        String url = FileUtils.upload(file, uploadPath, folderKey);
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", me.getUserId()).set("AVATAR", url));
        me.setAvatar(url);
        SecUtil.setLoginUserToSession(request, me);
        Map<String, Object> data = new HashMap<>();
        data.put("url", url);
        return new Result<>(0, "头像已更新", data);
    }

    /** 改密码（核对原密码，BCrypt 落库，会话同步） */
    @RequiresRole(Role.USER)
    @PostMapping("/changePassword")
    public Result<Object> changePassword(String oldPassword, String newPassword, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamUser fresh = userMapper.selectById(me.getUserId());
        if (fresh == null || !PasswordUtil.matches(StringUtils.trimToEmpty(oldPassword), fresh.getPassword())) {
            return new Result<>(1, "原密码不正确", null);
        }
        String np = StringUtils.trimToEmpty(newPassword);
        if (np.length() < 6 || np.length() > 32) {
            return new Result<>(1, "新密码需为 6-32 位", null);
        }
        String hashed = PasswordUtil.hash(np);
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", me.getUserId()).set("PASSWORD", hashed));
        me.setPassword(hashed);
        SecUtil.setLoginUserToSession(request, me);
        return new Result<>(0, "密码已修改", null);
    }

    /** 主页隐私（仅本人）：是否隐藏我的发帖 / 评论。传哪个改哪个（'1' 隐藏 / '0' 显示）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/setActivityPrivacy")
    public Result<Object> setActivityPrivacy(String hidePosts, String hideComments, String hideFollows, String hideFavorites, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        UpdateWrapper<DreamUser> uw = new UpdateWrapper<DreamUser>().eq("USER_ID", me.getUserId());
        if (hidePosts != null) {
            uw.set("HIDE_POSTS", "1".equals(hidePosts) ? "1" : "0");
        }
        if (hideComments != null) {
            uw.set("HIDE_COMMENTS", "1".equals(hideComments) ? "1" : "0");
        }
        if (hideFollows != null) {
            uw.set("HIDE_FOLLOWS", "1".equals(hideFollows) ? "1" : "0");
        }
        if (hideFavorites != null) {
            uw.set("HIDE_FAVORITES", "1".equals(hideFavorites) ? "1" : "0");
        }
        userMapper.update(null, uw);
        return new Result<>(0, "已保存", null);
    }

    /** 私信权限（本人）：all=所有人可发，following=仅我关注的人可发 */
    @RequiresRole(Role.USER)
    @PostMapping("/setPmPolicy")
    public Result<Object> setPmPolicy(String policy, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        String value = "following".equals(policy) ? "following" : "all";
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", me.getUserId()).set("PM_POLICY", value));
        return new Result<>(0, "已保存", null);
    }

    private long sumGood(List<Object> objs) {
        if (objs == null || objs.isEmpty() || objs.get(0) == null) {
            return 0;
        }
        return Long.parseLong(String.valueOf(objs.get(0)));
    }
}
