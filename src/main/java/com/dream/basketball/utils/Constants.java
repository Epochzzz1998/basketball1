package com.dream.basketball.utils;

public class Constants {
    // 用户状态
    public static final Integer DISABLE = 0; // 禁用

    public static final Integer USABLE = 1; // 启用

    public static final Integer CHECKING = 2; // 审核中

    public static final Integer SILENCED = 3; // 禁言中

    // 用户身份
    public static final String SUPER_MANAGER = "superManager"; // 超级管理员

    public static final String MANAGER = "manager"; // 管理员

    public static final String NORMAL_USER = "normalUser"; // 普通用户

    // 用户是否球员认证
    public static final Integer UNIDENTIFICATION = 0; // 未认证

    public static final Integer IDENTIFICATION = 1; // 已认证

    // cookie相关参数
    public static final String TOKEN = "token"; // token

    public static final String OPENID = "openid"; // openid

    public static final Integer EXPIRE = 7200;

    public static final String TOPIC_COMMENT = "TOPIC_COMMENT";

    public static final String TOPIC_LIKE = "TOPIC_LIKE";

    public static final String TOPIC_FOLLOW = "TOPIC_FOLLOW";

    public static final String GOOD_COMMENT = "goodComment";

    public static final String BAD_COMMENT = "badComment";

    public static final String GOOD_NEWS = "goodNews";

    public static final String BAD_NEWS = "badNews";

    public static final String COMMENT_NEWS = "commentNews";

    public static final String COMMENT_COMMENT = "commentComment";

    public static final String TO_READ = "toRead";

    public static final String READ = "read";

    public static final String NO_ANCHOR = "noAnchor";
}
