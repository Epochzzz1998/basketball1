package com.dream.basketball.dto;

import com.dream.basketball.entity.PlayerStats;
import lombok.Data;

@Data
public class PlayerStatsDto extends PlayerStats {
    private String playerName;
    private String playerNumber;
    private String field;
    private String order;

    /** 季后赛数据行附带的当季球队季后赛成绩（读时联 team_season，常规赛查询为 null）。 */
    private String playoffResult;
}
