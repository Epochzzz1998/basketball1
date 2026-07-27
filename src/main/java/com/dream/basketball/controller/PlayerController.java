package com.dream.basketball.controller;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
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
import com.dream.basketball.utils.FileUtils;
import com.dream.basketball.utils.SortUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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

    @Value("${picPath.uploadPath:}")
    private String uploadPath;

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
        // 只发调用方真要渲染的列：排行卡读 6 列却拿走全部 64 列时，整季 2000 行是 2.89MB
        param.setFields(SortUtil.safeStatsProjection(param.getFields()));
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
                .eq("PLAYER_ID", playerId).lt("SEASON_NUM", com.dream.basketball.utils.Constants.CAREER_SUMMARY_SEASON).orderByAsc("SEASON_NUM"));
        Map<String, Object> data = new HashMap<>();
        data.put("playerName", player == null ? "" : player.getPlayerName());
        data.put("nameEn", player == null ? "" : player.getNameEn());
        data.put("playerNumber", player == null ? "" : player.getPlayerNumber());
        data.put("photo", player == null ? "" : player.getPhoto());
        List<Integer> mvp = new ArrayList<>();
        List<Integer> dpoy = new ArrayList<>();
        List<Integer> all1 = new ArrayList<>();
        List<Integer> all2 = new ArrayList<>();
        List<Integer> all3 = new ArrayList<>();
        List<Integer> def1 = new ArrayList<>();
        List<Integer> def2 = new ArrayList<>();
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
            // All-Defensive only has 1st/2nd teams in reality — no 3rd
            if ("一阵".equals(r.getAllDefTeam())) {
                def1.add(r.getSeasonNum());
            } else if ("二阵".equals(r.getAllDefTeam())) {
                def2.add(r.getSeasonNum());
            }
        }
        data.put("mvp", mvp);
        data.put("dpoy", dpoy);
        data.put("all1", all1);
        data.put("all2", all2);
        data.put("all3", all3);
        data.put("def1", def1);
        data.put("def2", def2);
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
        param.setFields(SortUtil.safeStatsProjection(param.getFields()));
        if (param.getSeasonNum() == null) {
            param.setSeasonNum(1);
        }
        List<PlayerStatsDto> rows = playerService.findPlayersPlayoffSeasonStats(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    /** 某队某赛季单轮次的阵容数据（公开）。round 缺省为首轮。 */
    @GetMapping("/playoffRoundStats")
    public Object playoffRoundStats(PlayerStatsDto param) {
        param.setField(SortUtil.safeRoundStatsOrderBy(param.getField(), param.getOrder()));
        if (param.getSeasonNum() == null) {
            param.setSeasonNum(1);
        }
        if (param.getRound() == null) {
            param.setRound(1);
        }
        return new Result<>(0, "成功", playerService.findPlayersPlayoffRoundStats(param));
    }

    /** 某队某赛季打过哪几轮（公开），前端据此渲染轮次选项。 */
    @GetMapping("/teamPlayoffRounds")
    public Object teamPlayoffRounds(Integer seasonNum, String teamCode) {
        return new Result<>(0, "成功",
                playerService.findTeamPlayoffRounds(seasonNum, StringUtils.trimToEmpty(teamCode)));
    }

    /** 单个球员某赛季的逐场数据（公开）。seasonType：2 常规赛 / 3 季后赛，缺省季后赛。 */
    @GetMapping("/playerGameLog")
    public Object playerGameLog(String playerId, Integer seasonNum, Integer seasonType) {
        return new Result<>(0, "成功", playerService.findPlayerGameLog(
                StringUtils.trimToEmpty(playerId), seasonNum, seasonType == null ? 3 : seasonType));
    }

    /** 生涯总数 + 历史排名（公开）。排名池是 1947 年至今的全联盟，不是本库的 50 季。 */
    @GetMapping("/careerTotals")
    public Object careerTotals(String playerId) {
        return new Result<>(0, "成功", playerService.findCareerTotals(StringUtils.trimToEmpty(playerId)));
    }

    /** 某项生涯总数的历史总榜（公开）：1947 年至今全联盟，含本库没有的老球员。 */
    @GetMapping("/allTimeBoard")
    public Object allTimeBoard(String field, Integer limit) {
        return new Result<>(0, "成功", playerService.findAllTimeBoard(StringUtils.trimToEmpty(field), limit));
    }

    /** 历史球员最小档案（公开）：本库没有资料卡的人，按 B-R id 只给生涯总数。 */
    @GetMapping("/historyPlayer")
    public Object historyPlayer(String brId) {
        return new Result<>(0, "成功", playerService.findCareerTotalsByBrId(StringUtils.trimToEmpty(brId)));
    }

    /** 该球员有逐场数据的赛季（公开），空数组表示这一块还没回补到他。 */
    @GetMapping("/playerGameLogSeasons")
    public Object playerGameLogSeasons(String playerId) {
        return new Result<>(0, "成功",
                playerService.findPlayerGameLogSeasons(StringUtils.trimToEmpty(playerId)));
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

    /**
     * 球员照片上传：图片白名单 / 限 5MB（FileUtils），每人一个目录 player-{id}，
     * 先清旧再存新，URL 落库 dream_player.PHOTO 并回传给前端即时预览。
     */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/uploadPhoto")
    public Object uploadPhoto(MultipartFile file, String playerId) throws IOException {
        DreamPlayer player = playerService.getById(StringUtils.trimToEmpty(playerId));
        if (player == null) {
            return new Result<>(1, "球员不存在", null);
        }
        String folderKey = "player-" + player.getPlayerId();
        FileUtils.deleteUploadFolder(uploadPath, folderKey); // one photo per player — drop the old one
        String url = FileUtils.upload(file, uploadPath, folderKey);
        playerService.update(new UpdateWrapper<DreamPlayer>().eq("PLAYER_ID", player.getPlayerId()).set("PHOTO", url));
        Map<String, Object> data = new HashMap<>();
        data.put("url", url);
        return new Result<>(0, "照片已更新", data);
    }

    /** 移除球员照片（清空 PHOTO 并删除该球员的上传目录） */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/deletePhoto")
    public Object deletePhoto(String playerId) {
        DreamPlayer player = playerService.getById(StringUtils.trimToEmpty(playerId));
        if (player == null) {
            return new Result<>(1, "球员不存在", null);
        }
        FileUtils.deleteUploadFolder(uploadPath, "player-" + player.getPlayerId());
        playerService.update(new UpdateWrapper<DreamPlayer>().eq("PLAYER_ID", player.getPlayerId()).set("PHOTO", null));
        return new Result<>(0, "照片已移除", null);
    }
}
