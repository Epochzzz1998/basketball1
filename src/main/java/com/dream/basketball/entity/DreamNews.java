package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 论坛新闻、帖子实体类
 * @Date 2024/1/17 16:49
 * @Param
 * @return
 **/
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class DreamNews extends Model<DreamNews> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "NEWS_ID", type = IdType.INPUT)
    private String newsId;

    @TableField("TITLE")
    private String title;

    @TableField("CONTENT")
    private String content;

    @TableField("AUTHOR")
    private String author;

    @TableField("AUTHOR_ID")
    private String authorId;

    @TableField("PUBLISH_DATE")
    private Date publishDate;

    @TableField("TEAM")
    private String team;

    @TableField("NEWS_TYPE")
    private String newsType;

    @TableField("GOOD_NUM")
    private Integer goodNum;

    @TableField("BAD_NUM")
    private Integer badNum;

    @TableField("COMMENT_NUM")
    private Integer commentNum;

    /** official = manager-published news zone; forum = user posts (null on legacy rows = forum). */
    @TableField("NEWS_CHANNEL")
    private String newsChannel;

}