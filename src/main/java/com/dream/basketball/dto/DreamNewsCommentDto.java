package com.dream.basketball.dto;

import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.News;
import lombok.Data;

@Data
public class DreamNewsCommentDto extends DreamNewsComment {

    private Integer commentNum;

}
