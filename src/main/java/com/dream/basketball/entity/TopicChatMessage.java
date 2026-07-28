package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * 专题群聊的一条消息。
 *
 * 只存最朴素的四样：谁、在哪个专题、说了什么、什么时候。已读状态不存——群聊里
 * 「谁读到哪儿了」要么按人存一份游标（成本随人数涨），要么干脆不做；私信那种
 * 一对一的已读回执搬过来并不合适。
 */
@TableName("topic_chat_message")
public class TopicChatMessage extends Model<TopicChatMessage> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "MSG_ID", type = IdType.INPUT)
    private String msgId;

    @TableField("TOPIC_ID")
    private String topicId;

    @TableField("SENDER_ID")
    private String senderId;

    @TableField("CONTENT")
    private String content;

    @TableField("SEND_TIME")
    private Date sendTime;

    public String getMsgId() {
        return msgId;
    }

    public void setMsgId(String msgId) {
        this.msgId = msgId;
    }

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Date getSendTime() {
        return sendTime;
    }

    public void setSendTime(Date sendTime) {
        this.sendTime = sendTime;
    }
}
