package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * A poll ("投票") inside a post — same ownership model as rating items: only the post author
 * opens them, one on the post itself (COMMENT_ID null) plus follow-ups attached to the author's
 * level-1 comments. Voters pick ONE option (revote = change). Votes live in forum_poll_vote.
 */
@TableName("forum_poll_item")
public class ForumPollItem extends Model<ForumPollItem> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ITEM_ID", type = IdType.INPUT)
    private String itemId;

    @TableField("NEWS_ID")
    private String newsId;

    /** null = opened on the post itself; else the author's level-1 comment that opened it */
    @TableField("COMMENT_ID")
    private String commentId;

    /** the poll question, free text, <= 30 chars */
    @TableField("SUBJECT")
    private String subject;

    /** JSON array of option texts, 2-10 options, each <= 20 chars */
    @TableField("OPTIONS")
    private String options;

    @TableField("CREATE_BY")
    private String createBy;

    @TableField("CREATE_TIME")
    private Date createTime;

    public String getItemId() {
        return itemId;
    }

    public void setItemId(String itemId) {
        this.itemId = itemId;
    }

    public String getNewsId() {
        return newsId;
    }

    public void setNewsId(String newsId) {
        this.newsId = newsId;
    }

    public String getCommentId() {
        return commentId;
    }

    public void setCommentId(String commentId) {
        this.commentId = commentId;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getOptions() {
        return options;
    }

    public void setOptions(String options) {
        this.options = options;
    }

    public String getCreateBy() {
        return createBy;
    }

    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
}
