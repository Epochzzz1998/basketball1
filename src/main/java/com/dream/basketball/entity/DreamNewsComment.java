package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 论坛新闻、帖子评论实体类
 * @Date 2024/1/17 16:49
 * @Param
 * @return
 **/
public class DreamNewsComment extends Model<DreamNewsComment> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "COMMENT_ID", type = IdType.INPUT)
    private String commentId;

    @TableField("USER_ID")
    private String userId;

    @TableField("USER_NAME")
    private String userName;

    @TableField("CONTENT")
    private String content;

    @TableField("NEWS_ID")
    private String newsId;

    @TableField("COMMENT_DATE")
    private Date commentDate;

    @TableField("TEAM")
    private String team;

    @TableField("GOOD_NUM")
    private Integer goodNum;

    @TableField("BAD_NUM")
    private Integer badNum;

    @TableField("COMMENT_REL_ID")
    private String commentRelId;

    @TableField("FLOOR")
    private Integer floor;

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