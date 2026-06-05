package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;

import java.io.Serializable;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 个人消息通知实体类
 * @Date 2024/1/30 17:49
 * @Param
 * @return
 **/
public class UserInformation extends Model<UserInformation> implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "USER_INFORMATION_ID", type = IdType.INPUT)
    private String userInformationId;

    @TableField("MSG_TYPE")
    private String msgType;

    @TableField("MSG_ID")
    private String msgId;

    @TableField("MSG_ID_SECOND")
    private String msgIdSecond;

    @TableField("MSG_ID_THIRD")
    private String msgIdThird;

    @TableField("CONTENT")
    private String content;

    @TableField("CONTENT_MSG")
    private String contentMsg;

    @TableField("OPERATOR_ID")
    private String operatorId;

    @TableField("OPERATOR_NAME")
    private String operatorName;

    @TableField("RECEIVER_ID")
    private String receiverId;

    @TableField("RECEIVER_NAME")
    private String receiverName;

    @TableField("WHETHER_READ")
    private String whetherRead;

    @TableField("MSG_DATE")
    private Date msgDate;

    @TableField("LEVEL")
    private String level;

    @TableField("COMMENT_REL_REL_ID")
    private String commentRelRelId;


    public String getUserInformationId() {
        return userInformationId;
    }

    public void setUserInformationId(String userInformationId) {
        this.userInformationId = userInformationId;
    }

    public String getMsgType() {
        return msgType;
    }

    public void setMsgType(String msgType) {
        this.msgType = msgType;
    }

    public String getMsgId() {
        return msgId;
    }

    public void setMsgId(String msgId) {
        this.msgId = msgId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }

    public String getOperatorName() {
        return operatorName;
    }

    public void setOperatorName(String operatorName) {
        this.operatorName = operatorName;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getWhetherRead() {
        return whetherRead;
    }

    public void setWhetherRead(String whetherRead) {
        this.whetherRead = whetherRead;
    }

    public String getContentMsg() {
        return contentMsg;
    }

    public void setContentMsg(String contentMsg) {
        this.contentMsg = contentMsg;
    }

    public Date getMsgDate() {
        return msgDate;
    }

    public void setMsgDate(Date msgDate) {
        this.msgDate = msgDate;
    }

    public String getMsgIdSecond() {
        return msgIdSecond;
    }

    public void setMsgIdSecond(String msgIdSecond) {
        this.msgIdSecond = msgIdSecond;
    }

    public String getMsgIdThird() {
        return msgIdThird;
    }

    public void setMsgIdThird(String msgIdThird) {
        this.msgIdThird = msgIdThird;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getCommentRelRelId() {
        return commentRelRelId;
    }

    public void setCommentRelRelId(String commentRelRelId) {
        this.commentRelRelId = commentRelRelId;
    }
}