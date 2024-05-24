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
 * @Description 论坛新闻、帖子实体类
 * @Date 2024/1/17 16:49
 * @Param
 * @return
 **/
@Entity
@Table(name = "DREAM_NEWS")
public class DreamNews extends Model<DreamNews> implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "NEWS_ID", columnDefinition = "VARCHAR(100)")
    @Comment("新闻ID")
    @TableId(value = "NEWS_ID", type = IdType.INPUT)
    private String newsId;

    @Column(name = "TITLE", columnDefinition = "VARCHAR(100)")
    @Comment("标题")
    @TableField("TITLE")
    private String title;

    @Column(name = "CONTENT", columnDefinition = "TEXT")
    @Comment("内容")
    @TableField("CONTENT")
    private String content;

    @Column(name = "AUTHOR", columnDefinition = "VARCHAR(100)")
    @Comment("作者")
    @TableField("AUTHOR")
    private String author;

    @Column(name = "AUTHOR_ID", columnDefinition = "VARCHAR(100)")
    @Comment("作者ID")
    @TableField("AUTHOR_ID")
    private String authorId;

    @Column(name = "PUBLISH_DATE", columnDefinition = "DATETIME")
    @Comment("发布时间")
    @TableField("PUBLISH_DATE")
    private Date publishDate;

    @Column(name = "TEAM", columnDefinition = "VARCHAR(100)")
    @Comment("球队")
    @TableField("TEAM")
    private String team;

    @Column(name = "NEWS_TYPE", columnDefinition = "VARCHAR(100)")
    @Comment("新闻类型")
    @TableField("NEWS_TYPE")
    private String newsType;

    @Column(name = "GOOD_NUM", columnDefinition = "NUMERIC(10)")
    @Comment("点赞数")
    @TableField("GOOD_NUM")
    private Integer goodNum;

    @Column(name = "BAD_NUM", columnDefinition = "NUMERIC(10)")
    @Comment("点踩数")
    @TableField("BAD_NUM")
    private Integer badNum;

    @Column(name = "COMMENT_NUM", columnDefinition = "NUMERIC(10)")
    @Comment("评论数")
    @TableField("COMMENT_NUM")
    private Integer commentNum;

    public String getNewsId() {
        return newsId;
    }

    public void setNewsId(String newsId) {
        this.newsId = newsId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public Date getPublishDate() {
        return publishDate;
    }

    public void setPublishDate(Date publishDate) {
        this.publishDate = publishDate;
    }

    public String getTeam() {
        return team;
    }

    public void setTeam(String team) {
        this.team = team;
    }

    public String getNewsType() {
        return newsType;
    }

    public void setNewsType(String newsType) {
        this.newsType = newsType;
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

    public Integer getCommentNum() {
        return commentNum;
    }

    public void setCommentNum(Integer commentNum) {
        this.commentNum = commentNum;
    }
}