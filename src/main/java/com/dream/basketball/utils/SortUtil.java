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
            "player_avg_score", "player_avg_reb", "player_avg_ass",
            "player_avg_fgm", "player_avg_tpm",
            "player_accuracy", "player_three_accuracy", "player_freethrow_accuracy",
            "player_avg_block", "player_avg_steal", "player_avg_turnover",
            "player_per", "player_pie", "player_ws",
            "player_off_eff", "player_def_eff", "player_net_eff", "player_avg_pn",
            "mvp_rank", "dpoy_rank"));

    private SortUtil() {
    }

    /**
     * Build a whitelisted {@code "<column> <asc|desc>"} clause, or null if the field
     * is blank/unknown. The result is safe to use with mybatis {@code ${}}.
     */
    public static String safeStatsOrderBy(String camelField, String order) {
        if (StringUtils.isBlank(camelField)) {
            return null;
        }
        String column = camelField.replaceAll("[A-Z]", "_$0").toLowerCase();
        if (!ALLOWED_STATS_COLUMNS.contains(column)) {
            return null;
        }
        String direction = "desc".equalsIgnoreCase(StringUtils.trimToEmpty(order)) ? "desc" : "asc";
        return column + " " + direction;
    }
}
