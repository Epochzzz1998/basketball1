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
import com.dream.basketball.utils.SortUtil;
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
    public List<PlayerStatsDto> findPlayersPlayoffRoundStats(PlayerStatsDto param) {
        return baseMapper.findPlayersPlayoffRoundStats(param);
    }

    @Override
    public List<Map<String, Object>> findTeamPlayoffRounds(Integer seasonNum, String teamCode) {
        return baseMapper.findTeamPlayoffRounds(seasonNum, teamCode);
    }

    @Override
    public List<Map<String, Object>> findPlayerGameLog(String playerId, Integer seasonNum, Integer seasonType) {
        return baseMapper.findPlayerGameLog(playerId, seasonNum, seasonType);
    }

    @Override
    public List<Map<String, Object>> findPlayerGameLogSeasons(String playerId) {
        return baseMapper.findPlayerGameLogSeasons(playerId);
    }

    @Override
    public Map<String, Object> findCareerTotals(String playerId) {
        List<Map<String, Object>> rows = baseMapper.findCareerTotals(playerId);
        // 名字对不上全历史表的球员（译名差异、边缘球员）没有这一行，返回 null 让前端整块不显示
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Override
    public List<Map<String, Object>> findAllTimeBoard(String field, Integer limit) {
        String expr = SortUtil.safeTotalsExpr(field);
        // 白名单外的项直接返回空，不要拿用户输入去拼 SQL
        return expr == null ? java.util.Collections.emptyList() : baseMapper.findAllTimeBoard(expr, limit);
    }

    /** 命中率类统计王的命中数门槛（82 场赛季的官方值，查询里按当季场次比例缩放） */
    private static final java.util.Map<String, String[]> PCT_CROWN_GATE = new java.util.HashMap<String, String[]>() {{
        put("playerAccuracy", new String[]{"PLAYER_AVG_FGM", "300"});
        put("playerThreeAccuracy", new String[]{"PLAYER_AVG_TPM", "82"});
        put("playerFreethrowAccuracy", new String[]{"PLAYER_AVG_FTM", "125"});
    }};

    /** 评选类奖项：MVP/DPOY 记在 player_stats 的名次列上，其余四项在 season_award 表 */
    private static final java.util.Set<String> VOTED_AWARDS =
            new java.util.HashSet<>(java.util.Arrays.asList("mvp", "dpoy", "fmvp", "roy", "smoy", "mip"));

    @Override
    public List<Map<String, Object>> findAwardHistory(String award) {
        if (VOTED_AWARDS.contains(award)) {
            return baseMapper.findVotedAwardHistory(award);
        }
        String expr = SortUtil.safeCrownExpr(award);
        // 既不是评选类、也不在统计王白名单里 -> 空列表，不拿用户输入拼 SQL
        if (expr == null) {
            return java.util.Collections.emptyList();
        }
        // 命中率类的门槛是命中数，不是场次：不设的话 3 投 3 中的人就是命中率王
        String[] made = PCT_CROWN_GATE.get(award);
        return made == null
                ? baseMapper.findCrownHistory(expr, null, null)
                : baseMapper.findCrownHistory(expr, made[0], Integer.valueOf(made[1]));
    }

    @Override
    public Map<String, Object> findCareerTotalsByBrId(String brId) {
        List<Map<String, Object>> rows = baseMapper.findCareerTotalsByBrId(brId);
        return rows.isEmpty() ? null : rows.get(0);
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
