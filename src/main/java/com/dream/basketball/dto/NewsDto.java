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

}
