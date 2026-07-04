package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.entity.NewsViewer;
import org.apache.ibatis.annotations.Param;

import java.util.Date;

public interface NewsViewerMapper extends BaseMapper<NewsViewer> {
    /** INSERT IGNORE：新访客插入返回 1，已存在（重复浏览）返回 0。 */
    int insertIgnore(@Param("newsId") String newsId,
                     @Param("viewerId") String viewerId,
                     @Param("viewTime") Date viewTime);
}
