package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 群聊已读游标：某人在某个专题里读到哪个时间点了。
 *
 * 群聊不做「每条消息谁读过」——那是按人数×条数增长的量。只存一个时间戳，
 * 未读数 = 这个时间之后的消息条数，够用且便宜。
 */
@TableName("topic_chat_read")
public class TopicChatRead extends Model<TopicChatRead> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableField("USER_ID")
    private String userId;

    @TableField("TOPIC_ID")
    private String topicId;

    @TableField("LAST_READ")
    private Date lastRead;

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

    public Date getLastRead() {
        return lastRead;
    }

    public void setLastRead(Date lastRead) {
        this.lastRead = lastRead;
    }
}
