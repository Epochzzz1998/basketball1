package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.toolkit.CollectionUtils;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.PlayerStats;
import com.dream.basketball.service.PlayerService;
import com.dream.basketball.service.PlayerStatsService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.SecUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
            logger.error("", e);
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
            // 设置排序
            if(StringUtils.isNotBlank(param.getField())){
                if(StringUtils.isNotBlank(param.getOrder())){
                    param.setField(" " + decamelize(param.getField()) + " " + param.getOrder());
                }
            }
            rows = playerService.findPlayerStats(param);
            PageInfo<PlayerStatsDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("", e);
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
            // 设置排序
            if(StringUtils.isNotBlank(param.getField())){
                if(StringUtils.isNotBlank(param.getOrder())){
                    param.setField(" " + decamelize(param.getField()) + " " + param.getOrder());
                }
            }
            if(param.getSeasonNum() == null){
                param.setSeasonNum(1);
            }
            rows = playerService.findPlayersSeasonStats(param);
            PageInfo<PlayerStatsDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("", e);
        }
        return handlerSuccessPageJson(code, "测试", count, rows);
    }

    @RequestMapping("/insertAndSavePlayer")
    @ResponseBody
    public void insertAndSavePlayer(String data){
        // 先将表格数据进行保存修改
        List<DreamPlayer> dreamPlayerList = JSON.parseArray(data, DreamPlayer.class);
        for(DreamPlayer dreamPlayer : dreamPlayerList){
            playerService.saveOrUpdate(dreamPlayer);
        }
        // 新增一行空列
        DreamPlayer dreamPlayer = new DreamPlayer();
        dreamPlayer.setPlayerId(UUID.randomUUID().toString());
        playerService.save(dreamPlayer);
    }

    @RequestMapping("/savePlayer")
    @ResponseBody
    public void savePlayer(String data){
        // 将表格数据进行保存修改
        List<DreamPlayer> dreamPlayerList = JSON.parseArray(data, DreamPlayer.class);
        for(DreamPlayer dreamPlayer : dreamPlayerList){
            playerService.saveOrUpdate(dreamPlayer);
        }
    }

    @RequestMapping("/insertAndSavePlayerStats")
    @ResponseBody
    public void insertAndSavePlayerStats(String data, String playerId){
        // 先将表格数据进行保存修改
        List<PlayerStats> playerStatsList = JSON.parseArray(data, PlayerStats.class);
        if(CollectionUtils.isEmpty(playerStatsList)){
            // 新增一行空列
            PlayerStats playerStats = new PlayerStats();
            playerStats.setStatsId(UUID.randomUUID().toString());
            playerStats.setPlayerId(playerId);
            playerStats.setSeasonNum(1);
            playerStatsService.save(playerStats);
        } else {
            boolean flag = false;
            if(StringUtils.isBlank(playerStatsList.get(0).getStatsId())){
                for(PlayerStats playerStats : playerStatsList){
                    playerStats.setStatsId(UUID.randomUUID().toString());
                    playerStats.setPlayerId(playerId);
                    playerStatsService.saveOrUpdate(playerStats);
                }
            }
            else {
                for(PlayerStats playerStats : playerStatsList){
                    if(StringUtils.isBlank(playerStats.getStatsId())){
                        playerStats.setStatsId(UUID.randomUUID().toString());
                    }
                    flag = true;
                    playerStatsService.saveOrUpdate(playerStats);
                }
                // 新增一行空列
                PlayerStats playerStats = new PlayerStats();
                playerStats.setStatsId(UUID.randomUUID().toString());
                playerStats.setPlayerId(playerId);
                playerStats.setSeasonNum(flag ? playerStatsList.size() : playerStatsList.size() + 1);
                playerStatsService.save(playerStats);
            }
        }
    }

    @RequestMapping("/savePlayerStats")
    @ResponseBody
    public void savePlayerStats(String data, String playerId){
        // 先将表格数据进行保存修改
        List<PlayerStats> playerStatsList = JSON.parseArray(data, PlayerStats.class);
        for(PlayerStats playerStats : playerStatsList){
            if(StringUtils.isBlank(playerStats.getStatsId())){
                playerStats.setStatsId(UUID.randomUUID().toString());
            }
            playerStatsService.saveOrUpdate(playerStats);
        }
        // 计算生涯场均数据
        PlayerStatsDto param = new PlayerStatsDto();
        param.setPlayerId(playerId);
        List<PlayerStatsDto> rows = playerService.findPlayerStats(param);
        int playerFrAppearance = 0;
        int playerSrAppearance = 0;
        int playerAppearance = 0;
        double playingTime = 0.0;
        double playerAvgScore = 0.0;
        double playerAvgReb = 0.0;
        double playerAvgAss = 0.0;
        double playerAccuracy = 0.0;
        double playerThreeAccuracy = 0.0;
        double playerFreethrowAccuracy = 0.0;
        double playerAvgBlock = 0.0;
        double playerAvgSteal = 0.0;
        double playerAvgTurnover = 0.0;
        double playerPer = 0.0;
        double playerPie = 0.0;
        double playerWs = 0.0;
        double playerOffEff = 0.0;
        double playerDefEff = 0.0;
        double playerNetEff = 0.0;
        double playerAvgPn = 0.0;
        Integer mvpRank = 0;
        Integer dopyRank = 0;
        int seasonNum = rows.size() - 1;
        PlayerStats playerStats = null;
        for(PlayerStatsDto playerStatsDto : rows){
            if(playerStatsDto.getSeason() != null){
                if(playerStatsDto.getSeason() == 50){
                    playerStats = playerStatsDto;
                    continue;
                }
            }
            playerFrAppearance += playerStatsDto.getPlayerFrAppearance();
            playerSrAppearance += playerStatsDto.getPlayerSrAppearance();
            playerAppearance += playerStatsDto.getPlayerAppearance();
            playingTime += (playerStatsDto.getPlayingTime().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgScore += (playerStatsDto.getPlayerAvgScore().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgReb += (playerStatsDto.getPlayerAvgReb().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgAss += (playerStatsDto.getPlayerAvgAss().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAccuracy += (playerStatsDto.getPlayerAccuracy().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerThreeAccuracy += (playerStatsDto.getPlayerThreeAccuracy().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerFreethrowAccuracy += (playerStatsDto.getPlayerFreethrowAccuracy().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgBlock += (playerStatsDto.getPlayerAvgBlock().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgSteal += (playerStatsDto.getPlayerAvgSteal().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgTurnover += (playerStatsDto.getPlayerAvgTurnover().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerPer += (playerStatsDto.getPlayerPer().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerPie += (playerStatsDto.getPlayerPie().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerWs += (playerStatsDto.getPlayerWs().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerOffEff += (playerStatsDto.getPlayerOffEff().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerDefEff += (playerStatsDto.getPlayerDefEff().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerNetEff += (playerStatsDto.getPlayerNetEff().doubleValue() * playerStatsDto.getPlayerAppearance());
            playerAvgPn += (playerStatsDto.getPlayerAvgPn().doubleValue() * playerStatsDto.getPlayerAppearance());
            mvpRank += playerStatsDto.getMvpRank() ;
            dopyRank += playerStatsDto.getDpoyRank();
        }
        if(playerStats == null){
            playerStats = new PlayerStats();
            playerStats.setStatsId(UUID.randomUUID().toString());
            playerStats.setPlayerId(playerId);
            playerStats.setSeason(50);
            playerStats.setSeasonNum(50);
            playerStats.setAllDbaTeam("/");
            playerStats.setAllDefTeam("/");
            playerStats.setPlayerPosition("/");
            playerStats.setPlayerTeam("/");
            seasonNum ++;
        }
        playerStats.setPlayerFrAppearance(playerFrAppearance);
        playerStats.setPlayerSrAppearance(playerSrAppearance);
        playerStats.setPlayerAppearance(playerAppearance);
        playerStats.setPlayingTime(BigDecimal.valueOf(playingTime/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgScore(BigDecimal.valueOf(playerAvgScore/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgReb(BigDecimal.valueOf(playerAvgReb/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgAss(BigDecimal.valueOf(playerAvgAss/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAccuracy(BigDecimal.valueOf(playerAccuracy/playerAppearance).setScale(3,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerThreeAccuracy(BigDecimal.valueOf(playerThreeAccuracy/playerAppearance).setScale(3,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerFreethrowAccuracy(BigDecimal.valueOf(playerFreethrowAccuracy/playerAppearance).setScale(3,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgBlock(BigDecimal.valueOf(playerAvgBlock/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgSteal(BigDecimal.valueOf(playerAvgSteal/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgTurnover(BigDecimal.valueOf(playerAvgTurnover/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerPer(BigDecimal.valueOf(playerPer/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerPie(BigDecimal.valueOf(playerPie/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerWs(BigDecimal.valueOf(playerWs/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerOffEff(BigDecimal.valueOf(playerOffEff/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerDefEff(BigDecimal.valueOf(playerDefEff/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerNetEff(BigDecimal.valueOf(playerNetEff/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setPlayerAvgPn(BigDecimal.valueOf(playerAvgPn/playerAppearance).setScale(1,BigDecimal.ROUND_HALF_UP));
        playerStats.setMvpRank(Integer.valueOf(mvpRank/seasonNum));
        playerStats.setDpoyRank(Integer.valueOf(dopyRank/seasonNum));
        playerStatsService.saveOrUpdate(playerStats);
    }

    @RequestMapping("/deletePlayer")
    @ResponseBody
    public void deletePlayer(String playerId){
        DreamPlayer dreamPlayer = playerService.getById(playerId);
        if(dreamPlayer != null){
            PlayerStatsDto playerStatsDto = new PlayerStatsDto();
            playerStatsDto.setPlayerId(playerId);
            List<PlayerStatsDto> playerStatsDtoList = playerService.findPlayerStats(playerStatsDto);
            for(PlayerStatsDto playerStatsDto1 : playerStatsDtoList){
                if(playerStatsDto1 != null){
                    playerStatsService.removeById(playerStatsDto1.getStatsId());
                }
            }
        }
        playerService.removeById(playerId);
    }
}
