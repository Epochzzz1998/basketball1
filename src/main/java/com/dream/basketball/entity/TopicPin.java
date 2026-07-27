package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * One user pinning one topic. Pinning is PER USER, not global: everyone arranges the
 * topic list for themselves, so the same topic can sit on top for one reader and
 * nowhere special for another. Newest pin sorts first, both in the 百家说 topic list
 * and in the sidebar's subscribed-topics block.
 */
@TableName("topic_pin")
public class TopicPin extends Model<TopicPin> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableField("USER_ID")
    private String userId;

    @TableField("TOPIC_ID")
    private String topicId;

    @TableField("PIN_TIME")
    private Date pinTime;

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

    public Date getPinTime() {
        return pinTime;
    }

    public void setPinTime(Date pinTime) {
        this.pinTime = pinTime;
    }
}
