package com.dream.basketball.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import org.hibernate.annotations.Comment;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import java.io.Serializable;
import java.util.Date;

/**
 * @Author Epoch
 * @Description 个人消息通知实体类
 * @Date 2024/1/30 17:49
 * @Param
 * @return
 **/
@Entity
@Table(name = "USER_INFORMATION")
public class UserInformation extends Model<UserInformation> implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "USER_INFORMATION_ID", columnDefinition = "VARCHAR(100)")
    @Comment("主键")
    @TableId(value = "USER_INFORMATION_ID", type = IdType.INPUT)
    private String userInformationId;

    @Column(name = "MSG_TYPE", columnDefinition = "VARCHAR(100)")
    @Comment("消息类型")
    @TableField("MSG_TYPE")
    private String msgType;

    @Column(name = "MSG_ID", columnDefinition = "VARCHAR(100)")
    @Comment("消息源ID")
    @TableField("MSG_ID")
    private String msgId;

    @Column(name = "MSG_ID_SECOND", columnDefinition = "VARCHAR(100)")
    @Comment("消息源ID额外ID2")
    @TableField("MSG_ID_SECOND")
    private String msgIdSecond;

    @Column(name = "MSG_ID_THIRD", columnDefinition = "VARCHAR(100)")
    @Comment("消息源ID额外ID3")
    @TableField("MSG_ID_THIRD")
    private String msgIdThird;

    @Column(name = "CONTENT", columnDefinition = "VARCHAR(255)")
    @Comment("原消息内容")
    @TableField("CONTENT")
    private String content;

    @Column(name = "CONTENT_MSG", columnDefinition = "VARCHAR(255)")
    @Comment("消息所携带的内容")
    @TableField("CONTENT_MSG")
    private String contentMsg;

    @Column(name = "OPERATOR_ID", columnDefinition = "VARCHAR(100)")
    @Comment("消息制造者ID")
    @TableField("OPERATOR_ID")
    private String operatorId;

    @Column(name = "OPERATOR_NAME", columnDefinition = "VARCHAR(255)")
    @Comment("消息制造者姓名")
    @TableField("OPERATOR_NAME")
    private String operatorName;

    @Column(name = "RECEIVER_ID", columnDefinition = "VARCHAR(100)")
    @Comment("消息接收者ID")
    @TableField("RECEIVER_ID")
    private String receiverId;

    @Column(name = "RECEIVER_NAME", columnDefinition = "VARCHAR(255)")
    @Comment("消息接收者姓名")
    @TableField("RECEIVER_NAME")
    private String receiverName;

    @Column(name = "WHETHER_READ", columnDefinition = "VARCHAR(10)")
    @Comment("是否已读")
    @TableField("WHETHER_READ")
    private String whetherRead;

    @Column(name = "MSG_DATE", columnDefinition = "DATETIME")
    @Comment("操作时间")
    @TableField("MSG_DATE")
    private Date msgDate;

    @Column(name = "LEVEL", columnDefinition = "VARCHAR(10)")
    @Comment("评论的层级")
    @TableField("LEVEL")
    private String level;

    @Column(name = "COMMENT_REL_REL_ID", columnDefinition = "VARCHAR(100)")
    @Comment("展示原贴的时候需要提供被评论的评论的关联评论id")
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