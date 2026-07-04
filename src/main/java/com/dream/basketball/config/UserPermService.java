package com.dream.basketball.config;

import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.UserMapper;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Site-wide (global) per-user permission gate, controlled by the super admin's user-management page.
 * Distinct from the per-topic ACL: these say whether a user may browse forum/news, comment, or post
 * ANYWHERE. Flags are read fresh from the DB so an admin's change takes effect on the user's next
 * action (the session copy would be stale). '0' = denied; null/blank/'1' = allowed. Anonymous
 * visitors (blank userId) aren't governed by these — public visibility is handled by the topic ACL.
 */
@Component
public class UserPermService {

    private static final String DENIED = "0";

    @Autowired
    private UserMapper userMapper;

    public boolean canBrowse(String userId) {
        DreamUser u = fresh(userId);
        return u == null || !DENIED.equals(u.getCanBrowse());
    }

    public boolean canComment(String userId) {
        DreamUser u = fresh(userId);
        return u == null || !DENIED.equals(u.getCanComment());
    }

    public boolean canPost(String userId) {
        DreamUser u = fresh(userId);
        return u == null || !DENIED.equals(u.getCanPost());
    }

    private DreamUser fresh(String userId) {
        return StringUtils.isBlank(userId) ? null : userMapper.selectById(userId);
    }
}
