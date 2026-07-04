package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * Forum topic (a permissioned sub-forum).
 *
 * Created by an admin (super manager) who assigns an owner; the owner manages who may
 * view / post / comment via forum_topic_member. Every forum post belongs to one topic.
 *
 * visibility: 'public' (anyone may view) | 'private' (only owner/admin/granted members may view).
 * openPost/openComment: for a PUBLIC topic, '1' lets any logged-in user post/comment (used by the
 * migrated general "综合讨论" topic to preserve the old open-forum behaviour); '0' restricts to the
 * member whitelist. Private topics ignore these and always use the whitelist.
 */
@TableName("forum_topic")
public class ForumTopic extends Model<ForumTopic> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "TOPIC_ID", type = IdType.INPUT)
    private String topicId;

    @TableField("NAME")
    private String name;

    @TableField("DESCRIPTION")
    private String description;

    @TableField("OWNER_ID")
    private String ownerId;

    /** 'public' | 'private' */
    @TableField("VISIBILITY")
    private String visibility;

    /** public topic: '1' = anyone logged-in may post */
    @TableField("OPEN_POST")
    private String openPost;

    /** public topic: '1' = anyone logged-in may comment */
    @TableField("OPEN_COMMENT")
    private String openComment;

    @TableField("CREATE_BY")
    private String createBy;

    @TableField("CREATE_TIME")
    private Date createTime;

    @TableField("SORT")
    private Integer sort;

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public String getOpenPost() {
        return openPost;
    }

    public void setOpenPost(String openPost) {
        this.openPost = openPost;
    }

    public String getOpenComment() {
        return openComment;
    }

    public void setOpenComment(String openComment) {
        this.openComment = openComment;
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

    public Integer getSort() {
        return sort;
    }

    public void setSort(Integer sort) {
        this.sort = sort;
    }
}
