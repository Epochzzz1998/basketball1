package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
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
    private com.dream.basketball.mapper.TopicSubscriptionMapper subscriptionMapper;
    @Autowired
    private com.dream.basketball.mapper.TopicSeenMapper seenMapper;
    @Autowired
    private com.dream.basketball.mapper.DreamNewsCommentMapper newsCommentMapper;
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
        // 红点数据：我的 seen 时间 + 我的订阅集合（一把批查）
        Map<String, Date> seenMap = new HashMap<>();
        Set<String> subscribedIds = new HashSet<>();
        if (me != null) {
            for (com.dream.basketball.entity.TopicSeen ts : seenMapper.selectList(
                    new QueryWrapper<com.dream.basketball.entity.TopicSeen>().eq("USER_ID", me.getUserId()))) {
                seenMap.put(ts.getTopicId(), ts.getLastSeen());
            }
            for (com.dream.basketball.entity.TopicSubscription sub : subscriptionMapper.selectList(
                    new QueryWrapper<com.dream.basketball.entity.TopicSubscription>().eq("USER_ID", me.getUserId()))) {
                subscribedIds.add(sub.getTopicId());
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (ForumTopic t : topics) {
            // 不可见专题（LISTED='0'）：仅题主/管理员/已加入成员能在列表看到，其余人跳过
            if ("0".equals(t.getListed()) && !perms.canManage(me, t) && !perms.isMember(me, t)) {
                continue;
            }
            Map<String, Object> view = topicView(t, me);
            // 新活动红点：只在公开专题或我订阅的专题上展示；首次访问前不计
            int newCount = 0;
            if (me != null && (!TopicPermissionService.PRIVATE.equals(t.getVisibility()) || subscribedIds.contains(t.getTopicId()))) {
                Date seen = seenMap.get(t.getTopicId());
                if (seen != null) {
                    newCount = newActivityCount(t.getTopicId(), seen, me.getUserId());
                }
            }
            view.put("newCount", newCount);
            out.add(view);
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

    /**
     * 上次访问后的新活动数（他人的发帖 + 评论各 +1；隐藏帖/墓碑评论不算）。
     * 没有 seen 记录 = 0（首次进专题才开始跟踪，避免新用户看到吓人的大数字）。
     */
    private int newActivityCount(String topicId, Date seen, String myId) {
        Integer posts = dreamNewsMapper.selectCount(new QueryWrapper<DreamNews>()
                .eq("TOPIC_ID", topicId).ne("AUTHOR_ID", myId).gt("PUBLISH_DATE", seen)
                .and(w -> w.isNull("HIDDEN").or().ne("HIDDEN", "1")));
        Integer comments = newsCommentMapper.selectCount(new QueryWrapper<com.dream.basketball.entity.DreamNewsComment>()
                .inSql("NEWS_ID", "SELECT NEWS_ID FROM dream_news WHERE TOPIC_ID = '" + topicId + "'")
                .ne("USER_ID", myId).gt("COMMENT_DATE", seen)
                .and(w -> w.isNull("DELETED").or().ne("DELETED", "1")));
        return (posts == null ? 0 : posts) + (comments == null ? 0 : comments);
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
        // 多题主：ownerIds（全部题主 id，供帖子/评论的题主标识与「只看题主」筛选）+ owners（带昵称/头像，供展示与超管管理）
        Set<String> ownerIdSet = perms.ownerIds(t);
        m.put("ownerIds", new ArrayList<>(ownerIdSet));
        List<Map<String, Object>> owners = new ArrayList<>();
        for (String oid : ownerIdSet) {
            DreamUser ou = userMapper.selectById(oid);
            Map<String, Object> o = new HashMap<>();
            o.put("userId", oid);
            o.put("userNickname", ou == null ? oid : ou.getUserNickname());
            o.put("avatar", ou == null ? null : ou.getAvatar());
            owners.add(o);
        }
        m.put("owners", owners);
        // 小题主：拥有题主全部管理权限、唯独不能动题主；题主/超管指派，每专题最多 3 人
        Set<String> subIdSet = perms.subOwnerIds(t);
        m.put("subOwnerIds", new ArrayList<>(subIdSet));
        List<Map<String, Object>> subOwners = new ArrayList<>();
        for (String sid : subIdSet) {
            DreamUser su = userMapper.selectById(sid);
            Map<String, Object> s = new HashMap<>();
            s.put("userId", sid);
            s.put("userNickname", su == null ? sid : su.getUserNickname());
            s.put("avatar", su == null ? null : su.getAvatar());
            subOwners.add(s);
        }
        m.put("subOwners", subOwners);
        m.put("canEditSubOwners", me != null && (Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER || perms.isOwner(me, t)));
        m.put("visibility", t.getVisibility());
        m.put("listed", !"0".equals(t.getListed())); // 是否在百家说露出（默认 true）
        m.put("openPost", ON.equals(t.getOpenPost()));
        m.put("openComment", ON.equals(t.getOpenComment()));
        m.put("postCount", dreamNewsMapper.selectCount(new QueryWrapper<DreamNews>().eq("TOPIC_ID", t.getTopicId())));
        m.put("canView", perms.canView(me, t));
        m.put("canPost", perms.canPost(me, t));
        m.put("canComment", perms.canComment(me, t));
        boolean manage = perms.canManage(me, t);
        m.put("canManage", manage);
        // 订阅：只有"已加入"（成员或管理者）能订阅；joined/subscribed 供专题横幅的订阅按钮
        boolean joined = me != null && (manage || perms.isMember(me, t));
        m.put("joined", joined);
        m.put("subscribed", me != null && subscriptionMapper.selectCount(
                new QueryWrapper<com.dream.basketball.entity.TopicSubscription>()
                        .eq("USER_ID", me.getUserId()).eq("TOPIC_ID", t.getTopicId())) > 0);
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

    // ===== 建 / 改 / 删（人人可建限 5 个，admin 删，admin+题主+小题主 改设置） =====

    /**
     * 建专题：普通用户也可建（默认允许，超管可在用户管理里关掉），每人最多 5 个，
     * 创建者自动成为题主；超管不限量，且可代指定 owner。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/create")
    public Object create(String name, String description, String ownerId, String visibility,
                         String openPost, String openComment, String listed, HttpServletRequest request) {
        if (StringUtils.isBlank(name)) {
            return new Result<>(1, "专题名称不能为空", null);
        }
        DreamUser me = SecUtil.getLoginUserToSession(request);
        boolean isSuper = Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER;
        if (isSuper) {
            // 超管沿用旧流程：必须显式指定 owner
            if (StringUtils.isBlank(ownerId) || userMapper.selectById(ownerId) == null) {
                return new Result<>(1, "请指定一个有效的专题 owner", null);
            }
        } else {
            // 普通用户：owner 只能是自己；受"允许创建话题"开关与 5 个上限约束（现读 DB，超管一改即生效）
            DreamUser fresh = userMapper.selectById(me.getUserId());
            if (fresh == null || "0".equals(fresh.getCanCreateTopic())) {
                return new Result<>(1, "管理员已限制你创建专题", null);
            }
            Integer owned = topicMapper.selectCount(new QueryWrapper<ForumTopic>().eq("OWNER_ID", me.getUserId()));
            if (owned != null && owned >= 5) {
                return new Result<>(1, "每人最多创建 5 个专题", null);
            }
            ownerId = me.getUserId();
        }
        ForumTopic t = new ForumTopic();
        t.setTopicId(UUID.randomUUID().toString());
        t.setName(name.trim());
        t.setDescription(StringUtils.trimToEmpty(description));
        t.setOwnerId(ownerId);
        t.setOwnerIds(JSON.toJSONString(Collections.singletonList(ownerId)));
        t.setVisibility(TopicPermissionService.PRIVATE.equals(visibility) ? TopicPermissionService.PRIVATE : TopicPermissionService.PUBLIC);
        t.setOpenPost(ON.equals(openPost) ? ON : OFF);
        t.setOpenComment(ON.equals(openComment) ? ON : OFF);
        t.setListed("0".equals(listed) ? "0" : "1"); // 默认可见；显式传 '0' 才下架
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
                         String openPost, String openComment, String listed, String ownerId, HttpServletRequest request) {
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
        if (listed != null) {
            t.setListed("0".equals(listed) ? "0" : "1"); // 题主/管理员切换是否在百家说露出
        }
        // 只有 admin 能转让 owner（转让=改为单一题主；多题主走 /topic/setOwners）
        if (StringUtils.isNotBlank(ownerId) && Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER
                && userMapper.selectById(ownerId) != null) {
            t.setOwnerId(ownerId);
            t.setOwnerIds(JSON.toJSONString(Collections.singletonList(ownerId)));
        }
        topicMapper.updateById(t);
        return new Result<>(0, "已保存", null);
    }

    /**
     * 更换该专题的题主（超管专用）。题主**有且只有一个**：ownerIds 传一个用户 id，
     * 原题主自动卸任；新题主若在小题主名单里则自动移出（题主身份覆盖小题主）。
     */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/setOwners")
    public Object setOwners(String topicId, String ownerIds) {
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        List<String> valid = new ArrayList<>();
        for (String raw : StringUtils.split(StringUtils.trimToEmpty(ownerIds), ',')) {
            String id = raw.trim();
            if (!id.isEmpty() && !valid.contains(id) && userMapper.selectById(id) != null) {
                valid.add(id);
            }
        }
        if (valid.size() != 1) {
            return new Result<>(1, "题主有且只有一个，请指定一个有效用户", null);
        }
        String ownerId = valid.get(0);
        t.setOwnerId(ownerId);
        t.setOwnerIds(JSON.toJSONString(Collections.singletonList(ownerId)));
        // 新题主从小题主名单里除名（避免占用 3 个名额之一）
        if (StringUtils.isNotBlank(t.getSubOwnerIds())) {
            try {
                List<String> subs = JSON.parseArray(t.getSubOwnerIds(), String.class);
                if (subs.remove(ownerId)) {
                    t.setSubOwnerIds(JSON.toJSONString(subs));
                }
            } catch (Exception ignore) {
                // 脏数据不动
            }
        }
        topicMapper.updateById(t);
        return new Result<>(0, "已更换题主", null);
    }

    /**
     * 设置该专题的小题主（题主或超管，最多 3 人）。subOwnerIds 为逗号分隔的用户 id；
     * 去重、校验存在、剔除已是题主的 id；传空=清空。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/setSubOwners")
    public Object setSubOwners(String topicId, String subOwnerIds, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        if (!(Role.fromUserRole(me.getUserRole()) == Role.SUPER_MANAGER || perms.isOwner(me, t))) {
            return new Result<>(1, "只有题主可以设置小题主", null);
        }
        Set<String> owners = perms.ownerIds(t);
        List<String> valid = new ArrayList<>();
        for (String raw : StringUtils.split(StringUtils.trimToEmpty(subOwnerIds), ',')) {
            String id = raw.trim();
            if (!id.isEmpty() && !valid.contains(id) && !owners.contains(id) && userMapper.selectById(id) != null) {
                valid.add(id);
            }
        }
        if (valid.size() > 3) {
            return new Result<>(1, "每个专题最多 3 个小题主", null);
        }
        t.setSubOwnerIds(JSON.toJSONString(valid));
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
        subscriptionMapper.delete(new QueryWrapper<com.dream.basketball.entity.TopicSubscription>().eq("TOPIC_ID", topicId));
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
        // 小题主不能动题主的成员行
        if (!perms.canActOn(SecUtil.getLoginUserToSession(request), t, userId)) {
            return new Result<>(1, "小题主不能对题主进行操作", null);
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

    // ===== 订阅（侧栏快捷入口；只能订阅已加入的专题） =====

    /** 订阅/取消订阅（toggle）。返回最新 subscribed 状态。 */
    @RequiresRole(Role.USER)
    @PostMapping("/subscribe")
    public Object subscribe(String topicId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (t == null) {
            return new Result<>(1, "专题不存在", null);
        }
        if (!(perms.canManage(me, t) || perms.isMember(me, t))) {
            return new Result<>(1, "先加入该专题才能订阅", null);
        }
        QueryWrapper<com.dream.basketball.entity.TopicSubscription> q =
                new QueryWrapper<com.dream.basketball.entity.TopicSubscription>()
                        .eq("USER_ID", me.getUserId()).eq("TOPIC_ID", topicId);
        if (subscriptionMapper.selectCount(q) > 0) {
            subscriptionMapper.delete(q);
            return new Result<>(0, "已取消订阅", false);
        }
        com.dream.basketball.entity.TopicSubscription sub = new com.dream.basketball.entity.TopicSubscription();
        sub.setId(UUID.randomUUID().toString());
        sub.setUserId(me.getUserId());
        sub.setTopicId(topicId);
        sub.setCreateTime(new Date());
        subscriptionMapper.insert(sub);
        return new Result<>(0, "已订阅", true);
    }

    /** 我订阅的专题（侧栏折叠菜单用）：[{topicId, name}]，按订阅先后。 */
    @RequiresRole(Role.USER)
    @GetMapping("/mySubscriptions")
    public Object mySubscriptions(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, Date> seenMap = new HashMap<>();
        for (com.dream.basketball.entity.TopicSeen ts : seenMapper.selectList(
                new QueryWrapper<com.dream.basketball.entity.TopicSeen>().eq("USER_ID", me.getUserId()))) {
            seenMap.put(ts.getTopicId(), ts.getLastSeen());
        }
        for (com.dream.basketball.entity.TopicSubscription sub : subscriptionMapper.selectList(
                new QueryWrapper<com.dream.basketball.entity.TopicSubscription>()
                        .eq("USER_ID", me.getUserId()).orderByAsc("CREATE_TIME"))) {
            ForumTopic t = topicMapper.selectById(sub.getTopicId());
            if (t == null) {
                continue; // 专题已删，跳过（行留着无害）
            }
            Map<String, Object> m = new HashMap<>();
            m.put("topicId", t.getTopicId());
            m.put("name", t.getName());
            Date seen = seenMap.get(t.getTopicId());
            m.put("newCount", seen == null ? 0 : newActivityCount(t.getTopicId(), seen, me.getUserId()));
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /** 进入专题页时打卡"已看到此刻"：红点归零、之后的新发帖/评论重新累计。 */
    @RequiresRole(Role.USER)
    @PostMapping("/markSeen")
    public Object markSeen(String topicId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (perms.getTopic(topicId) == null) {
            return new Result<>(1, "专题不存在", null);
        }
        com.dream.basketball.entity.TopicSeen row = seenMapper.selectOne(
                new QueryWrapper<com.dream.basketball.entity.TopicSeen>()
                        .eq("USER_ID", me.getUserId()).eq("TOPIC_ID", topicId));
        if (row == null) {
            row = new com.dream.basketball.entity.TopicSeen();
            row.setId(UUID.randomUUID().toString());
            row.setUserId(me.getUserId());
            row.setTopicId(topicId);
            row.setLastSeen(new Date());
            seenMapper.insert(row);
        } else {
            row.setLastSeen(new Date());
            seenMapper.updateById(row);
        }
        return new Result<>(0, "成功", null);
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
        if (!perms.canActOn(me, t, r.getUserId())) {
            return new Result<>(1, "小题主不能对题主进行操作", null);
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

    /** 移除一个成员（admin / 题主 / 小题主；小题主不能移除题主）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/removeMember")
    public Object removeMember(String topicId, String userId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (t == null || !perms.canManage(me, t)) {
            return new Result<>(1, "无权管理该专题", null);
        }
        if (!perms.canActOn(me, t, userId)) {
            return new Result<>(1, "小题主不能对题主进行操作", null);
        }
        memberMapper.delete(new QueryWrapper<ForumTopicMember>().eq("TOPIC_ID", topicId).eq("USER_ID", userId));
        return new Result<>(0, "已移除", null);
    }
}
