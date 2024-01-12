package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface PlayerMapper extends BaseMapper<DreamPlayer> {

    public List<DreamPlayerDto> findAllPlayers(@Param("param") DreamPlayerDto param);

    public List<PlayerStatsDto> findPlayersSeasonStats(@Param("param") PlayerStatsDto param);

    public List<PlayerStatsDto> findPlayerStats(@Param("param") PlayerStatsDto param);
}
