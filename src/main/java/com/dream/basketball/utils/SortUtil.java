package com.dream.basketball.utils;

import org.apache.commons.lang3.StringUtils;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Safe dynamic ORDER BY builder for player-stats queries (P3-1).
 *
 * The old code did {@code param.setField(" col desc")} and the mapper bound it as
 * {@code order by #{param.field}} — a prepared-statement parameter, so MySQL saw a
 * string literal and effectively did NOT sort (silent no-op). Switching the mapper
 * to {@code ${param.field}} makes sorting work but would be SQL-injectable on a raw
 * request value. This builder closes both: it accepts the request's camelCase field
 * + direction, validates the de-camelized column against a fixed whitelist, and
 * returns a clause that is safe to splice with {@code ${}} (or null to fall back to
 * the mapper's default ORDER BY).
 */
public final class SortUtil {

    /** Sortable player_stats columns (snake_case). PLAYER_ID/STATS_ID intentionally excluded. */
    private static final Set<String> ALLOWED_STATS_COLUMNS = new HashSet<>(Arrays.asList(
            "season", "season_num", "player_team", "player_position",
            "player_appearance", "player_fr_appearance", "player_sr_appearance", "playing_time",
            "player_avg_score", "player_avg_reb", "player_avg_off_reb", "player_avg_def_reb", "player_avg_ass",
            "player_avg_fgm", "player_avg_tpm",
            "player_accuracy", "player_three_accuracy", "player_freethrow_accuracy",
            "player_avg_block", "player_avg_steal", "player_avg_turnover", "player_avg_pf",
            "player_per", "player_pie", "player_ws",
            "player_off_eff", "player_def_eff", "player_net_eff", "player_avg_pn",
            "player_bpm", "player_obpm", "player_dbpm",
            "player_per_real", "player_ts_pct", "player_usg_pct", "player_vorp",
            "player_ows", "player_dws", "player_ws48",
            "player_orb_pct", "player_drb_pct", "player_trb_pct",
            "player_ast_pct", "player_stl_pct", "player_blk_pct", "player_tov_pct",
            "mvp_rank", "dpoy_rank"));

    /**
     * Sortable columns of player_playoff_round_stats. It is a narrower table than
     * player_stats — no position, no honor ranks, no advanced-efficiency columns — so a
     * crafted field= would otherwise splice a column MySQL cannot resolve.
     */
    private static final Set<String> ALLOWED_ROUND_COLUMNS = new HashSet<>(Arrays.asList(
            "season_num", "round", "player_team", "opp_team",
            "player_appearance", "player_fr_appearance", "playing_time",
            "player_avg_score", "player_avg_reb", "player_avg_off_reb", "player_avg_def_reb",
            "player_avg_ass", "player_avg_steal", "player_avg_block", "player_avg_turnover", "player_avg_pf",
            "player_avg_pn",
            "player_avg_fgm", "player_avg_fga", "player_avg_tpm", "player_avg_tpa",
            "player_avg_ftm", "player_avg_fta",
            "player_accuracy", "player_three_accuracy", "player_freethrow_accuracy", "player_per"));

    private SortUtil() {
    }

    /**
     * Build a whitelisted {@code "<column> <asc|desc>"} clause, or null if the field
     * is blank/unknown. The result is safe to use with mybatis {@code ${}}.
     */
    public static String safeStatsOrderBy(String camelField, String order) {
        return build(camelField, order, ALLOWED_STATS_COLUMNS);
    }

    /** Same contract as {@link #safeStatsOrderBy}, against the per-round playoff table. */
    public static String safeRoundStatsOrderBy(String camelField, String order) {
        return build(camelField, order, ALLOWED_ROUND_COLUMNS);
    }

    private static String build(String camelField, String order, Set<String> allowed) {
        if (StringUtils.isBlank(camelField)) {
            return null;
        }
        String column = camelField.replaceAll("[A-Z]", "_$0").toLowerCase();
        if (!allowed.contains(column)) {
            return null;
        }
        String direction = "desc".equalsIgnoreCase(StringUtils.trimToEmpty(order)) ? "desc" : "asc";
        return column + " " + direction;
    }
}
