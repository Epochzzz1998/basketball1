package com.dream.basketball.config;

import org.apache.commons.lang3.StringUtils;

import com.dream.basketball.utils.Constants;

/**
 * Access levels for @RequiresRole (P2-5), ordered by privilege.
 * Mapping mirrors the existing semantics in BaseUtils:
 * isSuperManager = exact "superManager", isManagerOrOver = role contains "manager".
 */
public enum Role {
    /** any authenticated user */
    USER(0),
    /** manager or above (matches BaseUtils.isManagerOrOver) */
    MANAGER(1),
    /** super manager only (matches BaseUtils.isSuperManager) */
    SUPER_MANAGER(2);

    private final int level;

    Role(int level) {
        this.level = level;
    }

    /** Resolve a DreamUser.userRole string to its access level. Unknown/blank roles count as USER. */
    public static Role fromUserRole(String userRole) {
        if (StringUtils.equals(userRole, Constants.SUPER_MANAGER)) {
            return SUPER_MANAGER;
        }
        if (StringUtils.containsIgnoreCase(userRole, Constants.MANAGER)) {
            return MANAGER;
        }
        return USER;
    }

    public boolean covers(Role required) {
        return this.level >= required.level;
    }
}
