package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.DreamNewsComment;
import org.apache.ibatis.annotations.Param;

public interface DreamNewsCommentMapper extends BaseMapper<DreamNewsComment> {

    public Integer findMaxFloor(@Param("newsId") String newsId);

}
