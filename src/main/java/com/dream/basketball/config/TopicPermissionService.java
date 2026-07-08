package com.dream.basketball.config;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumTopic;
import com.dream.basketball.entity.ForumTopicMember;
import com.dream.basketball.mapper.ForumTopicMapper;
import com.dream.basketball.mapper.ForumTopicMemberMapper;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Central authority for "can this user view / post / comment / manage this topic".
 *
 * Rules:
 *  - admin (super manager): full access to every topic.
 *  - owner: full access to their own topic.
 *  - VIEW: public topic → anyone (incl. anonymous); private → owner/admin/member-with-view.
 *  - POST/COMMENT: must be able to VIEW first; then public+open lets any logged-in user act,
 *    otherwise the member's canPost/canComment flag decides.
 *  - a null topic means "no topic" (official news / legacy): view is public, post/comment go
 *    through the caller's own rules (this service returns false for post/comment on null topic).
 *
 * A null DreamUser is an anonymous visitor.
 */
@Component
public class TopicPermissionService {

    public static final String PUBLIC = "public";
    public static final String PRIVATE = "private";
    private static final String ON = "1";

    @Autowired
    private ForumTopicMapper topicMapper;

    @Autowired
    private ForumTopicMemberMapper memberMapper;

    public ForumTopic getTopic(String topicId) {
        return StringUtils.isBlank(topicId) ? null : topicMapper.selectById(topicId);
    }

    private boolean isAdmin(DreamUser user) {
        return user != null && Role.fromUserRole(user.getUserRole()) == Role.SUPER_MANAGER;
    }

    private boolean isPublic(ForumTopic t) {
        return t != null && !PRIVATE.equals(t.getVisibility());
    }

    private ForumTopicMember member(String topicId, DreamUser user) {
        if (user == null || StringUtils.isBlank(topicId)) {
            return null;
        }
        return memberMapper.selectOne(new QueryWrapper<ForumTopicMember>()
                .eq("TOPIC_ID", topicId).eq("USER_ID", user.getUserId()));
    }

    /**
     * 该专题的题主集合（支持多题主）：以 OWNER_IDS(JSON 数组) 为准；为空/脏数据时回退到单个 OWNER_ID。
     * 保序去重，首位即主题主。
     */
    public Set<String> ownerIds(ForumTopic t) {
        Set<String> ids = new LinkedHashSet<>();
        if (t == null) {
            return ids;
        }
        String raw = t.getOwnerIds();
        if (StringUtils.isNotBlank(raw)) {
            try {
                for (Object o : JSON.parseArray(raw)) {
                    if (o != null && StringUtils.isNotBlank(o.toString())) {
                        ids.add(o.toString());
                    }
                }
            } catch (Exception ignore) {
                // 脏数据：回退到单 owner
            }
        }
        if (ids.isEmpty() && StringUtils.isNotBlank(t.getOwnerId())) {
            ids.add(t.getOwnerId());
        }
        return ids;
    }

    /** 用户是否为该专题题主（多题主之一）。 */
    public boolean isOwner(DreamUser user, ForumTopic t) {
        return user != null && t != null && ownerIds(t).contains(user.getUserId());
    }

    /** admin or one of the topic's owners */
    public boolean canManage(DreamUser user, ForumTopic t) {
        return t != null && user != null && (isAdmin(user) || isOwner(user, t));
    }

    public boolean canView(DreamUser user, ForumTopic t) {
        if (t == null) {
            return true; // no topic (official news / legacy) → public
        }
        if (isPublic(t)) {
            return true;
        }
        if (canManage(user, t)) {
            return true;
        }
        ForumTopicMember m = member(t.getTopicId(), user);
        return m != null && ON.equals(m.getCanView());
    }

    public boolean canPost(DreamUser user, ForumTopic t) {
        if (user == null || t == null) {
            return false;
        }
        if (canManage(user, t)) {
            return true;
        }
        if (!canView(user, t)) {
            return false;
        }
        if (isPublic(t) && ON.equals(t.getOpenPost())) {
            return true;
        }
        ForumTopicMember m = member(t.getTopicId(), user);
        return m != null && ON.equals(m.getCanPost());
    }

    public boolean canComment(DreamUser user, ForumTopic t) {
        if (user == null || t == null) {
            return false;
        }
        if (canManage(user, t)) {
            return true;
        }
        if (!canView(user, t)) {
            return false;
        }
        if (isPublic(t) && ON.equals(t.getOpenComment())) {
            return true;
        }
        ForumTopicMember m = member(t.getTopicId(), user);
        return m != null && ON.equals(m.getCanComment());
    }

    /**
     * Private topic ids this user may NOT view — used to exclude their posts from global search
     * and the home hot list so private content never leaks. Admin sees everything (empty set).
     */
    public Set<String> hiddenTopicIds(DreamUser user) {
        return privateTopicIdsInternal(topicMapper.selectList(
                new QueryWrapper<ForumTopic>().eq("VISIBILITY", PRIVATE)), user);
    }

    /** 所有私密专题 id。用于把私密内容从「跨专题的公开展示位」（首页热帖 / 热榜 / 相关推荐）里排除——那些位置对谁都只展示公开专题的帖。 */
    public Set<String> privateTopicIds() {
        Set<String> ids = new HashSet<>();
        for (ForumTopic t : topicMapper.selectList(new QueryWrapper<ForumTopic>().eq("VISIBILITY", PRIVATE))) {
            ids.add(t.getTopicId());
        }
        return ids;
    }

    /** 所有「不可见」专题 id（LISTED='0'）。把下架专题的帖子从全站搜索 / 首页热榜里排除——对谁都不露（含题主本人，"不被搜到"是绝对的）。 */
    public Set<String> unlistedTopicIds() {
        Set<String> ids = new HashSet<>();
        for (ForumTopic t : topicMapper.selectList(new QueryWrapper<ForumTopic>().eq("LISTED", "0"))) {
            ids.add(t.getTopicId());
        }
        return ids;
    }

    /** 该用户是否为该专题的白名单成员（有 forum_topic_member 行）。不可见专题在列表里对成员仍放行。 */
    public boolean isMember(DreamUser user, ForumTopic t) {
        return user != null && t != null && member(t.getTopicId(), user) != null;
    }

    private Set<String> privateTopicIdsInternal(List<ForumTopic> privates, DreamUser user) {
        Set<String> hidden = new HashSet<>();
        if (privates.isEmpty() || isAdmin(user)) {
            return hidden;
        }
        Set<String> viewable = new HashSet<>();
        if (user != null) {
            for (ForumTopic t : privates) {
                if (ownerIds(t).contains(user.getUserId())) {
                    viewable.add(t.getTopicId());
                }
            }
            for (ForumTopicMember m : memberMapper.selectList(new QueryWrapper<ForumTopicMember>()
                    .eq("USER_ID", user.getUserId()).eq("CAN_VIEW", ON))) {
                viewable.add(m.getTopicId());
            }
        }
        for (ForumTopic t : privates) {
            if (!viewable.contains(t.getTopicId())) {
                hidden.add(t.getTopicId());
            }
        }
        return hidden;
    }
}
