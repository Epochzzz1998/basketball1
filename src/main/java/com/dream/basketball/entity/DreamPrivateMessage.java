package com.dream.basketball.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * Private message between two users (P5 direct-message feature).
 * One row per message; conversations are derived from the pair (sender, receiver).
 * Recall keeps the row but blanks it out for both sides; per-side conversation
 * delete only hides rows for that side (the other side is unaffected).
 */
@TableName("dream_private_message")
public class DreamPrivateMessage extends Model<DreamPrivateMessage> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "PM_ID", type = IdType.INPUT)
    private String pmId;

    @TableField("SENDER_ID")
    private String senderId;

    @TableField("RECEIVER_ID")
    private String receiverId;

    @TableField("CONTENT")
    private String content;

    @TableField("SEND_TIME")
    private Date sendTime;

    /** 'toRead' / 'read' — same convention as user_information */
    @TableField("WHETHER_READ")
    private String whetherRead;

    /** '1' = recalled by sender (within the recall window) */
    @TableField("RECALLED")
    private String recalled;

    /** '1' = hidden on sender's side (conversation deleted by sender) */
    @TableField("SENDER_DELETED")
    private String senderDeleted;

    /** '1' = hidden on receiver's side (conversation deleted by receiver) */
    @TableField("RECEIVER_DELETED")
    private String receiverDeleted;

    public String getPmId() {
        return pmId;
    }

    public void setPmId(String pmId) {
        this.pmId = pmId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
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

    public String getWhetherRead() {
        return whetherRead;
    }

    public void setWhetherRead(String whetherRead) {
        this.whetherRead = whetherRead;
    }

    public String getRecalled() {
        return recalled;
    }

    public void setRecalled(String recalled) {
        this.recalled = recalled;
    }

    public String getSenderDeleted() {
        return senderDeleted;
    }

    public void setSenderDeleted(String senderDeleted) {
        this.senderDeleted = senderDeleted;
    }

    public String getReceiverDeleted() {
        return receiverDeleted;
    }

    public void setReceiverDeleted(String receiverDeleted) {
        this.receiverDeleted = receiverDeleted;
    }
}
