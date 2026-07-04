package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;

/**
 * Per-user permission grant inside a topic (the ACL the topic owner manages).
 * Three independent flags; canPost/canComment additionally require the user to be able to view
 * (enforced in TopicPermissionService, not by data). Owner and admin are NOT stored here — they
 * always have full access.
 */
@TableName("forum_topic_member")
public class ForumTopicMember extends Model<ForumTopicMember> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ID", type = IdType.INPUT)
    private String id;

    @TableField("TOPIC_ID")
    private String topicId;

    @TableField("USER_ID")
    private String userId;

    /** '1' = may view (browse the topic's posts) */
    @TableField("CAN_VIEW")
    private String canView;

    /** '1' = may create posts */
    @TableField("CAN_POST")
    private String canPost;

    /** '1' = may comment */
    @TableField("CAN_COMMENT")
    private String canComment;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getCanView() {
        return canView;
    }

    public void setCanView(String canView) {
        this.canView = canView;
    }

    public String getCanPost() {
        return canPost;
    }

    public void setCanPost(String canPost) {
        this.canPost = canPost;
    }

    public String getCanComment() {
        return canComment;
    }

    public void setCanComment(String canComment) {
        this.canComment = canComment;
    }
}
