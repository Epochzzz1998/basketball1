package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

public interface PlayerMapper extends BaseMapper<DreamPlayer> {

    public List<DreamPlayerDto> findAllPlayers(@Param("param") DreamPlayerDto param);

    public List<PlayerStatsDto> findPlayersSeasonStats(@Param("param") PlayerStatsDto param);

    public List<PlayerStatsDto> findPlayerStats(@Param("param") PlayerStatsDto param);

    /** Seasons where this player led the league in a stat: rows of {award, season}. */
    List<Map<String, Object>> findPlayerCrowns(@Param("playerId") String playerId);

    /** Championships: seasons where the player's team won it all, rows of {season, team}. */
    List<Map<String, Object>> findPlayerChampionships(@Param("playerId") String playerId);

    /** This player's special awards (FMVP / 6MOY / MIP): rows of {award, season}. */
    List<Map<String, Object>> findPlayerSeasonAwards(@Param("playerId") String playerId);

    /** One season's special-award winners with name + key stats. */
    List<Map<String, Object>> findSeasonAwards(@Param("seasonNum") Integer seasonNum);

    /** One player's playoff seasons (incl. career summary row) with the team's playoff finish. */
    List<PlayerStatsDto> findPlayerPlayoffStats(@Param("playerId") String playerId);

    /** All players' playoff stats for a season (mirrors findPlayersSeasonStats). */
    List<PlayerStatsDto> findPlayersPlayoffSeasonStats(@Param("param") PlayerStatsDto param);
}
