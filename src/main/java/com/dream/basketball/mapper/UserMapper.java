package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.DreamUser;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface UserMapper extends BaseMapper<DreamUser> {

    public List<DreamUserDto> findAllUsers(@Param("param") DreamUserDto param);

}
