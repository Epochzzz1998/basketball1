package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

/**
 * 一条短评：对某场比赛，或对某场里的某个球员。
 *
 * <h2>和评分是两种不同的东西</h2>
 *
 * <table>
 *   <tr><th></th><th>评分</th><th>短评</th></tr>
 *   <tr><td>一个人能有几条</td><td>一条</td><td>想发几条发几条</td></tr>
 *   <tr><td>能不能改</td><td>能，再打一次就覆盖</td><td><b>不能</b>，只能删</td></tr>
 * </table>
 *
 * <p>早先两者挤在评分行的 {@code COMMENT_TXT} 里，那种结构只支持「一条可改的评论」——
 * 它把「一个人的态度只有一个」这条规则**顺带**加在了短评上，而短评不该受这条约束。
 * 看到一半骂一句、看完再夸一句，是两句话，不是一句话改了两遍。
 *
 * <h2>没有唯一键，也没有 UPDATE_TIME</h2>
 *
 * 这两个缺席都是设计：前者因为一个人可以发多条，后者因为发出去就定了。
 * 表结构本身就说明了「不可改」这条规则，不必靠接口层去守。
 */
@TableName("game_comment")
public class GameComment implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "COMMENT_ID", type = IdType.INPUT)
    private String commentId;

    @TableField("GAME_ID")
    private String gameId;

    /**
     * 空串 = 评这场比赛本身；否则是评这个球员。
     *
     * <p>用空串而不是 null 当哨兵：这张表没有唯一键，所以不存在
     * {@link GameRating} 那里「唯一索引管不住 NULL」的问题；
     * 用空串纯粹是为了让按 PLAYER_ID 分组的代码不用到处判 null。
     */
    @TableField("PLAYER_ID")
    private String playerId;

    @TableField("USER_ID")
    private String userId;

    @TableField("CONTENT")
    private String content;

    @TableField("CREATE_TIME")
    private Date createTime;

    /**
     * 这条内容 @ 到了谁：{@code [{"id","name"}]}，发布那一刻按全站昵称解析出来的。
     *
     * <p><b>连昵称一起存。</b>正文里写的是当时那个昵称，对方改名之后文本没变，
     * 所以只能按旧名在文本里定位；显示用的是读取时补上的当前昵称。
     * 只存 id 的话，谁一改名，历史内容里那段 @ 就再也标不出来了。
     */
    @TableField("MENTIONS")
    private String mentions;

    public String getCommentId() {
        return commentId;
    }

    public void setCommentId(String commentId) {
        this.commentId = commentId;
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

    public String getMentions() {
        return mentions;
    }

    public void setMentions(String mentions) {
        this.mentions = mentions;
    }
}
