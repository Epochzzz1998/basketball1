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

import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    // ===== 每日赛场 =====

    /** 一场比赛里要合计的列。上场时间也合计——和 box score 的 Team Totals 行口径一致。 */
    private static final String[] SUM_COLS = {"playingTime", "pts", "reb", "offReb", "defReb",
            "ast", "stl", "blk", "tov", "pf", "fgm", "fga", "tpm", "tpa", "ftm", "fta"};

    @Override
    public List<Map<String, Object>> findGamesByDate(String gameDate) {
        return StringUtils.isBlank(gameDate) ? new ArrayList<>() : baseMapper.findGamesByDate(gameDate);
    }

    @Override
    public String findLatestGameDate() {
        return baseMapper.findLatestGameDate();
    }

    @Override
    public Map<String, Object> findAdjacentGameDates(String gameDate) {
        Map<String, Object> out = new LinkedHashMap<>();
        // 两头都给出来，前端据此决定箭头灰不灰；到头的一端是 null
        out.put("prev", StringUtils.isBlank(gameDate) ? null : baseMapper.findPrevGameDate(gameDate));
        out.put("next", StringUtils.isBlank(gameDate) ? null : baseMapper.findNextGameDate(gameDate));
        return out;
    }

    @Override
    public List<String> findGameDates(String begin, String end) {
        return StringUtils.isAnyBlank(begin, end) ? new ArrayList<>() : baseMapper.findGameDates(begin, end);
    }

    @Override
    public Map<String, Object> findGameDetail(String gameId) {
        if (StringUtils.isBlank(gameId)) {
            return null;
        }
        List<Map<String, Object>> meta = baseMapper.findGameMeta(gameId);
        if (meta.isEmpty()) {
            return null;
        }
        Map<String, Object> game = meta.get(0);

        // 每节得分：一节一行取回来，按队装成数组。分节数不固定，加时就是第 5 节起
        Map<String, List<Map<String, Object>>> periods = new LinkedHashMap<>();
        for (Map<String, Object> row : baseMapper.findGamePeriods(gameId)) {
            periods.computeIfAbsent(String.valueOf(row.get("team")), k -> new ArrayList<>()).add(row);
        }

        // 球员按队分组，并顺手算出每队合计（就是 box score 里的 Team Totals 行）
        Map<String, List<Map<String, Object>>> players = new LinkedHashMap<>();
        Map<String, Map<String, Object>> totals = new LinkedHashMap<>();
        for (Map<String, Object> row : baseMapper.findGameBoxScore(gameId)) {
            String team = String.valueOf(row.get("playerTeam"));
            players.computeIfAbsent(team, k -> new ArrayList<>()).add(row);
            Map<String, Object> sum = totals.computeIfAbsent(team, k -> new LinkedHashMap<>());
            for (String col : SUM_COLS) {
                Object v = row.get(col);
                if (v instanceof Number) {
                    sum.merge(col, ((Number) v).longValue(),
                            (a, b) -> ((Number) a).longValue() + ((Number) b).longValue());
                }
            }
        }

        Map<String, Object> out = new LinkedHashMap<>(game);
        out.put("periods", periods);
        out.put("players", players);
        out.put("totals", totals);
        return out;
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
