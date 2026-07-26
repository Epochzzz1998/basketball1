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

    /** One team's roster averages inside a single playoff round (B-R series data). */
    List<PlayerStatsDto> findPlayersPlayoffRoundStats(@Param("param") PlayerStatsDto param);

    /** Rounds a team actually played that season: {round, oppTeam, games}. */
    List<Map<String, Object>> findTeamPlayoffRounds(@Param("seasonNum") Integer seasonNum,
                                                    @Param("teamCode") String teamCode);

    /** One player's box score per game for a season (seasonType 2 regular / 3 playoffs). */
    List<Map<String, Object>> findPlayerGameLog(@Param("playerId") String playerId,
                                                @Param("seasonNum") Integer seasonNum,
                                                @Param("seasonType") Integer seasonType);

    /** Seasons where this player has game-log rows: {seasonNum, seasonType, games}. */
    List<Map<String, Object>> findPlayerGameLogSeasons(@Param("playerId") String playerId);
}
