package com.dream.basketball.controller;

import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.FileUtils;
import com.dream.basketball.utils.SecUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.dream.basketball.utils.Constants.NEWS_CHANNEL_FORUM;
import static com.dream.basketball.utils.Constants.NEWS_CHANNEL_OFFICIAL;
import static com.dream.basketball.utils.Constants.NO_ANCHOR;

/**
 * 资讯/评论 JSON 接口（P4-1 REST 化）。浏览/读取公开；发布/删除需 manager；评论/点赞需登录（P2-5）。
 */
@RestController
@RequestMapping("/news")
public class NewsController extends BaseUtils {

    @Value("${picPath.uploadPath:}")
    private String uploadPath;

    @Autowired
    private NewsService newsService;
    @Autowired
    private DreamNewsService dreamNewsService;
    @Autowired
    private DreamNewsCommentService dreamNewsCommentService;
    @Autowired
    private UserInformationService userInformationService;

    @Autowired
    private com.dream.basketball.config.TopicPermissionService topicPerms;

    @Autowired
    private com.dream.basketball.config.UserPermService userPerms;

    @Autowired
    private com.dream.basketball.mapper.NewsViewerMapper newsViewerMapper;

    /** 资讯列表数据（公开）：指定专题要有浏览权；跨专题聚合时滤掉无权浏览的私密专题帖 */
    @GetMapping("/newsListData")
    public Object newsListData(NewsDto param, Integer page, Integer limit, HttpServletRequest request) throws Exception {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        // 全局限制：被禁止浏览的登录用户看不到论坛/新闻
        if (me != null && !userPerms.canBrowse(me.getUserId())) {
            return handlerSuccessPageJson(0, "成功", 0, java.util.Collections.emptyList());
        }
        if (StringUtils.isNotBlank(param.getTopicId())) {
            com.dream.basketball.entity.ForumTopic t = topicPerms.getTopic(param.getTopicId());
            if (t == null || !topicPerms.canView(me, t)) {
                return handlerSuccessPageJson(0, "成功", 0, java.util.Collections.emptyList());
            }
        }
        PageHelper.startPage(page, limit);
        List<NewsDto> rows = newsService.getNewsByParams(param);
        java.util.Set<String> hidden = topicPerms.hiddenTopicIds(me);
        // 隐藏帖：只有该内容的管理者能看到（专题帖→该专题 canManage；官方/跨专题→manager+）
        boolean canManageCtx;
        if (StringUtils.isNotBlank(param.getTopicId())) {
            canManageCtx = topicPerms.canManage(me, topicPerms.getTopic(param.getTopicId()));
        } else {
            canManageCtx = me != null && Role.fromUserRole(me.getUserRole()).covers(Role.MANAGER);
        }
        final boolean showHidden = canManageCtx;
        rows = rows.stream()
                .filter(r -> hidden.isEmpty() || r.getTopicId() == null || !hidden.contains(r.getTopicId()))
                .filter(r -> showHidden || !"1".equals(r.getHidden()))
                .collect(java.util.stream.Collectors.toList());
        return handlerSuccessPageJson(0, "成功", rows.size(), rows);
    }

    /** 评论列表数据（公开） */
    @GetMapping("/CommentListData")
    public Object commentListData(String newsId, String level, String commentRelId, String commentId,
                                  Integer page, Integer limit) throws Exception {
        PageHelper.startPage(page, limit);
        DreamNewsCommentDto param = new DreamNewsCommentDto();
        param.setNewsId(newsId);
        param.setLevel(level);
        param.setCommentId(commentId);
        param.setCommentRelId(commentRelId);
        List<DreamNewsCommentDto> rows = newsService.getCommentListByParams(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    /** 资讯详情（公开，但专题帖要有浏览权）；附带把对应消息通知标记为已读 */
    @GetMapping("/newsShow")
    public Object newsShow(String newsId, String level, String userInformationId, String anchorId, HttpServletRequest request) {
        DreamUser viewer = SecUtil.getLoginUserToSession(request);
        if (viewer != null && !userPerms.canBrowse(viewer.getUserId())) {
            return new Result<>(1, "你已被限制浏览论坛/新闻", null);
        }
        com.dream.basketball.esEntity.News news = newsService.getNewsShow(newsId);
        // 专题帖：无浏览权直接拒（防私密专题内容泄露）
        if (news != null && StringUtils.isNotBlank(news.getTopicId())
                && !topicPerms.canView(SecUtil.getLoginUserToSession(request), topicPerms.getTopic(news.getTopicId()))) {
            return new Result<>(1, "你没有权限查看该专题的内容", null);
        }
        // 隐藏帖：只有管理者（题主/admin，官方→manager+）能看，普通用户一律当作不存在
        if (news != null && "1".equals(news.getHidden()) && !canManagePost(viewer, news)) {
            return new Result<>(1, "该帖不存在或已被隐藏", null);
        }
        // 浏览计数（通过所有可见性校验后才计）：PV 每次 +1；UV 靠 news_viewer 去重，登录用户首次浏览才 +1
        if (news != null && StringUtils.isNotBlank(news.getNewsId())) {
            String nid = news.getNewsId();
            dreamNewsService.update(null, new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<com.dream.basketball.entity.DreamNews>()
                    .eq("NEWS_ID", nid).setSql("VIEW_COUNT = IFNULL(VIEW_COUNT,0) + 1"));
            news.setViewCount((news.getViewCount() == null ? 0 : news.getViewCount()) + 1);
            if (viewer != null && newsViewerMapper.insertIgnore(nid, viewer.getUserId(), new java.util.Date()) > 0) {
                dreamNewsService.update(null, new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<com.dream.basketball.entity.DreamNews>()
                        .eq("NEWS_ID", nid).setSql("VIEWER_COUNT = IFNULL(VIEWER_COUNT,0) + 1"));
                news.setViewerCount((news.getViewerCount() == null ? 0 : news.getViewerCount()) + 1);
            }
        }
        userInformationService.updateInformationRead(userInformationId);
        Map<String, Object> data = new HashMap<>();
        data.put("news", news);
        data.put("level", level);
        data.put("anchorId", StringUtils.isNotBlank(anchorId) ? anchorId : NO_ANCHOR);
        data.put("canManage", canManagePost(viewer, news)); // 能否给该帖置顶/加精
        // 题主标识用：该帖所属专题的 owner（官方新闻无专题→null）
        if (news != null && StringUtils.isNotBlank(news.getTopicId())) {
            com.dream.basketball.entity.ForumTopic t = topicPerms.getTopic(news.getTopicId());
            data.put("topicOwnerId", t == null ? null : t.getOwnerId());
        }
        return new Result<>(0, "成功", data);
    }

    /**
     * 置顶 / 精华 / 封锁 / 隐藏（可并存）。官方新闻→manager+；论坛专题帖→该专题管理者（owner/admin）。
     * flag=top|essence|locked|hidden，value=1 开 / 0 关。封锁后只读；隐藏后普通用户在列表/详情/搜索都看不到（仅管理者可见，可撤销）。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/setFlag")
    public Object setFlag(String newsId, String flag, String value, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        News news = StringUtils.isNotBlank(newsId) ? newsService.getNewsShow(newsId) : null;
        if (news == null || StringUtils.isBlank(news.getNewsId())) {
            return handlerResultJson(false, "帖子不存在");
        }
        String col;
        if ("top".equals(flag)) {
            col = "TOP";
        } else if ("essence".equals(flag)) {
            col = "ESSENCE";
        } else if ("locked".equals(flag)) {
            col = "LOCKED";
        } else if ("hidden".equals(flag)) {
            col = "HIDDEN";
        } else {
            return handlerResultJson(false, "参数错误");
        }
        if (!canManagePost(me, news)) {
            return handlerResultJson(false, "无权操作");
        }
        String v = "1".equals(value) ? "1" : "0";
        com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<com.dream.basketball.entity.DreamNews> uw =
                new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<com.dream.basketball.entity.DreamNews>().eq("NEWS_ID", newsId);
        uw.set(col, v);
        dreamNewsService.update(uw);
        return handlerResultJson(true, "已更新");
    }

    /**
     * 删除单个帖子（题主/管理者）。官方→manager+；论坛专题帖→该专题管理者（owner/admin）。
     * 连带删 ES 文档 + 该帖上传的图片目录。比 /delete（仅 manager 批量）多了题主授权。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/deletePost")
    public Object deletePost(String newsId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        News news = StringUtils.isNotBlank(newsId) ? newsService.getNewsShow(newsId) : null;
        if (news == null || StringUtils.isBlank(news.getNewsId())) {
            return handlerResultJson(false, "帖子不存在");
        }
        if (!canManagePost(me, news)) {
            return handlerResultJson(false, "无权删除该帖");
        }
        newsService.deleteNewsListByIds(newsId, News.class);
        dreamNewsService.deleteSyncEs(newsId);
        FileUtils.deleteUploadFolder(uploadPath, newsId.trim());
        return handlerResultJson(true, "已删除");
    }

    /** 能否管理某帖的置顶/精华/封锁/删除：官方→manager+；专题帖→该专题 canManage；无专题的论坛帖→manager+。 */
    private boolean canManagePost(DreamUser me, News news) {
        if (me == null || news == null) {
            return false;
        }
        if ("official".equals(news.getNewsChannel())) {
            return Role.fromUserRole(me.getUserRole()).covers(Role.MANAGER);
        }
        if (StringUtils.isNotBlank(news.getTopicId())) {
            return topicPerms.canManage(me, topicPerms.getTopic(news.getTopicId()));
        }
        return Role.fromUserRole(me.getUserRole()).covers(Role.MANAGER);
    }

    /** 作者数据小结（公开）：发帖数 / 精华数 / 置顶数 / 获赞数（获赞=其所有帖 GOOD_NUM 之和）。给帖子详情作者卡用。 */
    @GetMapping("/authorStats")
    public Object authorStats(String userId) {
        Map<String, Object> stats = new HashMap<>();
        if (StringUtils.isBlank(userId)) {
            return new Result<>(0, "成功", stats);
        }
        List<Map<String, Object>> rows = dreamNewsService.getBaseMapper().selectMaps(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.dream.basketball.entity.DreamNews>()
                        .select("COUNT(*) as postCount",
                                "IFNULL(SUM(CASE WHEN ESSENCE='1' THEN 1 ELSE 0 END),0) as essenceCount",
                                "IFNULL(SUM(CASE WHEN TOP='1' THEN 1 ELSE 0 END),0) as topCount",
                                "IFNULL(SUM(GOOD_NUM),0) as likeCount")
                        .eq("AUTHOR_ID", userId));
        Map<String, Object> r = rows.isEmpty() ? new HashMap<>() : rows.get(0);
        stats.put("postCount", num(r.get("postCount")));
        stats.put("essenceCount", num(r.get("essenceCount")));
        stats.put("topCount", num(r.get("topCount")));
        stats.put("likeCount", num(r.get("likeCount")));
        return new Result<>(0, "成功", stats);
    }

    private long num(Object o) {
        return o == null ? 0 : Long.parseLong(String.valueOf(o));
    }

    /** 评论详情（公开）；附带标记已读 */
    @GetMapping("/commentDetailShow")
    public Object commentDetailShow(String newsId, String commentRelId, String userInformationId, String anchorId) {
        userInformationService.updateInformationRead(userInformationId);
        Map<String, Object> data = new HashMap<>();
        data.put("news", newsService.getNewsShow(newsId));
        data.put("commentRelId", commentRelId);
        data.put("comment", dreamNewsCommentService.getById(commentRelId));
        data.put("anchorId", StringUtils.isNotBlank(anchorId) ? anchorId : NO_ANCHOR);
        return new Result<>(0, "成功", data);
    }

    // ===== 写/管理：manager 及以上（P2-5） =====

    /** 删除资讯（ES + DB），并连带清理该帖上传的图片目录 */
    @RequiresRole(Role.MANAGER)
    @DeleteMapping("/delete")
    public Object delete(String newsIds) {
        if (StringUtils.isBlank(newsIds)) {
            return handlerResultJson(false, "删除失败！");
        }
        newsService.deleteNewsListByIds(newsIds, News.class);
        dreamNewsService.deleteSyncEs(newsIds);
        // Images are filed per post at {uploadPath}/{newsId}/ — remove them with the post
        for (String newsId : newsIds.split(",")) {
            FileUtils.deleteUploadFolder(uploadPath, newsId.trim());
        }
        return handlerResultJson(true, "删除成功！");
    }

    /**
     * 新增/保存资讯（论坛发帖）。任何登录用户可发帖（恢复原 D 论坛行为，P2-5 曾误收紧为 manager）。
     * 安全：作者强制为当前登录用户（忽略客户端传入）；编辑已存在帖子仅限原作者或 manager，
     * 防止越权改写他人帖子（IDOR）。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/save")
    public Object save(News news, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        boolean isManager = Role.fromUserRole(me.getUserRole()).covers(Role.MANAGER);
        News existing = StringUtils.isNotBlank(news.getNewsId()) ? newsService.getNewsShow(news.getNewsId()) : null;
        boolean isExisting = existing != null && StringUtils.isNotBlank(existing.getNewsId());
        if (isExisting) {
            // Editing: only the original author or a manager may edit; preserve original
            // authorship, publish time, channel and topic (don't let the client reassign them).
            if (!isManager && !StringUtils.equals(existing.getAuthorId(), me.getUserId())) {
                return handlerResultJson(false, "无权编辑他人的帖子");
            }
            news.setAuthor(existing.getAuthor());
            news.setAuthorId(existing.getAuthorId());
            news.setPublishDate(existing.getPublishDate());
            news.setNewsChannel(existing.getNewsChannel());
            news.setTopicId(existing.getTopicId());
        } else {
            // 全局限制：被超管禁止发帖的用户不能发新帖
            if (!userPerms.canPost(me.getUserId())) {
                return handlerResultJson(false, "你已被限制发帖");
            }
            // New post: force author to the current user (ignore any client-sent value).
            news.setAuthor(me.getUserNickname());
            news.setAuthorId(me.getUserId());
            // Channel: the official news zone is manager-only; everything else is a forum post
            // and must belong to a topic the user is allowed to post in.
            boolean official = StringUtils.equals(NEWS_CHANNEL_OFFICIAL, news.getNewsChannel());
            if (official) {
                if (!isManager) {
                    return handlerResultJson(false, "只有管理员可以发布官方新闻！");
                }
                news.setNewsChannel(NEWS_CHANNEL_OFFICIAL);
                news.setTopicId(null); // official news has no topic
            } else {
                news.setNewsChannel(NEWS_CHANNEL_FORUM);
                com.dream.basketball.entity.ForumTopic topic = topicPerms.getTopic(news.getTopicId());
                if (topic == null) {
                    return handlerResultJson(false, "请选择要发布到的专题");
                }
                if (!topicPerms.canPost(me, topic)) {
                    return handlerResultJson(false, "你在该专题没有发帖权限");
                }
            }
        }
        newsService.save(news);
        dreamNewsService.saveSyncEs(news);
        // @-mention 通知：只给"这次新增"的被 @ 者发（编辑时老正文里已有的 @ 不重复打扰），排除作者本人
        java.util.Set<String> mentionedNow = com.dream.basketball.utils.MentionUtil.parseNewsMentionIds(news.getContent());
        java.util.Set<String> mentionedBefore = isExisting
                ? com.dream.basketball.utils.MentionUtil.parseNewsMentionIds(existing.getContent())
                : java.util.Collections.emptySet();
        for (String mentionedId : mentionedNow) {
            if (mentionedBefore.contains(mentionedId) || StringUtils.equals(mentionedId, me.getUserId())) {
                continue;
            }
            userInformationService.saveUserInformation(me.getUserId(), me.getUserNickname(), mentionedId,
                    com.dream.basketball.utils.Constants.MENTION_NEWS, news.getNewsId(), "", "", "", "", "");
        }
        return handlerResultJson(true, "操作成功！");
    }

    /**
     * 富文本图片上传（P2-4 安全校验 + P4-3 统一返回）：返回可访问 URL。
     * 论坛发帖已开放给登录用户，插图随发帖同级放开（曾遗留 MANAGER 门槛导致普通用户 403）。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/upload")
    public Object upload(MultipartFile file, String newsId) throws IOException {
        String url = FileUtils.upload(file, uploadPath, newsId);
        Map<String, Object> data = new HashMap<>();
        data.put("url", url);
        return new Result<>(0, "上传成功", data);
    }

    /**
     * 评论附件上传（登录即可）：图片或常见文档，返回可访问 URL + 服务端识别的类型。
     * 文件按帖子归档到 comment-{newsId}/ 目录。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/commentUpload")
    public Object commentUpload(MultipartFile file, String newsId) throws IOException {
        String folder = "comment-" + (StringUtils.isNotBlank(newsId) ? newsId : "misc");
        String url = FileUtils.uploadAttachment(file, uploadPath, folder);
        Map<String, Object> data = new HashMap<>();
        data.put("url", url);
        return new Result<>(0, "上传成功", data);
    }

    // ===== 会员互动：登录即可（P2-5） =====

    @RequiresRole(Role.USER)
    @PostMapping("/good")
    public Object good(String newsId, HttpServletRequest request) {
        return newsService.good(newsId, request);
    }

    @RequiresRole(Role.USER)
    @PostMapping("/bad")
    public Object bad(String newsId, HttpServletRequest request) {
        return newsService.bad(newsId, request);
    }

    @RequiresRole(Role.USER)
    @PostMapping("/goodComment")
    public Object goodComment(String commentId, HttpServletRequest request) {
        return newsService.goodComment(commentId, request);
    }

    @RequiresRole(Role.USER)
    @PostMapping("/badComment")
    public Object badComment(String commentId, HttpServletRequest request) {
        return newsService.badComment(commentId, request);
    }

    @RequiresRole(Role.USER)
    @PostMapping("/comment")
    public Object comment(DreamNewsComment dreamNewsComment, HttpServletRequest request) {
        return newsService.comment(dreamNewsComment, request);
    }
}
