package com.dream.basketball.utils;

public class Constants {
    /** 用户没有单独设置配额时，能创建的专题数上限（dream_user.TOPIC_LIMIT 为 null 时生效） */
    public static final int DEFAULT_TOPIC_LIMIT = 2;

    // 用户状态
    public static final Integer DISABLE = 0; // 禁用

    public static final Integer USABLE = 1; // 启用

    public static final Integer CHECKING = 2; // 审核中

    public static final Integer SILENCED = 3; // 禁言中

    // 用户身份
    public static final String SUPER_MANAGER = "superManager"; // 超级管理员

    public static final String MANAGER = "manager"; // 管理员

    public static final String NORMAL_USER = "normalUser"; // 普通用户

    public static final String GOOD_COMMENT = "goodComment";

    public static final String BAD_COMMENT = "badComment";

    public static final String GOOD_NEWS = "goodNews";

    public static final String BAD_NEWS = "badNews";

    public static final String COMMENT_NEWS = "commentNews";

    public static final String COMMENT_COMMENT = "commentComment";

    /** @-mention inside a comment (someone @'d you in a comment/reply) */
    public static final String MENTION_COMMENT = "mentionComment";

    /** @-mention inside a post body (someone @'d you in a news/forum post) */
    public static final String MENTION_NEWS = "mentionNews";

    /** a schedule event was assigned to you (immediate, from the event creator) */
    public static final String SCHEDULE_ASSIGN = "scheduleAssign";

    /** 8am digest of today's schedule events you are responsible for */
    public static final String SCHEDULE_REMIND = "scheduleRemind";

    /** a schedule event passed its deadline without being done (one-shot) */
    public static final String SCHEDULE_OVERDUE = "scheduleOverdue";

    /** a recurring schedule event ends tomorrow — extend it if still needed (one-shot, reset on extend) */
    public static final String SCHEDULE_EXPIRY = "scheduleExpiry";

    /** someone applied to join your topic (to the topic owner) */
    public static final String TOPIC_APPLY = "topicApply";

    /** your topic join request was approved (to the applicant) */
    public static final String TOPIC_APPROVED = "topicApproved";

    /** your topic join request was rejected (to the applicant) */
    public static final String TOPIC_REJECTED = "topicRejected";

    /** someone followed you (msgId = the follower's userId, click through to their profile) */
    public static final String FOLLOW = "follow";

    public static final String TO_READ = "toRead";

    public static final String READ = "read";

    public static final String NO_ANCHOR = "noAnchor";

    // 球员生涯汇总行的 season / season_num 取值（原代码散落的魔法数 50）
    public static final int CAREER_SUMMARY_SEASON = 99; // decimal(2,0) ceiling; real seasons top out at 98

    // News channel: official zone is manager-published; user posts land in the forum.
    // Legacy documents saved before this field existed count as forum (see getMatchSearch).
    public static final String NEWS_CHANNEL_OFFICIAL = "official";

    public static final String NEWS_CHANNEL_FORUM = "forum";

    /**
     * 官方新闻模块的全站开关（暂时关闭）。关掉后官方频道的读写接口一律不响应，
     * 已有的官方帖留在库里、只是没人看得到。前端有一份同名开关（config/modules.js）
     * 负责藏菜单和拦路由，两边要一起改。
     */
    public static final boolean NEWS_MODULE_ENABLED = false;
}
