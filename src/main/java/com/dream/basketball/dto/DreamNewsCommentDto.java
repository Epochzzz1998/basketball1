package com.dream.basketball.dto;

import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.News;
import lombok.Data;

@Data
public class DreamNewsCommentDto extends DreamNewsComment {

    private Integer commentNum;

    private String anchorId;

    /** 评论者头衔（逗号分隔，读时填充），展示在评论者名旁 */
    private String titles;

    /** 评论者头像 URL（读时批量查询回填） */
    private String commenterAvatar;

    /** 评论者是否超级管理员（前端显示「超管」标识） */
    private Boolean superManager;

    /** 楼（一级评论）的全部子孙回复数（按 ROOT_ID 统计，供"N 条回复"按钮与楼内分页） */
    private Integer totalReplyNum;

    /** 平铺楼内回复时：被回复人（直接父评论作者）的 userId */
    private String replyToUserId;

    /** 平铺楼内回复时：被回复人的当前昵称（SQL 直连 dream_user，改名自动同步） */
    private String replyToName;

}
