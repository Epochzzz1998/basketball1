package com.dream.basketball.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.service.PlayerService;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@Service
public class PlayerServiceImpl extends ServiceImpl<PlayerMapper, DreamPlayer> implements PlayerService {

    public List<DreamPlayerDto> findAllPlayers(@RequestBody(required = false) DreamPlayerDto param){
        return baseMapper.findAllPlayers(param);
    }

    public List<PlayerStatsDto> findPlayersSeasonStats(@RequestBody(required = false) PlayerStatsDto param){
        return baseMapper.findPlayersSeasonStats(param);
    }

    public List<PlayerStatsDto> findPlayerStats(@RequestBody(required = false) PlayerStatsDto param){
        return baseMapper.findPlayerStats(param);
    }
}
