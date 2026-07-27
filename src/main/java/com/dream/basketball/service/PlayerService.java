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

    /** One team's roster averages inside a single playoff round. */
    List<PlayerStatsDto> findPlayersPlayoffRoundStats(PlayerStatsDto param);

    /** Rounds a team actually played that season: {round, oppTeam, games}. */
    List<Map<String, Object>> findTeamPlayoffRounds(Integer seasonNum, String teamCode);

    /** One player's box score per game for a season (seasonType 2 regular / 3 playoffs). */
    List<Map<String, Object>> findPlayerGameLog(String playerId, Integer seasonNum, Integer seasonType);

    /** Seasons where this player has game-log rows. */
    List<Map<String, Object>> findPlayerGameLogSeasons(String playerId);

    /** 生涯总数 + 历史排名；该球员没匹配到全历史表时返回 null。 */
    Map<String, Object> findCareerTotals(String playerId);

    /** 单项生涯总数历史总榜；field 不在白名单内返回空列表。 */
    List<Map<String, Object>> findAllTimeBoard(String field, Integer limit);

    /** 按 B-R id 取生涯总数（最小档案）。 */
    Map<String, Object> findCareerTotalsByBrId(String brId);

    /** 历史荣誉逐季获奖者；award 既可以是评选类的键，也可以是统计王的驼峰列名。 */
    List<Map<String, Object>> findAwardHistory(String award);

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
