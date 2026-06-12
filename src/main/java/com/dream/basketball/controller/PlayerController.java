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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.List;

/**
 * @Author Epoch
 * @Description 球员controller
 * @Date 2023/2/1 10:02
 **/
@Controller
@RequestMapping("/player")
public class PlayerController extends BaseUtils {
    private Logger logger = LoggerFactory.getLogger(getClass());
    @Autowired
    private PlayerService playerService;
    @Autowired
    private PlayerStatsService playerStatsService;

    /**
     * @Author Epoch
     * @Description 首页
     * @Date 2023/2/1 10:02
     * @Param [model]
     * @return java.lang.String
     **/
    @RequestMapping("/playerList")
    public String toPlayerListPage(Model model, HttpServletRequest request){
        menuPower(model, request);
        return "player/all-player-season-stats";
    }

    /**
     * @Author Epoch
     * @Description 返回球员数据统计列表页
     * @Date 2023/2/1 15:15
     * @Param [model]
     * @return java.lang.String
     **/
    @RequestMapping("/playerStatsList")
    public String playerStatsList(Model model, String playerId, HttpServletRequest request, HttpSession session){
        model.addAttribute("playerId", playerId);
        // 获取当前球员姓名
        DreamPlayer dreamPlayer = playerService.getById(playerId);
        model.addAttribute("playerName", dreamPlayer == null? "" : dreamPlayer.getPlayerName());
        menuPower(model, request);
        return "player/player-stats-list";
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @RequestMapping("/playerStatsManagerList")
    public String playerStatsManagerList(Model model, String playerId, HttpServletRequest request, HttpSession session){
        if(isLogin(model, request)){
            if(isSuperManager(model, request)){
                model.addAttribute("playerId", playerId);
                // 获取当前球员姓名
                DreamPlayer dreamPlayer = playerService.getById(playerId);
                model.addAttribute("playerName", dreamPlayer.getPlayerName());
                menuPower(model, request);
                return "player/player-stats-manager-list";
            }
            else {
                return "error";
            }
        }
        else {
            return "login";
        }
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @RequestMapping("/playerManage")
    public String playerManage(Model model, HttpServletRequest request){
        if(isLogin(model, request)){
            if(isSuperManager(model, request)){
                return "player/player-list";
            }
            else {
                return "error";
            }
        }
        else {
            return "login";
        }
    }

    /**
     * @Author Epoch
     * @Description 获取球员列表数据
     * @Date 2023/2/1 10:01
     * @Param [param, page, limit, response]
     * @return java.lang.Object
     **/
    @RequestMapping("/getPlayerData")
    @ResponseBody
    public Object getData(DreamPlayerDto param, int page, int limit, HttpServletResponse response) throws Exception{
        int code = -1;
        List<DreamPlayerDto> rows = new ArrayList<DreamPlayerDto>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            // 设置初始加载赛季
            if(param.getSeasonNum() == null){
                param.setSeasonNum(1);
            }
            rows = playerService.findAllPlayers(param);
            PageInfo<DreamPlayerDto> dreamPlayerPageInfo = new PageInfo<>(rows);
            count = (int) dreamPlayerPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("{getPlayerData错误" + e.getMessage(), e);
        }
        return handlerSuccessPageJson(code, "测试", count, rows);
    }

    /**
     * @Author Epoch
     * @Description 获取球员生涯数据列表
     * @Date 2023/2/1 14:37
     * @Param [param, page, limit, response]
     * @return java.lang.Object
     **/
    @RequestMapping("/getPlayerSeasonStatsList")
    @ResponseBody
    public Object getPlayerSeasonStatsList(PlayerStatsDto param, int page, int limit, HttpServletResponse response) throws Exception{
        int code = -1;
        List<PlayerStatsDto> rows = new ArrayList<>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            // 设置排序：白名单校验后再拼接，既真正生效又防注入（P3-1，配合 Mapper 的 ${param.field}）
            param.setField(SortUtil.safeStatsOrderBy(param.getField(), param.getOrder()));
            rows = playerService.findPlayerStats(param);
            PageInfo<PlayerStatsDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("{getPlayerSeasonStatsList错误" + e.getMessage(), e);
        }
        return handlerSuccessPageJson(code, "测试", count, rows);
    }

    @RequestMapping("/getAllPlayersSeasonStatsList")
    @ResponseBody
    public Object getAllPlayersSeasonStatsList(PlayerStatsDto param, int page, int limit, HttpServletResponse response) throws Exception{
        int code = -1;
        List<PlayerStatsDto> rows = new ArrayList<>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            // 设置排序：白名单校验后再拼接，既真正生效又防注入（P3-1，配合 Mapper 的 ${param.field}）
            param.setField(SortUtil.safeStatsOrderBy(param.getField(), param.getOrder()));
            if(param.getSeasonNum() == null){
                param.setSeasonNum(1);
            }
            rows = playerService.findPlayersSeasonStats(param);
            PageInfo<PlayerStatsDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("{getAllPlayersSeasonStatsList错误" + e.getMessage(), e);
        }
        return handlerSuccessPageJson(code, "测试", count, rows);
    }

    // P3-2: 多步写编排已下沉到 @Transactional 的 Service 方法，Controller 只解析入参并委托

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/insertAndSavePlayer")
    @ResponseBody
    public void insertAndSavePlayer(String data){
        playerService.insertPlayersWithBlankRow(JSON.parseArray(data, DreamPlayer.class));
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/savePlayer")
    @ResponseBody
    public void savePlayer(String data){
        playerService.savePlayers(JSON.parseArray(data, DreamPlayer.class));
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/insertAndSavePlayerStats")
    @ResponseBody
    public void insertAndSavePlayerStats(String data, String playerId){
        playerStatsService.insertStatsWithBlankRow(JSON.parseArray(data, PlayerStats.class), playerId);
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/savePlayerStats")
    @ResponseBody
    public void savePlayerStats(String data, String playerId){
        playerStatsService.saveStatsAndRecomputeSummary(JSON.parseArray(data, PlayerStats.class), playerId);
    }

    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/deletePlayer")
    @ResponseBody
    public void deletePlayer(String playerId){
        playerService.deletePlayerCascade(playerId);
    }
}
