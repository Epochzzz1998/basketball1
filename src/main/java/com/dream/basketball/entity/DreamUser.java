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