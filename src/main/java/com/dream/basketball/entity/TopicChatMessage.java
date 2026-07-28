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

    /** '1' = 已撤回。撤回不删行：留着才知道"这里本来有条消息"，也便于日后追查 */
    @TableField("RECALLED")
    private String recalled;

    /** @ 到的人，JSON [{"id","name"}]，与评论的 MENTIONS 同构，渲染高亮和发通知都用它 */
    @TableField("MENTIONS")
    private String mentions;

    /** 图片消息的 URL；纯图片消息 CONTENT 为空串 */
    @TableField("IMAGE_URL")
    private String imageUrl;

    /** 附件（非图片）的 URL 和原始文件名。图片单独走 IMAGE_URL——它要内联显示，附件只出一行可点的名字 */
    @TableField("FILE_URL")
    private String fileUrl;

    @TableField("FILE_NAME")
    private String fileName;

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getRecalled() {
        return recalled;
    }

    public void setRecalled(String recalled) {
        this.recalled = recalled;
    }

    public String getMentions() {
        return mentions;
    }

    public void setMentions(String mentions) {
        this.mentions = mentions;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

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
