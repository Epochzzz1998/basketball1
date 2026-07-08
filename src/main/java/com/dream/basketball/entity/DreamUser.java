package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 用户实体类
 * @Date 2023/2/2 9:23
 * @Param
 * @return
 **/
public class DreamUser extends Model<DreamUser> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "USER_ID", type = IdType.INPUT)
    private String userId;

    @TableField("PASSWORD")
    private String password;

    @TableField("USER_NAME")
    private String userName;

    @TableField("USER_NICKNAME")
    private String userNickname;

    /** 固定登录名（注册后不可改）。与可改的 userNickname(显示名) 分离，改昵称不再影响登录。 */
    @TableField("LOGIN_NAME")
    private String loginName;

    @TableField("USER_ROLE")
    private String userRole;

    @TableField("PLAYER_ID")
    private String playerId;

    @TableField("PLAYER_IDENTIFICATION")
    private Integer playerIdentification;

    @TableField("USER_STATUS")
    private Integer userStatus;

    @TableField("REGIST_TIME")
    private Date registTime;

    @TableField("LAST_LOGIN_TIME")
    private Date lastLoginTime;

    @TableField("CHECK_TIME")
    private Date checkTime;

    @TableField("AVATAR")
    private String avatar;

    /** global permission flags (super-admin controlled): '0' = denied, null/'1' = allowed */
    @TableField("CAN_BROWSE")
    private String canBrowse;

    @TableField("CAN_COMMENT")
    private String canComment;

    @TableField("CAN_POST")
    private String canPost;

    /** 功能模块可用性（按用户，super-admin 控制）：'0'=不可用（导航里整块隐藏该模块）/ null|'1'=可用 */
    @TableField("FEAT_DATA")
    private String featData;   // Dream Union 数据分析（数据概览/联盟排行/球员对比）
    @TableField("FEAT_NEWS")
    private String featNews;   // 新闻
    @TableField("FEAT_FORUM")
    private String featForum;  // 百家说
    @TableField("FEAT_PM")
    private String featPm;     // 私信

    /** 头衔（super-admin 分配，逗号分隔，可多个；与球员认证并存）。展示在用户名旁，如 "元老,技术大牛" */
    @TableField("TITLES")
    private String titles;

    /** '1' = 在公开主页隐藏我的发帖（仅本人可见） */
    @TableField("HIDE_POSTS")
    private String hidePosts;

    /** '1' = 在公开主页隐藏我的评论（仅本人可见） */
    @TableField("HIDE_COMMENTS")
    private String hideComments;

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getCanBrowse() {
        return canBrowse;
    }

    public void setCanBrowse(String canBrowse) {
        this.canBrowse = canBrowse;
    }

    public String getCanComment() {
        return canComment;
    }

    public void setCanComment(String canComment) {
        this.canComment = canComment;
    }

    public String getCanPost() {
        return canPost;
    }

    public void setCanPost(String canPost) {
        this.canPost = canPost;
    }

    public String getFeatData() {
        return featData;
    }

    public void setFeatData(String featData) {
        this.featData = featData;
    }

    public String getFeatNews() {
        return featNews;
    }

    public void setFeatNews(String featNews) {
        this.featNews = featNews;
    }

    public String getFeatForum() {
        return featForum;
    }

    public void setFeatForum(String featForum) {
        this.featForum = featForum;
    }

    public String getFeatPm() {
        return featPm;
    }

    public void setFeatPm(String featPm) {
        this.featPm = featPm;
    }

    public String getTitles() {
        return titles;
    }

    public void setTitles(String titles) {
        this.titles = titles;
    }

    public String getHidePosts() {
        return hidePosts;
    }

    public void setHidePosts(String hidePosts) {
        this.hidePosts = hidePosts;
    }

    public String getHideComments() {
        return hideComments;
    }

    public void setHideComments(String hideComments) {
        this.hideComments = hideComments;
    }

    @Override
    public String toString() {
        return "DreamUser{" +
                "userId='" + userId + '\'' +
                ", password='" + password + '\'' +
                ", userName='" + userName + '\'' +
                ", userNickname='" + userNickname + '\'' +
                ", userRole='" + userRole + '\'' +
                ", playerId='" + playerId + '\'' +
                ", playerIdentification=" + playerIdentification +
                ", userStatus=" + userStatus +
                ", registTime=" + registTime +
                ", lastLoginTime=" + lastLoginTime +
                ", checkTime=" + checkTime +
                '}';
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getUserNickname() {
        return userNickname;
    }

    public void setUserNickname(String userNickname) {
        this.userNickname = userNickname;
    }

    public String getLoginName() {
        return loginName;
    }

    public void setLoginName(String loginName) {
        this.loginName = loginName;
    }

    public String getUserRole() {
        return userRole;
    }

    public void setUserRole(String userRole) {
        this.userRole = userRole;
    }

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }

    public Integer getUserStatus() {
        return userStatus;
    }

    public void setUserStatus(Integer userStatus) {
        this.userStatus = userStatus;
    }

    public Date getRegistTime() {
        return registTime;
    }

    public void setRegistTime(Date registTime) {
        this.registTime = registTime;
    }

    public Date getLastLoginTime() {
        return lastLoginTime;
    }

    public void setLastLoginTime(Date lastLoginTime) {
        this.lastLoginTime = lastLoginTime;
    }

    public Date getCheckTime() {
        return checkTime;
    }

    public void setCheckTime(Date checkTime) {
        this.checkTime = checkTime;
    }

    public Integer getPlayerIdentification() {
        return playerIdentification;
    }

    public void setPlayerIdentification(Integer playerIdentification) {
        this.playerIdentification = playerIdentification;
    }
}