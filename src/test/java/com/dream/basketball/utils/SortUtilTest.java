package com.dream.basketball.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** P3-1: whitelist-based ORDER BY builder — makes sorting actually work AND blocks injection. */
class SortUtilTest {

    @Test
    void validColumn_buildsClause() {
        assertEquals("player_avg_score desc", SortUtil.safeStatsOrderBy("playerAvgScore", "desc"));
        assertEquals("season_num asc", SortUtil.safeStatsOrderBy("seasonNum", "asc"));
        assertEquals("mvp_rank desc", SortUtil.safeStatsOrderBy("mvpRank", "DESC"));
    }

    @Test
    void orderDefaultsToAsc_whenBlankOrUnknown() {
        assertEquals("player_per asc", SortUtil.safeStatsOrderBy("playerPer", null));
        assertEquals("player_per asc", SortUtil.safeStatsOrderBy("playerPer", ""));
        assertEquals("player_per asc", SortUtil.safeStatsOrderBy("playerPer", "garbage"));
    }

    @Test
    void unknownColumn_returnsNull() {
        // not in whitelist -> caller falls back to the mapper's default ORDER BY
        assertNull(SortUtil.safeStatsOrderBy("password", "asc"));
        assertNull(SortUtil.safeStatsOrderBy("statsId", "asc"));
        assertNull(SortUtil.safeStatsOrderBy("playerId", "asc"));
    }

    @Test
    void blankField_returnsNull() {
        assertNull(SortUtil.safeStatsOrderBy(null, "desc"));
        assertNull(SortUtil.safeStatsOrderBy("", "desc"));
        assertNull(SortUtil.safeStatsOrderBy("   ", "desc"));
    }

    @Test
    void injectionAttempts_areRejected() {
        // the whole point: raw request values can't reach ${} unless whitelisted
        assertNull(SortUtil.safeStatsOrderBy("player_avg_score; drop table dream_user;--", "asc"));
        assertNull(SortUtil.safeStatsOrderBy("playerAvgScore desc, (select 1)", "asc"));
        assertNull(SortUtil.safeStatsOrderBy("1", "asc"));
        // order direction can't smuggle anything either (anything != desc => asc)
        assertEquals("player_avg_score asc", SortUtil.safeStatsOrderBy("playerAvgScore", "asc; drop table x"));
    }
}
