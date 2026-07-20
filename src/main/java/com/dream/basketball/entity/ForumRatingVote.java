package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * One user's 1-5 star vote on a rating item. (ITEM_ID, USER_ID) is unique — voting again
 * just updates the score, so there is no way to stack votes.
 */
@TableName("forum_rating_vote")
public class ForumRatingVote extends Model<ForumRatingVote> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "VOTE_ID", type = IdType.INPUT)
    private String voteId;

    @TableField("ITEM_ID")
    private String itemId;

    @TableField("USER_ID")
    private String userId;

    /** 1..5 */
    @TableField("SCORE")
    private Integer score;

    @TableField("CREATE_TIME")
    private Date createTime;

    @TableField("UPDATE_TIME")
    private Date updateTime;

    public String getVoteId() {
        return voteId;
    }

    public void setVoteId(String voteId) {
        this.voteId = voteId;
    }

    public String getItemId() {
        return itemId;
    }

    public void setItemId(String itemId) {
        this.itemId = itemId;
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
