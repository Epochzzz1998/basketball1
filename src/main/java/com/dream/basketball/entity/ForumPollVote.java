package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/** One user's choice on a poll item — unique (ITEM_ID, USER_ID); revote updates OPTION_INDEX. */
@TableName("forum_poll_vote")
public class ForumPollVote extends Model<ForumPollVote> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "VOTE_ID", type = IdType.INPUT)
    private String voteId;

    @TableField("ITEM_ID")
    private String itemId;

    @TableField("USER_ID")
    private String userId;

    /** 0-based index into the item's OPTIONS array */
    @TableField("OPTION_INDEX")
    private Integer optionIndex;

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

    public Integer getOptionIndex() {
        return optionIndex;
    }

    public void setOptionIndex(Integer optionIndex) {
        this.optionIndex = optionIndex;
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
