package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.config.TopicPermissionService;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumTopic;
import com.dream.basketball.entity.ForumTopicJoinRequest;
import com.dream.basketball.entity.ForumTopicMember;
import com.dream.basketball.mapper.DreamNewsMapper;
import com.dream.basketball.mapper.ForumTopicMapper;
import com.dream.basketball.mapper.ForumTopicMemberMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Forum topics (permissioned sub-forums).
 * - create/delete/reassign-owner: super manager (admin) only;
 * - edit settings + member ACL: admin or the topic owner (canManage);
 * - list/get: public (login optional) — private topics show up "locked" for those who can't view.
 */
@RestController
@RequestMapping("/topic")
public class TopicController {

    private static final String ON = "1";
    private static final String OFF = "0";

    @Autowired
    private ForumTopicMapper topicMapper;
    @Autowired
    private ForumTopicMemberMapper memberMapper;
    @Autowired
    private TopicPermissionService perms;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private DreamNewsMapper dreamNewsMapper;
    @Autowired
    private com.dream.basketball.mapper.ForumTopicJoinRequestMapper requestMapper;
    @Autowired
    private com.dream.basketball.service.UserInformationService userInformationService;
    @Autowired
    private com.dream.basketball.config.UserPermService userPerms;

    // ===== 列表 / 详情（公开，登录可选） =====

    /** 专题列表：全部专题 + 当前用户的权限位；无权浏览的私密专题带 locked=true（仍显示名字/简介）。 */
    @GetMapping("/list")
    public Object list(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (me != null && !userPerms.canBrowse(me.getUserId())) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        List<ForumTopic> topics = topicMapper.selectList(
                new QueryWrapper<ForumTopic>().orderByAsc("SORT").orderByAsc("CREATE_TIME"));
        List<Map<String, Object>> out = new ArrayList<>();
        for (ForumTopic t : topics) {
            out.add(topicView(t, me));
        }
        return new Result<>(0, "成功", out);
    }

    /** 专题详情 + 我的权限。无浏览权时 canView=false（前端据此上锁不拉帖）。
     *  从"我的消息"深链进来时带 userInformationId，顺便把该条消息标记已读。 */
    @GetMapping("/get")
    public Object get(String topicId, String userInformationId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (me != null && !userPerms.canBrowse(me.getUserId())) {
            return new Result<>(1, "你已被限制浏览论坛/新闻", null);
        }
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        if (StringUtils.isNotBlank(userInformationId)) {
            userInformationService.updateInformationRead(userInformationId);
        }
        return new Result<>(0, "成功", topicView(t, SecUtil.getLoginUserToSession(request)));
    }

    /** 一条专题 + 权限位 + owner 名 + 帖数，供列表/详情复用。 */
    private Map<String, Object> topicView(ForumTopic t, DreamUser me) {
        Map<String, Object> m = new HashMap<>();
        m.put("topicId", t.getTopicId());
        m.put("name", t.getName());
        m.put("description", t.getDescription());
        m.put("ownerId", t.getOwnerId());
        DreamUser owner = t.getOwnerId() == null ? null : userMapper.selectById(t.getOwnerId());
        m.put("ownerName", owner == null ? null : owner.getUserNickname());
        m.put("visibility", t.getVisibility());
        m.put("openPost", ON.equals(t.getOpenPost()));
        m.put("openComment", ON.equals(t.getOpenComment()));
        m.put("postCount", dreamNewsMapper.selectCount(new QueryWrapper<DreamNews>().eq("TOPIC_ID", t.getTopicId())));
        m.put("canView", perms.canView(me, t));
        m.put("canPost", perms.canPost(me, t));
        m.put("canComment", perms.canComment(me, t));
        boolean manage = perms.canManage(me, t);
        m.put("canManage", manage);
        m.put("locked", !perms.canView(me, t));
        // 管理者看待审批数；申请人看自己是否申请中
        if (manage) {
            m.put("pendingCount", requestMapper.selectCount(new QueryWrapper<ForumTopicJoinRequest>()
                    .eq("TOPIC_ID", t.getTopicId()).eq("STATUS", "pending")));
        }
        if (me != null && !manage) {
            m.put("myRequestPending", requestMapper.selectCount(new QueryWrapper<ForumTopicJoinRequest>()
                    .eq("TOPIC_ID", t.getTopicId()).eq("USER_ID", me.getUserId()).eq("STATUS", "pending")) > 0);
        }
        return m;
    }

    // ===== 建 / 改 / 删（admin 建删，admin+owner 改设置） =====

    /** 建专题（admin）：必须指定 owner。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/create")
    public Object create(String name, String description, String ownerId, String visibility,
                         String openPost, String openComment, HttpServletRequest request) {
        if (StringUtils.isBlank(name)) {
            return new Result<>(1, "专题名称不能为空", null);
        }
        if (StringUtils.isBlank(ownerId) || userMapper.selectById(ownerId) == null) {
            return new Result<>(1, "请指定一个有效的专题 owner", null);
        }
        ForumTopic t = new ForumTopic();
        t.setTopicId(UUID.randomUUID().toString());
        t.setName(name.trim());
        t.setDescription(StringUtils.trimToEmpty(description));
        t.setOwnerId(ownerId);
        t.setVisibility(TopicPermissionService.PRIVATE.equals(visibility) ? TopicPermissionService.PRIVATE : TopicPermissionService.PUBLIC);
        t.setOpenPost(ON.equals(openPost) ? ON : OFF);
        t.setOpenComment(ON.equals(openComment) ? ON : OFF);
        t.setCreateBy(SecUtil.getLoginUserIdToSession(request));
        t.setCreateTime(new Date());
        t.setSort(0);
        topicMapper.insert(t);
        return new Result<>(0, "创建成功", t.getTopicId());
    }

    /** 改专题设置（admin 或 owner）：名称/简介/公开性/开放发帖发言。admin 还能改 owner。 */
    @RequiresRole(Role.USER)
    @PostMapping("/update")
    public Object update(String topicId, String name, String description, String visibility,
                         String openPost, String openComment, String ownerId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        if (!perms.canManage(me, t)) {
            return new Result<>(1, "无权管理该专题", null);
        }
        if (StringUtils.isNotBlank(name)) {
            t.setName(name.trim());
        }
        if (description != null) {
            t.setDescription(description.trim());
        }
        if (StringUtils.isNotBlank(visibility)) {
            t.setVisibility(TopicPermissionService.PRIVATE.equals(visibility) ? TopicPermissionService.PRIVATE : TopicPermissionService.PUBLIC);
        }
        if (openPost != null) {
            t.setOpenPost(ON.equals(openPost) ? ON : OFF);
        }
        if (openComment != null) {
            t.setOpenComment(ON.equals(openComment) ? ON : OFF);
        }
        // 只有 admin 能转让 owner
        if (StringUtils.isNotBlank(ownerId) && Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER
                && userMapper.selectById(ownerId) != null) {
            t.setOwnerId(ownerId);
        }
        topicMapper.updateById(t);
        return new Result<>(0, "已保存", null);
    }

    /** 删专题（admin）：仅当专题下没有帖子时可删（避免帖子失去归属）。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @DeleteMapping("/delete")
    public Object delete(String topicId) {
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        Integer posts = dreamNewsMapper.selectCount(new QueryWrapper<DreamNews>().eq("TOPIC_ID", topicId));
        if (posts != null && posts > 0) {
            return new Result<>(1, "该专题下还有 " + posts + " 篇帖子，请先清空再删除", null);
        }
        memberMapper.delete(new QueryWrapper<ForumTopicMember>().eq("TOPIC_ID", topicId));
        topicMapper.deleteById(topicId);
        return new Result<>(0, "已删除", null);
    }

    // ===== 成员权限（admin 或 owner） =====

    /** 成员列表（含三权 + 昵称/头像），供 owner 管理面板。 */
    @RequiresRole(Role.USER)
    @GetMapping("/members")
    public Object members(String topicId, HttpServletRequest request) {
        ForumTopic t = perms.getTopic(topicId);
        if (t == null || !perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            return new Result<>(1, "无权查看", null);
        }
        List<ForumTopicMember> ms = memberMapper.selectList(new QueryWrapper<ForumTopicMember>().eq("TOPIC_ID", topicId));
        List<Map<String, Object>> out = new ArrayList<>();
        for (ForumTopicMember m : ms) {
            DreamUser u = userMapper.selectById(m.getUserId());
            Map<String, Object> row = new HashMap<>();
            row.put("userId", m.getUserId());
            row.put("userNickname", u == null ? m.getUserId() : u.getUserNickname());
            row.put("avatar", u == null ? null : u.getAvatar());
            row.put("canView", ON.equals(m.getCanView()));
            row.put("canPost", ON.equals(m.getCanPost()));
            row.put("canComment", ON.equals(m.getCanComment()));
            out.add(row);
        }
        return new Result<>(0, "成功", out);
    }

    /** 授予/更新一个用户的三权（admin 或 owner）。发帖/发言会强制带上浏览权。 */
    @RequiresRole(Role.USER)
    @PostMapping("/setMember")
    public Object setMember(String topicId, String userId, String canView, String canPost, String canComment,
                            HttpServletRequest request) {
        ForumTopic t = perms.getTopic(topicId);
        if (t == null || !perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            return new Result<>(1, "无权管理该专题", null);
        }
        if (StringUtils.isBlank(userId) || userMapper.selectById(userId) == null) {
            return new Result<>(1, "用户不存在", null);
        }
        boolean post = ON.equals(canPost);
        boolean comment = ON.equals(canComment);
        boolean view = ON.equals(canView) || post || comment; // 发帖/发言必然可浏览
        ForumTopicMember m = memberMapper.selectOne(new QueryWrapper<ForumTopicMember>()
                .eq("TOPIC_ID", topicId).eq("USER_ID", userId));
        if (m == null) {
            m = new ForumTopicMember();
            m.setId(UUID.randomUUID().toString());
            m.setTopicId(topicId);
            m.setUserId(userId);
        }
        m.setCanView(view ? ON : OFF);
        m.setCanPost(post ? ON : OFF);
        m.setCanComment(comment ? ON : OFF);
        if (m.getId() != null && memberMapper.selectById(m.getId()) != null) {
            memberMapper.updateById(m);
        } else {
            memberMapper.insert(m);
        }
        return new Result<>(0, "已保存", null);
    }

    // ===== 申请加入 =====

    /** 申请加入专题（登录）：owner/admin 无需申请；已在申请中则拦。通知专题 owner。 */
    @RequiresRole(Role.USER)
    @PostMapping("/apply")
    public Object apply(String topicId, String message, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        if (perms.canManage(me, t)) {
            return new Result<>(1, "你已是该专题的管理者", null);
        }
        boolean pending = requestMapper.selectCount(new QueryWrapper<ForumTopicJoinRequest>()
                .eq("TOPIC_ID", topicId).eq("USER_ID", me.getUserId()).eq("STATUS", "pending")) > 0;
        if (pending) {
            return new Result<>(1, "你已提交申请，请等待审批", null);
        }
        ForumTopicJoinRequest r = new ForumTopicJoinRequest();
        r.setId(UUID.randomUUID().toString());
        r.setTopicId(topicId);
        r.setUserId(me.getUserId());
        r.setMessage(StringUtils.trimToEmpty(message));
        r.setStatus("pending");
        r.setCreateTime(new Date());
        requestMapper.insert(r);
        // 通知 owner
        userInformationService.saveUserInformation(me.getUserId(), me.getUserNickname(), t.getOwnerId(),
                com.dream.basketball.utils.Constants.TOPIC_APPLY, topicId, "", "", "", "", "");
        return new Result<>(0, "已提交申请，等待审批", null);
    }

    /** 待审批申请列表（admin 或 owner）：含申请人昵称/头像/留言/时间。 */
    @RequiresRole(Role.USER)
    @GetMapping("/requests")
    public Object requests(String topicId, HttpServletRequest request) {
        ForumTopic t = perms.getTopic(topicId);
        if (t == null || !perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            return new Result<>(1, "无权查看", null);
        }
        List<ForumTopicJoinRequest> rs = requestMapper.selectList(new QueryWrapper<ForumTopicJoinRequest>()
                .eq("TOPIC_ID", topicId).eq("STATUS", "pending").orderByAsc("CREATE_TIME"));
        List<Map<String, Object>> out = new ArrayList<>();
        for (ForumTopicJoinRequest r : rs) {
            DreamUser u = userMapper.selectById(r.getUserId());
            Map<String, Object> row = new HashMap<>();
            row.put("requestId", r.getId());
            row.put("userId", r.getUserId());
            row.put("userNickname", u == null ? r.getUserId() : u.getUserNickname());
            row.put("avatar", u == null ? null : u.getAvatar());
            row.put("message", r.getMessage());
            row.put("createTime", r.getCreateTime());
            out.add(row);
        }
        return new Result<>(0, "成功", out);
    }

    /** 审批申请（admin 或 owner）：通过=授权(默认浏览+发言，可带 canPost/canView/canComment)，驳回=拒绝；通知申请人。 */
    @RequiresRole(Role.USER)
    @PostMapping("/handleRequest")
    public Object handleRequest(String requestId, String approve, String canView, String canPost, String canComment,
                                HttpServletRequest request) {
        ForumTopicJoinRequest r = StringUtils.isBlank(requestId) ? null : requestMapper.selectById(requestId);
        if (r == null || !"pending".equals(r.getStatus())) {
            return new Result<>(1, "申请不存在或已处理", null);
        }
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(r.getTopicId());
        if (t == null || !perms.canManage(me, t)) {
            return new Result<>(1, "无权审批该专题", null);
        }
        boolean pass = ON.equals(approve);
        r.setStatus(pass ? "approved" : "rejected");
        r.setHandleTime(new Date());
        requestMapper.updateById(r);
        if (pass) {
            // 通过：授予成员权限（默认浏览+发言；发帖需 owner 另行开）
            boolean post = ON.equals(canPost);
            boolean comment = canComment == null ? true : ON.equals(canComment); // 默认给发言
            ForumTopicMember m = memberMapper.selectOne(new QueryWrapper<ForumTopicMember>()
                    .eq("TOPIC_ID", r.getTopicId()).eq("USER_ID", r.getUserId()));
            if (m == null) {
                m = new ForumTopicMember();
                m.setId(UUID.randomUUID().toString());
                m.setTopicId(r.getTopicId());
                m.setUserId(r.getUserId());
                m.setCanView(ON);
                m.setCanPost(post ? ON : OFF);
                m.setCanComment(comment ? ON : OFF);
                memberMapper.insert(m);
            } else {
                m.setCanView(ON);
                if (post) m.setCanPost(ON);
                if (comment) m.setCanComment(ON);
                memberMapper.updateById(m);
            }
        }
        userInformationService.saveUserInformation(me.getUserId(), me.getUserNickname(), r.getUserId(),
                pass ? com.dream.basketball.utils.Constants.TOPIC_APPROVED : com.dream.basketball.utils.Constants.TOPIC_REJECTED,
                r.getTopicId(), "", "", "", "", "");
        return new Result<>(0, pass ? "已通过" : "已驳回", null);
    }

    /** 移除一个成员（admin 或 owner）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/removeMember")
    public Object removeMember(String topicId, String userId, HttpServletRequest request) {
        ForumTopic t = perms.getTopic(topicId);
        if (t == null || !perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            return new Result<>(1, "无权管理该专题", null);
        }
        memberMapper.delete(new QueryWrapper<ForumTopicMember>().eq("TOPIC_ID", topicId).eq("USER_ID", userId));
        return new Result<>(0, "已移除", null);
    }
}
