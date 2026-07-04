package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.DreamNewsCommentMapper;
import com.dream.basketball.mapper.DreamNewsMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.PlayerService;
import com.dream.basketball.utils.Constants;
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
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 用户空间：公开主页聚合 + 本人资料编辑 + 球员认证绑定（申请 → 超级管理员审核）。
 * PLAYER_IDENTIFICATION 三态：0=未认证，2=审核中，1=已认证（沿用既有常量语义）。
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
    private PlayerService playerService;

    @Autowired
    private com.dream.basketball.mapper.PlayerVerifyRecordMapper verifyRecordMapper;

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

        Map<String, Object> user = new HashMap<>();
        user.put("userId", u.getUserId());
        user.put("userName", u.getUserName());
        user.put("userNickname", u.getUserNickname());
        user.put("userRole", u.getUserRole());
        user.put("avatar", u.getAvatar());
        user.put("registTime", u.getRegistTime());
        user.put("lastLoginTime", u.getLastLoginTime());
        // 原始隐藏开关（本人视角用来回显开关状态）
        user.put("hidePosts", "1".equals(u.getHidePosts()));
        user.put("hideComments", "1".equals(u.getHideComments()));
        // 认证三态 + 绑定球员（徽章只在已认证时展示，审核中仅本人视角用）
        int identStatus = u.getPlayerIdentification() == null ? 0 : u.getPlayerIdentification();
        user.put("identStatus", identStatus);
        user.put("checkTime", u.getCheckTime());
        if (StringUtils.isNotBlank(u.getPlayerId())) {
            user.put("playerId", u.getPlayerId());
            DreamPlayer p = playerService.getById(u.getPlayerId());
            if (p != null) {
                user.put("playerName", p.getPlayerName());
            }
        }

        // 帖子（官方+论坛都算，最新在前，取前 N；计数/获赞用全量聚合）。隐藏时不下发列表。
        List<DreamNews> posts = hidePosts ? new ArrayList<>() : dreamNewsMapper.selectList(new QueryWrapper<DreamNews>()
                .eq("AUTHOR_ID", userId).orderByDesc("PUBLISH_DATE").last("limit " + LIST_LIMIT));
        List<Map<String, Object>> postList = new ArrayList<>();
        for (DreamNews n : posts) {
            Map<String, Object> m = new HashMap<>();
            m.put("newsId", n.getNewsId());
            m.put("title", n.getTitle());
            m.put("publishDate", n.getPublishDate());
            m.put("goodNum", n.getGoodNum());
            m.put("commentNum", n.getCommentNum());
            m.put("newsChannel", n.getNewsChannel());
            postList.add(m);
        }

        // 评论足迹（带所在帖子标题；帖子可能已删 → 标题空由前端兜底）。隐藏时不下发列表。
        List<DreamNewsComment> comments = hideComments ? new ArrayList<>() : dreamNewsCommentMapper.selectList(new QueryWrapper<DreamNewsComment>()
                .eq("USER_ID", userId).orderByDesc("COMMENT_DATE").last("limit " + LIST_LIMIT));
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
    public Result<Object> setActivityPrivacy(String hidePosts, String hideComments, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        UpdateWrapper<DreamUser> uw = new UpdateWrapper<DreamUser>().eq("USER_ID", me.getUserId());
        if (hidePosts != null) {
            uw.set("HIDE_POSTS", "1".equals(hidePosts) ? "1" : "0");
        }
        if (hideComments != null) {
            uw.set("HIDE_COMMENTS", "1".equals(hideComments) ? "1" : "0");
        }
        userMapper.update(null, uw);
        return new Result<>(0, "已保存", null);
    }

    /* ==================== 球员认证绑定 ==================== */

    /** 申请绑定球员 → 进入审核中（同一球员只允许一个已认证账号） */
    @RequiresRole(Role.USER)
    @PostMapping("/bindPlayer")
    public Result<Object> bindPlayer(String playerId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamPlayer player = StringUtils.isBlank(playerId) ? null : playerService.getById(playerId);
        if (player == null) {
            return new Result<>(1, "球员不存在", null);
        }
        Integer taken = userMapper.selectCount(new QueryWrapper<DreamUser>()
                .eq("PLAYER_ID", playerId)
                .eq("PLAYER_IDENTIFICATION", Constants.IDENTIFICATION)
                .ne("USER_ID", me.getUserId()));
        if (taken != null && taken > 0) {
            return new Result<>(1, "该球员已被其他账号认证", null);
        }
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", me.getUserId())
                .set("PLAYER_ID", playerId)
                .set("PLAYER_IDENTIFICATION", Constants.IDENTIFICATION_PENDING)
                .set("CHECK_TIME", new Date()));
        me.setPlayerId(playerId);
        me.setPlayerIdentification(Constants.IDENTIFICATION_PENDING);
        SecUtil.setLoginUserToSession(request, me);
        // 认证历史：先作废旧的待审记录，再插一条新的 pending
        cancelPendingRecords(me.getUserId());
        com.dream.basketball.entity.PlayerVerifyRecord rec = new com.dream.basketball.entity.PlayerVerifyRecord();
        rec.setId(UUID.randomUUID().toString());
        rec.setUserId(me.getUserId());
        rec.setPlayerId(playerId);
        rec.setStatus("pending");
        rec.setApplyTime(new Date());
        verifyRecordMapper.insert(rec);
        return new Result<>(0, "已提交认证申请，等待超级管理员审核", null);
    }

    /** 撤销申请 / 解除绑定（本人任意状态可清） */
    @RequiresRole(Role.USER)
    @PostMapping("/unbindPlayer")
    public Result<Object> unbindPlayer(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", me.getUserId())
                .set("PLAYER_ID", null)
                .set("PLAYER_IDENTIFICATION", Constants.UNIDENTIFICATION)
                .set("CHECK_TIME", null));
        me.setPlayerId(null);
        me.setPlayerIdentification(Constants.UNIDENTIFICATION);
        SecUtil.setLoginUserToSession(request, me);
        cancelPendingRecords(me.getUserId()); // 撤销申请：作废待审记录
        return new Result<>(0, "已解除绑定", null);
    }

    /** 待审核申请列表（超管） */
    @RequiresRole(Role.SUPER_MANAGER)
    @GetMapping("/bindings")
    public Result<List<Map<String, Object>>> bindings() {
        List<DreamUser> pending = userMapper.selectList(new QueryWrapper<DreamUser>()
                .eq("PLAYER_IDENTIFICATION", Constants.IDENTIFICATION_PENDING)
                .orderByAsc("CHECK_TIME"));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (DreamUser u : pending) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userName", u.getUserName());
            m.put("userNickname", u.getUserNickname());
            m.put("playerId", u.getPlayerId());
            DreamPlayer p = StringUtils.isBlank(u.getPlayerId()) ? null : playerService.getById(u.getPlayerId());
            m.put("playerName", p == null ? null : p.getPlayerName());
            m.put("playerNumber", p == null ? null : p.getPlayerNumber());
            m.put("applyTime", u.getCheckTime());
            rows.add(m);
        }
        return new Result<>(0, "成功", rows);
    }

    /** 审核（超管）：approve=true 通过（盖章时间），false 驳回（清空绑定） */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/reviewBinding")
    public Result<Object> reviewBinding(String userId, Boolean approve, HttpServletRequest request) {
        DreamUser target = StringUtils.isBlank(userId) ? null : userMapper.selectById(userId);
        if (target == null || target.getPlayerIdentification() == null
                || !Constants.IDENTIFICATION_PENDING.equals(target.getPlayerIdentification())) {
            return new Result<>(1, "该申请不存在或已处理", null);
        }
        String handlerId = SecUtil.getLoginUserIdToSession(request);
        if (Boolean.TRUE.equals(approve)) {
            Integer taken = userMapper.selectCount(new QueryWrapper<DreamUser>()
                    .eq("PLAYER_ID", target.getPlayerId())
                    .eq("PLAYER_IDENTIFICATION", Constants.IDENTIFICATION)
                    .ne("USER_ID", userId));
            if (taken != null && taken > 0) {
                return new Result<>(1, "该球员已被其他账号认证，请先驳回本申请", null);
            }
            userMapper.update(null, new UpdateWrapper<DreamUser>()
                    .eq("USER_ID", userId)
                    .set("PLAYER_IDENTIFICATION", Constants.IDENTIFICATION)
                    .set("CHECK_TIME", new Date()));
            resolvePendingRecord(userId, target.getPlayerId(), "approved", handlerId);
            return new Result<>(0, "已通过认证", null);
        }
        String playerIdBefore = target.getPlayerId();
        userMapper.update(null, new UpdateWrapper<DreamUser>()
                .eq("USER_ID", userId)
                .set("PLAYER_ID", null)
                .set("PLAYER_IDENTIFICATION", Constants.UNIDENTIFICATION)
                .set("CHECK_TIME", null));
        resolvePendingRecord(userId, playerIdBefore, "rejected", handlerId);
        return new Result<>(0, "已驳回申请", null);
    }

    /** 认证审核历史（超管，分页）：全部记录 + 用户/球员名 + 状态 + 时间 + 审核人。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @GetMapping("/verifyHistory")
    public Result<Map<String, Object>> verifyHistory(Integer page, Integer limit) {
        com.github.pagehelper.PageHelper.startPage(page == null ? 1 : page, limit == null ? 20 : limit);
        List<com.dream.basketball.entity.PlayerVerifyRecord> recs = verifyRecordMapper.selectList(
                new QueryWrapper<com.dream.basketball.entity.PlayerVerifyRecord>().orderByDesc("APPLY_TIME"));
        com.github.pagehelper.PageInfo<com.dream.basketball.entity.PlayerVerifyRecord> info =
                new com.github.pagehelper.PageInfo<>(recs);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (com.dream.basketball.entity.PlayerVerifyRecord r : recs) {
            Map<String, Object> m = new HashMap<>();
            DreamUser u = userMapper.selectById(r.getUserId());
            DreamPlayer p = StringUtils.isBlank(r.getPlayerId()) ? null : playerService.getById(r.getPlayerId());
            DreamUser handler = StringUtils.isBlank(r.getHandlerId()) ? null : userMapper.selectById(r.getHandlerId());
            m.put("userId", r.getUserId());
            m.put("userNickname", u == null ? r.getUserId() : u.getUserNickname());
            m.put("playerId", r.getPlayerId());
            m.put("playerName", p == null ? null : p.getPlayerName());
            m.put("playerNumber", p == null ? null : p.getPlayerNumber());
            m.put("status", r.getStatus());
            m.put("applyTime", r.getApplyTime());
            m.put("handleTime", r.getHandleTime());
            m.put("handlerName", handler == null ? null : handler.getUserNickname());
            rows.add(m);
        }
        Map<String, Object> data = new HashMap<>();
        data.put("total", info.getTotal());
        data.put("records", rows);
        return new Result<>(0, "成功", data);
    }

    /** 把用户最新的 pending 记录落定为 approved/rejected；没有则补一条（兼容历史遗留的待审用户）。 */
    private void resolvePendingRecord(String userId, String playerId, String status, String handlerId) {
        com.dream.basketball.entity.PlayerVerifyRecord rec = verifyRecordMapper.selectOne(
                new QueryWrapper<com.dream.basketball.entity.PlayerVerifyRecord>()
                        .eq("USER_ID", userId).eq("STATUS", "pending")
                        .orderByDesc("APPLY_TIME").last("limit 1"));
        Date now = new Date();
        if (rec == null) {
            rec = new com.dream.basketball.entity.PlayerVerifyRecord();
            rec.setId(UUID.randomUUID().toString());
            rec.setUserId(userId);
            rec.setPlayerId(playerId);
            rec.setApplyTime(now);
            rec.setStatus(status);
            rec.setHandleTime(now);
            rec.setHandlerId(handlerId);
            verifyRecordMapper.insert(rec);
        } else {
            rec.setStatus(status);
            rec.setHandleTime(now);
            rec.setHandlerId(handlerId);
            verifyRecordMapper.updateById(rec);
        }
    }

    /** 作废用户所有 pending 记录（撤销申请 / 重新申请时用）。 */
    private void cancelPendingRecords(String userId) {
        verifyRecordMapper.update(null, new UpdateWrapper<com.dream.basketball.entity.PlayerVerifyRecord>()
                .eq("USER_ID", userId).eq("STATUS", "pending")
                .set("STATUS", "cancelled").set("HANDLE_TIME", new Date()));
    }

    private long sumGood(List<Object> objs) {
        if (objs == null || objs.isEmpty() || objs.get(0) == null) {
            return 0;
        }
        return Long.parseLong(String.valueOf(objs.get(0)));
    }
}
