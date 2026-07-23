package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * Per-user "last visited" mark for a topic — drives the red new-activity badge
 * (posts/comments after LAST_SEEN count as new; visiting the topic resets it).
 * No row = badge stays 0 until the first visit starts tracking.
 */
@TableName("topic_seen")
public class TopicSeen extends Model<TopicSeen> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "ID", type = IdType.INPUT)
    private String id;

    @TableField("USER_ID")
    private String userId;

    @TableField("TOPIC_ID")
    private String topicId;

    @TableField("LAST_SEEN")
    private Date lastSeen;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public Date getLastSeen() {
        return lastSeen;
    }

    public void setLastSeen(Date lastSeen) {
        this.lastSeen = lastSeen;
    }
}
