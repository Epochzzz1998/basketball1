package com.dream.basketball.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.PlayerStats;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.mapper.PlayerStatsMapper;
import com.dream.basketball.service.PlayerService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PlayerServiceImpl extends ServiceImpl<PlayerMapper, DreamPlayer> implements PlayerService {

    // P3-2: delete player_stats via its mapper directly (not PlayerStatsService) to avoid a
    // circular service dependency, which Spring Boot 2.7 rejects by default.
    @Autowired
    private PlayerStatsMapper playerStatsMapper;

    public List<DreamPlayerDto> findAllPlayers(@RequestBody(required = false) DreamPlayerDto param){
        return baseMapper.findAllPlayers(param);
    }

    public List<PlayerStatsDto> findPlayersSeasonStats(@RequestBody(required = false) PlayerStatsDto param){
        return baseMapper.findPlayersSeasonStats(param);
    }

    public List<PlayerStatsDto> findPlayerStats(@RequestBody(required = false) PlayerStatsDto param){
        return baseMapper.findPlayerStats(param);
    }

    @Override
    public List<Map<String, Object>> findPlayerCrowns(String playerId) {
        return baseMapper.findPlayerCrowns(playerId);
    }

    @Override
    public List<Map<String, Object>> findPlayerChampionships(String playerId) {
        return baseMapper.findPlayerChampionships(playerId);
    }

    @Override
    public List<Map<String, Object>> findPlayerSeasonAwards(String playerId) {
        return baseMapper.findPlayerSeasonAwards(playerId);
    }

    @Override
    public List<Map<String, Object>> findSeasonAwards(Integer seasonNum) {
        return baseMapper.findSeasonAwards(seasonNum);
    }

    @Override
    public List<PlayerStatsDto> findPlayerPlayoffStats(String playerId) {
        return baseMapper.findPlayerPlayoffStats(playerId);
    }

    @Override
    public List<PlayerStatsDto> findPlayersPlayoffSeasonStats(PlayerStatsDto param) {
        return baseMapper.findPlayersPlayoffSeasonStats(param);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void savePlayers(List<DreamPlayer> players) {
        if (players == null) {
            return;
        }
        for (DreamPlayer player : players) {
            // New rows from the UI arrive with a blank id; assign one here because the entity is
            // IdType.INPUT (MyBatis-Plus will not generate it). Existing rows keep their id and update.
            if (StringUtils.isBlank(player.getPlayerId())) {
                player.setPlayerId(UUID.randomUUID().toString());
            }
            this.saveOrUpdate(player);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void insertPlayersWithBlankRow(List<DreamPlayer> players) {
        if (players != null) {
            for (DreamPlayer player : players) {
                this.saveOrUpdate(player);
            }
        }
        DreamPlayer blank = new DreamPlayer();
        blank.setPlayerId(UUID.randomUUID().toString());
        this.save(blank);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deletePlayerCascade(String playerId) {
        DreamPlayer player = this.getById(playerId);
        if (player != null) {
            playerStatsMapper.delete(new QueryWrapper<PlayerStats>().eq("PLAYER_ID", playerId));
        }
        this.removeById(playerId);
    }
}
