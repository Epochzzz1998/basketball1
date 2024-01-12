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
}
