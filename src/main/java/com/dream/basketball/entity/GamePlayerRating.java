package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

/**
 * 一个人给某场比赛里某个球员打的分（1..5）和短评。
 *
 * <p>{@code (GAME_ID, PLAYER_ID, USER_ID)} 唯一，理由同 {@link GameRating}：改分而不是叠加。
 *
 * <p>分和短评放同一行，因为它们是同一件事的两面——「我怎么看他这场」。
 * 拆成两张表的话，「改了分但没改评语」这种再普通不过的操作要写两条更新，
 * 而那个唯一键也就管不住短评了。
 */
@TableName("game_player_rating")
public class GamePlayerRating implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "RATING_ID", type = IdType.INPUT)
    private String ratingId;

    @TableField("GAME_ID")
    private String gameId;

    @TableField("PLAYER_ID")
    private String playerId;

    @TableField("USER_ID")
    private String userId;

    /** 1..5 */
    @TableField("SCORE")
    private Integer score;

    /** 对这个球员这一场的短评；空 = 只打分不说话 */
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

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
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
