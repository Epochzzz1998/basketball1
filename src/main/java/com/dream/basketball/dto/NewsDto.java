package com.dream.basketball.dto;

import com.dream.basketball.esEntity.News;
import lombok.Data;

@Data
public class NewsDto extends News {

    private Integer goodNum;

    private Integer badNum;

    private Integer commentNum;

    /** author's uploaded avatar (batch-filled from dream_user; null if never uploaded) */
    private String authorAvatar;

    /** 作者是否超级管理员（前端显示「超管」标识） */
    private Boolean authorSuperManager;

    /** 作者若为已认证球员：球员 id + 姓名（前端显示认证徽章，和评论区一致） */
    private String authorVerifiedPlayerId;
    private String authorVerifiedPlayerName;

    /** 作者头衔（逗号分隔，读时填充），展示在作者名旁 */
    private String authorTitles;

    /** 收藏数（列表读时按 NEWS_ID 批量 COUNT 回填，和点赞/评论数同展示位） */
    private Integer favoriteCount;

}
