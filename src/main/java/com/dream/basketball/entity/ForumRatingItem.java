package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * A rating item ("为 XX 打分", 1-5 stars) inside a post. Only the post author opens them:
 * one on the post itself (COMMENT_ID null, set when publishing) and any number of follow-ups,
 * each attached to a level-1 comment the author posts. Votes live in forum_rating_vote.
 */
@TableName("forum_rating_item")
public class ForumRatingItem extends Model<ForumRatingItem> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ITEM_ID", type = IdType.INPUT)
    private String itemId;

    @TableField("NEWS_ID")
    private String newsId;

    /** null = opened on the post itself; else the author's level-1 comment that opened it */
    @TableField("COMMENT_ID")
    private String commentId;

    /** what is being rated, free text (e.g. a player name), <= 30 chars */
    @TableField("SUBJECT")
    private String subject;

    /** optional picture of the rated subject; uploaded via /news/upload so it lives (and dies) with the post's folder */
    @TableField("IMAGE_URL")
    private String imageUrl;

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

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
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
