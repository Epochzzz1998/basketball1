package com.dream.basketball.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * One team's season line: record + playoff finish (team_season) joined with the
 * per-game box-score totals of its roster (aggregated from player_stats at read time).
 */
@Data
public class TeamSeasonDto {

    private Integer seasonNum;

    private String teamCode;

    private Integer wins;

    private Integer losses;

    private String playoffResult;

    /** Simulated per-game points allowed (kept consistent with the record). */
    private BigDecimal ptsAllowed;

    /** Playoff games played that season (max roster GP; playoff queries only). */
    private Integer games;

    /** Roster per-game totals for the season. */
    private BigDecimal pts;

    private BigDecimal reb;

    private BigDecimal ast;

    private BigDecimal stl;

    private BigDecimal blk;

    private BigDecimal tov;
}
