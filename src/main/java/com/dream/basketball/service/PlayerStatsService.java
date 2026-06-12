package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.entity.PlayerStats;

import java.util.List;

public interface PlayerStatsService extends IService<PlayerStats> {

    // P3-2: multi-step writes wrapped in service-layer transactions

    /** Save/Update each stat row, then recompute and persist the career-summary row, atomically. */
    void saveStatsAndRecomputeSummary(List<PlayerStats> statsList, String playerId);

    /** Insert stat rows (assigning ids) plus a trailing blank row, atomically. */
    void insertStatsWithBlankRow(List<PlayerStats> statsList, String playerId);
}
