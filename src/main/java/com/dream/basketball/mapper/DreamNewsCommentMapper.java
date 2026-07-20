package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.entity.DreamNewsComment;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface DreamNewsCommentMapper extends BaseMapper<DreamNewsComment> {

    public Integer findMaxFloor(@Param("newsId") String newsId);

    /** A floor's whole reply subtree, flat, oldest first (paged via PageHelper at the call site). */
    public List<DreamNewsCommentDto> findFlatReplies(@Param("rootId") String rootId);

}
