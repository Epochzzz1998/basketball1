package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
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

import java.util.List;

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
}
