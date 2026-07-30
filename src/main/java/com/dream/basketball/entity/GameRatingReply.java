package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

/**
 * 短评底下的一条回复。
 *
 * <h2>一张表同时服务比赛短评和球员短评</h2>
 *
 * {@code TARGET_ID} 指向被回复那条短评的 {@code RATING_ID}，而
 * {@link GameRating} 和 {@link GamePlayerRating} 的主键都是 UUID，撞不到一起。
 * 所以不需要一个「这是哪种短评」的类型列，也不需要两套表两套接口——
 * 回复只关心「我在回哪一条」，那一条是什么类型是**调用方已经知道的事**。
 *
 * <h2>只做两层</h2>
 *
 * 回复不能再被回复。想指名道姓就用 {@code REPLY_TO_USER}，显示成「回复 @某某」。
 * 无限层级在这种规模的讨论里只会缩成一条越来越窄的竖条，
 * 而想表达的其实就是「我在回你」——那一句话用一个字段就说完了。
 */
@TableName("game_rating_reply")
public class GameRatingReply implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "REPLY_ID", type = IdType.INPUT)
    private String replyId;

    /** 冗余一份，好按比赛一次把回复全取回来，不用先查出所有短评 id */
    @TableField("GAME_ID")
    private String gameId;

    /** 被回复的那条短评的 RATING_ID */
    @TableField("TARGET_ID")
    private String targetId;

    @TableField("USER_ID")
    private String userId;

    /** 回复楼中楼时指向的人；null = 直接回复短评本身 */
    @TableField("REPLY_TO_USER")
    private String replyToUser;

    @TableField("CONTENT")
    private String content;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getReplyId() {
        return replyId;
    }

    public void setReplyId(String replyId) {
        this.replyId = replyId;
    }

    public String getGameId() {
        return gameId;
    }

    public void setGameId(String gameId) {
        this.gameId = gameId;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getReplyToUser() {
        return replyToUser;
    }

    public void setReplyToUser(String replyToUser) {
        this.replyToUser = replyToUser;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
