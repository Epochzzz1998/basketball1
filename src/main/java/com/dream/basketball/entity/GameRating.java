package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

/**
 * 一个人对一场比赛的评分和短评。
 *
 * <p>{@code (GAME_ID, USER_ID)} 唯一——再评一次是**改**，不是追加。评分不是评论区，
 * 一个人对同一场比赛只该有一个态度；允许叠加的话平均分就成了「谁点得多谁说了算」。
 *
 * <p>{@code SCORE} 可以为空：有人只想说一句「裁判有问题」而不打分。
 * 反过来只打分不说话也行，两个字段互相独立。
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

    @TableField("COMMENT_TXT")
    private String commentTxt;

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

    public String getCommentTxt() {
        return commentTxt;
    }

    public void setCommentTxt(String commentTxt) {
        this.commentTxt = commentTxt;
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
