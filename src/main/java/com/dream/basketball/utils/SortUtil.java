package com.dream.basketball.utils;

import org.apache.commons.lang3.StringUtils;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
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
            // 出手数：资料卡有对应格子，点名次会深链到完整排行，所以要能排序
            "player_avg_fga", "player_avg_tpa", "player_avg_ftm", "player_avg_fta",
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


    /**
     * Selectable columns. A superset of the sortable set: attempts and honor text are
     * rendered but never sorted on, so they are absent from the ORDER BY whitelist.
     *
     * Every name here must be a real column of BOTH player_stats and player_playoff_stats
     * (verified identical, 56 columns each) — one whitelist serves both queries, and a
     * name that exists in neither would splice an unresolvable column into the SELECT.
     * playoffResult and oppTeam belong to other queries' joins, not to these tables, so
     * they are deliberately absent.
     */
    private static final Set<String> ALLOWED_PROJECTION_COLUMNS = new HashSet<>(ALLOWED_STATS_COLUMNS);

    static {
        ALLOWED_PROJECTION_COLUMNS.addAll(Arrays.asList(
                "stats_id", "player_id", "player_avg_fga", "player_avg_tpa",
                "player_avg_ftm", "player_avg_fta",
                "all_dba_team", "all_def_team"));
    }

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


    /**
     * Columns that must be in every projection regardless of what the caller asked for:
     * the row key, the id every link is built from, and the season each row belongs to.
     * Dropping any of them breaks rendering rather than saving bytes worth having.
     */
    private static final String[] PROJECTION_ALWAYS = {"stats_id", "player_id", "season_num"};

    /**
     * Build a whitelisted select list for player_stats / player_playoff_stats, or null to
     * mean "no projection, select everything".
     *
     * Why this exists: the season endpoint returned all 64 columns for up to 2000 rows —
     * 2.89MB of JSON — while a ranking board reads six of them. The caller names the
     * camelCase fields it will actually render and gets only those.
     *
     * Unknown names are dropped rather than rejected: a caller asking for a column this
     * table does not have should lose that column, not the whole response. If nothing
     * survives, returns null so the query falls back to selecting everything — a
     * mistyped parameter must never produce a silently empty row.
     */
    public static String safeStatsProjection(String camelCsv) {
        if (StringUtils.isBlank(camelCsv)) {
            return null;
        }
        Set<String> columns = new LinkedHashSet<>(Arrays.asList(PROJECTION_ALWAYS));
        for (String raw : camelCsv.split(",")) {
            String camel = StringUtils.trimToEmpty(raw);
            if (camel.isEmpty()) {
                continue;
            }
            String column = camel.replaceAll("[A-Z]", "_$0").toLowerCase();
            if (ALLOWED_PROJECTION_COLUMNS.contains(column)) {
                columns.add(column);
            }
        }
        // Only the always-columns matched => the caller named nothing usable; select all.
        if (columns.size() <= PROJECTION_ALWAYS.length) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (String c : columns) {
            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append("s.").append(c);
        }
        return sb.toString();
    }


    /**
     * 生涯总数榜可排的项：驼峰名 -> SQL 表达式。打铁三项是算式而非真列，所以这里存的是
     * 表达式而不是列名，白名单本身就限定了能拼进 SQL 的内容。
     */
    private static final java.util.Map<String, String> TOTALS_COLUMNS = new java.util.HashMap<String, String>() {{
        put("g", "G"); put("gs", "GS"); put("mp", "MP");
        put("fg", "FG"); put("fga", "FGA"); put("fg3", "FG3"); put("fg3a", "FG3A");
        put("ft", "FT"); put("fta", "FTA");
        put("orb", "ORB"); put("drb", "DRB"); put("trb", "TRB");
        put("ast", "AST"); put("stl", "STL"); put("blk", "BLK"); put("tov", "TOV");
        put("pf", "PF"); put("pts", "PTS"); put("tplDbl", "TPL_DBL");
        put("fgMiss", "(FGA - FG)"); put("fg3Miss", "(FG3A - FG3)"); put("ftMiss", "(FTA - FT)");
    }};

    /** 生涯总数榜的排序表达式；不认识的项返回 null，调用方据此拒绝请求。 */
    public static String safeTotalsExpr(String camelField) {
        return TOTALS_COLUMNS.get(StringUtils.trimToEmpty(camelField));
    }


    /**
     * 历史统计王可选的项：驼峰名 -> player_stats 的列。与生涯总数榜分开——那边是累计值，
     * 这边是场均值，两张表两套列名。
     */
    private static final java.util.Map<String, String> CROWN_COLUMNS = new java.util.HashMap<String, String>() {{
        // 不带表别名：这个表达式要在两个作用域里用（外层的 s、子查询里的 s2），
        // 写死 s. 会让子查询报 Unknown column。列名只存在于 player_stats，不会有歧义。
        put("playerAvgScore", "PLAYER_AVG_SCORE"); put("playerAvgReb", "PLAYER_AVG_REB");
        put("playerAvgAss", "PLAYER_AVG_ASS"); put("playerAvgSteal", "PLAYER_AVG_STEAL");
        put("playerAvgBlock", "PLAYER_AVG_BLOCK"); put("playerAvgTpm", "PLAYER_AVG_TPM");
        put("playerAvgFgm", "PLAYER_AVG_FGM"); put("playingTime", "PLAYING_TIME");
        put("playerAccuracy", "PLAYER_ACCURACY"); put("playerThreeAccuracy", "PLAYER_THREE_ACCURACY");
        put("playerFreethrowAccuracy", "PLAYER_FREETHROW_ACCURACY");
    }};

    /** 统计王的排序表达式；不认识的项返回 null，调用方据此拒绝。 */
    public static String safeCrownExpr(String camelField) {
        return CROWN_COLUMNS.get(StringUtils.trimToEmpty(camelField));
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
