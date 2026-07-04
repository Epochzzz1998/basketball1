package com.dream.basketball.dto;

import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.News;
import lombok.Data;

@Data
public class DreamNewsCommentDto extends DreamNewsComment {

    private Integer commentNum;

    private String anchorId;

    /** 评论者若是已认证球员，回填其绑定的球员 ID（评论区显示认证徽章并可跳生涯页） */
    private String verifiedPlayerId;

    /** 认证球员姓名（徽章展示用） */
    private String verifiedPlayerName;

    /** 评论者头像 URL（与认证标识同一把批量查询回填） */
    private String commenterAvatar;

    /** 评论者是否超级管理员（前端显示「超管」标识） */
    private Boolean superManager;

}
