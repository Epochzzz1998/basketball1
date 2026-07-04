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

    /** 资讯列表数据（公开） */
    @GetMapping("/newsListData")
    public Object newsListData(NewsDto param, Integer page, Integer limit) throws Exception {
        PageHelper.startPage(page, limit);
        List<NewsDto> rows = newsService.getNewsByParams(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
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

    /** 资讯详情（公开）；附带把对应消息通知标记为已读 */
    @GetMapping("/newsShow")
    public Object newsShow(String newsId, String level, String userInformationId, String anchorId) {
        userInformationService.updateInformationRead(userInformationId);
        Map<String, Object> data = new HashMap<>();
        data.put("news", newsService.getNewsShow(newsId));
        data.put("level", level);
        data.put("anchorId", StringUtils.isNotBlank(anchorId) ? anchorId : NO_ANCHOR);
        return new Result<>(0, "成功", data);
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
            // authorship and publish time (don't let the client reassign or reset them).
            if (!isManager && !StringUtils.equals(existing.getAuthorId(), me.getUserId())) {
                return handlerResultJson(false, "无权编辑他人的帖子");
            }
            news.setAuthor(existing.getAuthor());
            news.setAuthorId(existing.getAuthorId());
            news.setPublishDate(existing.getPublishDate());
            news.setNewsChannel(existing.getNewsChannel());
        } else {
            // New post: force author to the current user (ignore any client-sent value).
            news.setAuthor(me.getUserNickname());
            news.setAuthorId(me.getUserId());
            // Channel: the official news zone is manager-only; everything else lands in the forum.
            boolean official = StringUtils.equals(NEWS_CHANNEL_OFFICIAL, news.getNewsChannel());
            if (official && !isManager) {
                return handlerResultJson(false, "只有管理员可以发布官方新闻！");
            }
            news.setNewsChannel(official ? NEWS_CHANNEL_OFFICIAL : NEWS_CHANNEL_FORUM);
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
