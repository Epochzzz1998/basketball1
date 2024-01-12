package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.PlayerStats;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface PlayerStatsMapper extends BaseMapper<PlayerStats> {

}
