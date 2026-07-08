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

    /**
     * 题主集合（JSON 数组，如 ["id1","id2"]）：一个专题可有多个题主，均由超管指派。
     * OWNER_ID 保留为主题主（列表首位）作兼容/展示；此列为空时回退到 {OWNER_ID}。
     */
    @TableField("OWNER_IDS")
    private String ownerIds;

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

    /**
     * 是否在百家说里露出：'1' 可见（默认）/ '0' 不可见（下架）。
     * 不可见 = 不进专题列表（仅题主/管理员/已加入成员仍能在列表看到）、帖子不被全站搜索与首页热榜收录。
     * 与 visibility(公开/私密) 正交：前者管"能不能进"，这个管"在不在百家说露脸/被搜到"。
     */
    @TableField("LISTED")
    private String listed;

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

    public String getOwnerIds() {
        return ownerIds;
    }

    public void setOwnerIds(String ownerIds) {
        this.ownerIds = ownerIds;
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

    public String getListed() {
        return listed;
    }

    public void setListed(String listed) {
        this.listed = listed;
    }
}
