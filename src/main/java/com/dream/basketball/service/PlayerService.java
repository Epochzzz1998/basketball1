package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;
import java.util.Map;

public interface PlayerService extends IService<DreamPlayer> {

    /** Seasons where this player led the league in a stat: rows of {award, season}. */
    List<Map<String, Object>> findPlayerCrowns(String playerId);

    /** Championships: seasons where the player's team won it all, rows of {season, team}. */
    List<Map<String, Object>> findPlayerChampionships(String playerId);

    /** This player's special awards (FMVP / 6MOY / MIP): rows of {award, season}. */
    List<Map<String, Object>> findPlayerSeasonAwards(String playerId);

    /** One season's special-award winners with name + key stats. */
    List<Map<String, Object>> findSeasonAwards(Integer seasonNum);

    /** One player's playoff seasons (incl. career summary row) with the team's playoff finish. */
    List<PlayerStatsDto> findPlayerPlayoffStats(String playerId);

    /** All players' playoff stats for a season (mirrors findPlayersSeasonStats). */
    List<PlayerStatsDto> findPlayersPlayoffSeasonStats(PlayerStatsDto param);

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
