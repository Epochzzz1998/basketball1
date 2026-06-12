package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

public interface PlayerService extends IService<DreamPlayer> {

    public List<DreamPlayerDto> findAllPlayers(@RequestBody(required = false) DreamPlayerDto param);

    public List<PlayerStatsDto> findPlayersSeasonStats(@RequestBody(required = false) PlayerStatsDto param);

    public List<PlayerStatsDto> findPlayerStats(@RequestBody(required = false) PlayerStatsDto param);

    // P3-2: multi-step writes wrapped in service-layer transactions

    /** Save/Update each player row atomically. */
    void savePlayers(List<DreamPlayer> players);

    /** Save/Update each player row plus a trailing blank row, atomically. */
    void insertPlayersWithBlankRow(List<DreamPlayer> players);

    /** Delete a player and all of its player_stats rows, atomically. */
    void deletePlayerCascade(String playerId);
}
