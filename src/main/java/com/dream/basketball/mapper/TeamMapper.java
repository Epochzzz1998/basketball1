package com.dream.basketball.mapper;

import com.dream.basketball.dto.TeamSeasonDto;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TeamMapper {

    /** Team records + playoff finishes for a season, with roster per-game stat totals. */
    List<TeamSeasonDto> findTeamRankings(@Param("seasonNum") Integer seasonNum);

    /** One team's season-by-season history: record + playoff finish + roster stat totals. */
    List<TeamSeasonDto> findTeamHistory(@Param("teamCode") String teamCode);

    /** Playoff teams of a season with playoff roster stat totals (for playoff ranks). */
    List<TeamSeasonDto> findTeamPlayoffRankings(@Param("seasonNum") Integer seasonNum);

    /** One team's playoff appearances: finish + playoff roster stat totals per season. */
    List<TeamSeasonDto> findTeamPlayoffHistory(@Param("teamCode") String teamCode);
}
