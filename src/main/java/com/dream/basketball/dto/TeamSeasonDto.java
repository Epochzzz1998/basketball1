package com.dream.basketball.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * One team's season line: record + playoff finish (team_season) joined with the
 * per-game box-score totals of its roster (aggregated from player_stats at read time).
 */
@Data
public class TeamSeasonDto {

    private String teamCode;

    private Integer wins;

    private Integer losses;

    private String playoffResult;

    /** Roster per-game totals for the season. */
    private BigDecimal pts;

    private BigDecimal reb;

    private BigDecimal ast;

    private BigDecimal stl;

    private BigDecimal blk;

    private BigDecimal tov;
}
