package com.dream.basketball.dto;

import lombok.Data;

import java.util.Date;

/**
 * One row of the DM conversation list: the counterpart + last visible message + my unread count.
 * Derived from dream_private_message with a window function (see PrivateMessageMapper.xml).
 */
@Data
public class ConversationDto {

    private String peerId;

    private String peerNickname;

    private String peerAvatar;

    /** 对方头衔（逗号/JSON 串），会话头展示在名字旁 */
    private String peerTitles;

    /** 对方是否超级管理员，会话头展示超管标 */
    private Boolean peerSuperManager;

    /** last visible message content (blank when that message is recalled) */
    private String lastContent;

    private Date lastTime;

    /** whether the last message was sent by me (frontend renders "我: xxx") */
    private Boolean lastFromMe;

    /** whether the last message is recalled (frontend renders a placeholder) */
    private Boolean lastRecalled;

    /** peer→me messages still unread (recalled ones excluded) */
    private Integer unread;
}
