package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamNews;
import com.dream.basketball.entity.DreamPlayer;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface DreamNewsMapper extends BaseMapper<DreamNews> {

}
