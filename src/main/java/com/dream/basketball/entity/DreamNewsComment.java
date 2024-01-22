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
 * @Description 论坛新闻、帖子评论实体类
 * @Date 2024/1/17 16:49
 * @Param
 * @return
 **/
@Entity
@Table(name = "DREAM_NEWS_COMMENT")
public class DreamNewsComment extends Model<DreamNewsComment> implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "COMMENT_ID", columnDefinition = "VARCHAR(100)")
    @Comment("评论ID")
    @TableId(value = "COMMENT_ID", type = IdType.INPUT)
    private String commentId;

    @Column(name = "USER_ID", columnDefinition = "VARCHAR(100)")
    @Comment("用户ID")
    @TableField("USER_ID")
    private String userId;

    @Column(name = "USER_NAME", columnDefinition = "VARCHAR(100)")
    @Comment("用户名称")
    @TableField("USER_NAME")
    private String userName;

    @Column(name = "CONTENT", columnDefinition = "TEXT")
    @Comment("内容")
    @TableField("CONTENT")
    private String content;

    @Column(name = "NEWS_ID", columnDefinition = "VARCHAR(100)")
    @Comment("新闻帖子ID")
    @TableField("NEWS_ID")
    private String newsId;

    @Column(name = "COMMENT_DATE", columnDefinition = "DATE")
    @Comment("评论时间")
    @TableField("COMMENT_DATE")
    private Date commentDate;

    @Column(name = "TEAM", columnDefinition = "VARCHAR(100)")
    @Comment("球队")
    @TableField("TEAM")
    private String team;

    @Column(name = "GOOD_NUM", columnDefinition = "NUMERIC(10)")
    @Comment("点赞数")
    @TableField("GOOD_NUM")
    private Integer goodNum;

    @Column(name = "BAD_NUM", columnDefinition = "NUMERIC(10)")
    @Comment("点踩数")
    @TableField("BAD_NUM")
    private Integer badNum;

    @Column(name = "COMMENT_REL_ID", columnDefinition = "VARCHAR(100)")
    @Comment("评论的评论ID")
    @TableField("COMMENT_REL_ID")
    private String commentRelId;

    @Column(name = "FLOOR", columnDefinition = "NUMERIC(10)")
    @Comment("楼层数")
    @TableField("FLOOR")
    private Integer floor;

    @Column(name = "LEVEL", columnDefinition = "VARCHAR(100)")
    @Comment("评论级别")
    @TableField("LEVEL")
    private String level;

    public String getCommentId() {
        return commentId;
    }

    public void setCommentId(String commentId) {
        this.commentId = commentId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getNewsId() {
        return newsId;
    }

    public void setNewsId(String newsId) {
        this.newsId = newsId;
    }

    public Date getCommentDate() {
        return commentDate;
    }

    public void setCommentDate(Date commentDate) {
        this.commentDate = commentDate;
    }

    public String getTeam() {
        return team;
    }

    public void setTeam(String team) {
        this.team = team;
    }

    public Integer getGoodNum() {
        return goodNum;
    }

    public void setGoodNum(Integer goodNum) {
        this.goodNum = goodNum;
    }

    public Integer getBadNum() {
        return badNum;
    }

    public void setBadNum(Integer badNum) {
        this.badNum = badNum;
    }

    public String getCommentRelId() {
        return commentRelId;
    }

    public void setCommentRelId(String commentRelId) {
        this.commentRelId = commentRelId;
    }

    public Integer getFloor() {
        return floor;
    }

    public void setFloor(Integer floor) {
        this.floor = floor;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }
}