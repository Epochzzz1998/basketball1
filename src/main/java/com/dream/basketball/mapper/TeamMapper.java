package com.dream.basketball.mapper;

import com.dream.basketball.dto.TeamSeasonDto;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TeamMapper {

    /** Team records + playoff finishes for a season, with roster per-game stat totals. */
    List<TeamSeasonDto> findTeamRankings(@Param("seasonNum") Integer seasonNum);
}
