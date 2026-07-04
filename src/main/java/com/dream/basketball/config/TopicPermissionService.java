package com.dream.basketball.config;

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

    /** admin or the topic's owner */
    public boolean canManage(DreamUser user, ForumTopic t) {
        return t != null && user != null
                && (isAdmin(user) || StringUtils.equals(user.getUserId(), t.getOwnerId()));
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
        List<ForumTopic> privates = topicMapper.selectList(
                new QueryWrapper<ForumTopic>().eq("VISIBILITY", PRIVATE));
        Set<String> hidden = new HashSet<>();
        if (privates.isEmpty() || isAdmin(user)) {
            return hidden;
        }
        Set<String> viewable = new HashSet<>();
        if (user != null) {
            for (ForumTopic t : privates) {
                if (StringUtils.equals(user.getUserId(), t.getOwnerId())) {
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
