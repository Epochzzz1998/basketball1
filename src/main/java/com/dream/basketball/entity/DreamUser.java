package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import org.hibernate.annotations.Comment;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import java.io.Serializable;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 用户实体类
 * @Date 2023/2/2 9:23
 * @Param
 * @return
 **/
@Entity
@Table(name = "DREAM_USER")
public class DreamUser extends Model<DreamUser> implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "USER_ID", columnDefinition = "VARCHAR2(100)")
    @Comment("用户ID")
    @TableId(value = "USER_ID", type = IdType.INPUT)
    private String userId;

    @Column(name = "PASSWORD", columnDefinition = "VARCHAR2(100)")
    @Comment("密码")
    @TableField("PASSWORD")
    private String password;

    @Column(name = "USER_NAME", columnDefinition = "VARCHAR2(100)")
    @Comment("用户实名")
    @TableField("USER_NAME")
    private String userName;

    @Column(name = "USER_NICKNAME", columnDefinition = "VARCHAR2(100)")
    @Comment("用户昵称")
    @TableField("USER_NICKNAME")
    private String userNickname;

    @Column(name = "USER_ROLE", columnDefinition = "VARCHAR2(100)")
    @Comment("用户角色")
    @TableField("USER_ROLE")
    private String userRole;

    @Column(name = "PLAYER_ID", columnDefinition = "VARCHAR2(100)")
    @Comment("球员ID")
    @TableField("PLAYER_ID")
    private String playerId;

    @Column(name = "PLAYER_IDENTIFICATION", columnDefinition = "NUMBER(1)")
    @Comment("球员认证")
    @TableField("PLAYER_IDENTIFICATION")
    private Integer playerIdentification;

    @Column(name = "USER_STATUS", columnDefinition = "NUMBER(1)")
    @Comment("用户状态")
    @TableField("USER_STATUS")
    private Integer userStatus;

    @Column(name = "REGIST_TIME", columnDefinition = "DATE")
    @Comment("注册时间")
    @TableField("REGIST_TIME")
    private Date registTime;

    @Column(name = "LAST_LOGIN_TIME", columnDefinition = "DATE")
    @Comment("最后一次登录时间")
    @TableField("LAST_LOGIN_TIME")
    private Date lastLoginTime;

    @Column(name = "CHECK_TIME", columnDefinition = "DATE")
    @Comment("审核时间")
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