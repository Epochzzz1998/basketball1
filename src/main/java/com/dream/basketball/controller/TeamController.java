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
}
