package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.esEntity.News;

import java.util.List;

public interface DreamNewsCommentService extends IService<DreamNewsComment> {

    public Integer findMaxFloor(String newsId);

    public void goodComment(String commentId, Integer num);

    public void badComment(String commentId, Integer num);

    public List<DreamNewsCommentDto> findFlatReplies(String rootId);

}
