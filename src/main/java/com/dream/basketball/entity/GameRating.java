package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

/**
 * 一个人对一场比赛打的分（1..5）。
 *
 * <p>{@code (GAME_ID, USER_ID)} 唯一——再打一次是**改**，不是追加。
 * 一个人对同一场比赛只该有一个分；允许叠加的话平均分就成了「谁点得多谁说了算」。
 *
 * <p>短评**不在这里**，在 {@link GameComment}：短评可以发多条、发出去不能改，
 * 和分正好是相反的两条规则。早先它们挤在同一行，等于把「一人一个」这条
 * 顺带加在了短评上——而看到一半骂一句、看完再夸一句，是两句话。
 */
@TableName("game_rating")
public class GameRating implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "RATING_ID", type = IdType.INPUT)
    private String ratingId;

    @TableField("GAME_ID")
    private String gameId;

    @TableField("USER_ID")
    private String userId;

    /** 1..10，null = 只写了短评 */
    @TableField("SCORE")
    private Integer score;

    @TableField("CREATE_TIME")
    private Date createTime;

    @TableField("UPDATE_TIME")
    private Date updateTime;

    public String getRatingId() {
        return ratingId;
    }

    public void setRatingId(String ratingId) {
        this.ratingId = ratingId;
    }

    public String getGameId() {
        return gameId;
    }

    public void setGameId(String gameId) {
        this.gameId = gameId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public Date getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(Date updateTime) {
        this.updateTime = updateTime;
    }
}
