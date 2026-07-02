package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.PlayerStats;
import com.dream.basketball.service.PlayerService;
import com.dream.basketball.service.PlayerStatsService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.SortUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * 球员相关 JSON 接口（P4-1 REST 化）。读接口公开，写接口需 superManager（P2-5）。
 * 异常交由 GlobalExceptionHandler 统一处理（P4-2），不再逐方法 try/catch。
 */
@RestController
@RequestMapping("/player")
public class PlayerController extends BaseUtils {

    @Autowired
    private PlayerService playerService;
    @Autowired
    private PlayerStatsService playerStatsService;

    /** 球员列表数据（按赛季） */
    @GetMapping("/getPlayerData")
    public Object getData(DreamPlayerDto param, int page, int limit) {
        PageHelper.startPage(page, limit);
        if (param.getSeasonNum() == null) {
            param.setSeasonNum(1);
        }
        List<DreamPlayerDto> rows = playerService.findAllPlayers(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    /** 单个球员生涯逐季数据 */
    @GetMapping("/getPlayerSeasonStatsList")
    public Object getPlayerSeasonStatsList(PlayerStatsDto param, int page, int limit) {
        PageHelper.startPage(page, limit);
        // 排序：白名单校验后再拼接，既真正生效又防注入（P3-1）
        param.setField(SortUtil.safeStatsOrderBy(param.getField(), param.getOrder()));
        List<PlayerStatsDto> rows = playerService.findPlayerStats(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    /** 全体球员某赛季数据榜 */
    @GetMapping("/getAllPlayersSeasonStatsList")
    public Object getAllPlayersSeasonStatsList(PlayerStatsDto param, int page, int limit) {
        PageHelper.startPage(page, limit);
        param.setField(SortUtil.safeStatsOrderBy(param.getField(), param.getOrder()));
        if (param.getSeasonNum() == null) {
            param.setSeasonNum(1);
        }
        List<PlayerStatsDto> rows = playerService.findPlayersSeasonStats(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    /**
     * 联盟现有球队代码（公开）。取自 player_stats 的 PLAYER_TEAM 去重：
     * 排除占位符 "/"（生涯汇总行），转会写法 "A->B" 拆成两队，排序返回。
     */
    @GetMapping("/teams")
    public Object teams() {
        List<Object> raw = playerStatsService.listObjs(
                new QueryWrapper<PlayerStats>().select("distinct PLAYER_TEAM").isNotNull("PLAYER_TEAM"));
        Set<String> teams = new TreeSet<>();
        for (Object o : raw) {
            for (String part : String.valueOf(o).split("->")) {
                String t = part.trim();
                if (!t.isEmpty() && !"/".equals(t) && !"null".equals(t)) {
                    teams.add(t);
                }
            }
        }
        return new Result<>(0, "成功", teams);
    }

    /**
     * 球员生涯荣誉（公开）。MVP/DPOY/最佳阵容/防守阵容取自本人各季名次与评选；
     * 得分/篮板/助攻/抢断/盖帽王与总冠军由联盟数据推导（见 PlayerMapper 两个查询）。
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/honors")
    public Object honors(String playerId) {
        DreamPlayer player = playerService.getById(playerId);
        List<PlayerStats> rows = playerStatsService.list(new QueryWrapper<PlayerStats>()
                .eq("PLAYER_ID", playerId).lt("SEASON_NUM", 50).orderByAsc("SEASON_NUM"));
        Map<String, Object> data = new HashMap<>();
        data.put("playerName", player == null ? "" : player.getPlayerName());
        data.put("playerNumber", player == null ? "" : player.getPlayerNumber());
        List<Integer> mvp = new ArrayList<>();
        List<Integer> dpoy = new ArrayList<>();
        List<Integer> all1 = new ArrayList<>();
        List<Integer> all2 = new ArrayList<>();
        List<Integer> all3 = new ArrayList<>();
        List<Integer> def1 = new ArrayList<>();
        List<Integer> def2 = new ArrayList<>();
        List<Integer> def3 = new ArrayList<>();
        for (PlayerStats r : rows) {
            if (Integer.valueOf(1).equals(r.getMvpRank())) {
                mvp.add(r.getSeasonNum());
            }
            if (Integer.valueOf(1).equals(r.getDpoyRank())) {
                dpoy.add(r.getSeasonNum());
            }
            if ("一阵".equals(r.getAllDbaTeam())) {
                all1.add(r.getSeasonNum());
            } else if ("二阵".equals(r.getAllDbaTeam())) {
                all2.add(r.getSeasonNum());
            } else if ("三阵".equals(r.getAllDbaTeam())) {
                all3.add(r.getSeasonNum());
            }
            if ("一阵".equals(r.getAllDefTeam())) {
                def1.add(r.getSeasonNum());
            } else if ("二阵".equals(r.getAllDefTeam())) {
                def2.add(r.getSeasonNum());
            } else if ("三阵".equals(r.getAllDefTeam())) {
                def3.add(r.getSeasonNum());
            }
        }
        data.put("mvp", mvp);
        data.put("dpoy", dpoy);
        data.put("all1", all1);
        data.put("all2", all2);
        data.put("all3", all3);
        data.put("def1", def1);
        data.put("def2", def2);
        data.put("def3", def3);
        for (Map<String, Object> crown : playerService.findPlayerCrowns(playerId)) {
            ((List<Object>) data.computeIfAbsent(String.valueOf(crown.get("award")), k -> new ArrayList<>()))
                    .add(crown.get("season"));
        }
        // 特别奖（fmvp / smoy / mip），与单项王同构合并
        for (Map<String, Object> award : playerService.findPlayerSeasonAwards(playerId)) {
            ((List<Object>) data.computeIfAbsent(String.valueOf(award.get("award")), k -> new ArrayList<>()))
                    .add(award.get("season"));
        }
        data.put("champion", playerService.findPlayerChampionships(playerId));
        return new Result<>(0, "成功", data);
    }

    /** 某赛季的特别奖得主（FMVP/最佳第六人/最快进步球员，公开） */
    @GetMapping("/seasonAwards")
    public Object seasonAwards(Integer seasonNum) {
        return new Result<>(0, "成功", playerService.findSeasonAwards(seasonNum == null ? 1 : seasonNum));
    }

    /** 单个球员季后赛逐季数据（含生涯汇总行，公开） */
    @GetMapping("/getPlayerPlayoffStatsList")
    public Object getPlayerPlayoffStatsList(String playerId) {
        return new Result<>(0, "成功", playerService.findPlayerPlayoffStats(playerId));
    }

    /** 全体球员某赛季季后赛数据榜（公开，排序走 P3-1 白名单） */
    @GetMapping("/getAllPlayersPlayoffSeasonStatsList")
    public Object getAllPlayersPlayoffSeasonStatsList(PlayerStatsDto param, int page, int limit) {
        PageHelper.startPage(page, limit);
        param.setField(SortUtil.safeStatsOrderBy(param.getField(), param.getOrder()));
        if (param.getSeasonNum() == null) {
            param.setSeasonNum(1);
        }
        List<PlayerStatsDto> rows = playerService.findPlayersPlayoffSeasonStats(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    // ===== 写接口：superManager 专属（P2-5），多步写已下沉为 @Transactional 服务方法（P3-2） =====

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/insertAndSavePlayer")
    public Object insertAndSavePlayer(String data) {
        playerService.insertPlayersWithBlankRow(JSON.parseArray(data, DreamPlayer.class));
        return handlerResultJson(true, "操作成功！");
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/savePlayer")
    public Object savePlayer(String data) {
        playerService.savePlayers(JSON.parseArray(data, DreamPlayer.class));
        return handlerResultJson(true, "操作成功！");
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/insertAndSavePlayerStats")
    public Object insertAndSavePlayerStats(String data, String playerId) {
        playerStatsService.insertStatsWithBlankRow(JSON.parseArray(data, PlayerStats.class), playerId);
        return handlerResultJson(true, "操作成功！");
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/savePlayerStats")
    public Object savePlayerStats(String data, String playerId) {
        playerStatsService.saveStatsAndRecomputeSummary(JSON.parseArray(data, PlayerStats.class), playerId);
        return handlerResultJson(true, "操作成功！");
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/deletePlayer")
    public Object deletePlayer(String playerId) {
        playerService.deletePlayerCascade(playerId);
        return handlerResultJson(true, "删除成功！");
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/deletePlayerStats")
    public Object deletePlayerStats(String statsId, String playerId) {
        playerStatsService.deleteStatsAndRecomputeSummary(statsId, playerId);
        return handlerResultJson(true, "删除成功！");
    }
}
