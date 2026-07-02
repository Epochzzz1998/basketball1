package com.dream.basketball.controller;

import com.dream.basketball.common.Result;
import com.dream.basketball.dto.TeamSeasonDto;
import com.dream.basketball.mapper.TeamMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 球队榜单 JSON 接口（公开读）。战绩/季后赛来自 team_season，
 * 场均数据由该队球员当季数据聚合而来；东西部/分区在前端按队码归类。
 */
@RestController
@RequestMapping("/team")
public class TeamController {

    @Autowired
    private TeamMapper teamMapper;

    @GetMapping("/rankings")
    public Result<List<TeamSeasonDto>> rankings(Integer seasonNum) {
        return new Result<>(0, "成功", teamMapper.findTeamRankings(seasonNum == null ? 1 : seasonNum));
    }

    /** 某队队史（逐季战绩/季后赛/全队场均） */
    @GetMapping("/history")
    public Result<List<TeamSeasonDto>> history(String teamCode) {
        return new Result<>(0, "成功", teamMapper.findTeamHistory(teamCode));
    }

    /** 某赛季季后赛球队榜（季后赛全队场均，供季后赛内排名） */
    @GetMapping("/playoffRankings")
    public Result<List<TeamSeasonDto>> playoffRankings(Integer seasonNum) {
        return new Result<>(0, "成功", teamMapper.findTeamPlayoffRankings(seasonNum == null ? 1 : seasonNum));
    }

    /** 某队季后赛队史（只含进季后赛的赛季） */
    @GetMapping("/playoffHistory")
    public Result<List<TeamSeasonDto>> playoffHistory(String teamCode) {
        return new Result<>(0, "成功", teamMapper.findTeamPlayoffHistory(teamCode));
    }
}
