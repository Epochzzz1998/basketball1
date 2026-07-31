package com.dream.basketball.dto;

import com.dream.basketball.entity.PlayerStats;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * Null properties are dropped from the JSON. Without this, column projection saves
 * nothing on the wire: the SELECT returns fewer columns but Jackson still writes all
 * ~65 keys per row with nulls for the ones not asked for, and the keys are most of the
 * payload at 2000 rows. Callers already treat absent and null identically (row?.[k]).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Data
public class PlayerStatsDto extends PlayerStats {
    private String playerName;
    private String playerNumber;
    /** 球员照片 URL（dream_player.PHOTO；没上传过为 null） */
    private String photo;
    /* 下面三个是请求参数，不该出现在响应里——它们装的是拼好的 SQL 片段
       （order by 子句 / select 列表），回显既无用又是每行都重复一遍的噪音。 */
    @JsonIgnore
    private String field;
    @JsonIgnore
    private String order;
    /** 列裁剪：调用方用逗号分隔的驼峰列名声明"我只渲染这些"，经白名单转成 select 列表。
     *  为空则整行返回（旧行为）。 */
    @JsonIgnore
    private String fields;

    /** 季后赛数据行附带的当季球队季后赛成绩（读时联 team_season，常规赛查询为 null）。 */
    private String playoffResult;

    /** 轮次查询专用：1 首轮 / 2 半决赛 / 3 分区决赛 / 4 总决赛（其他查询为 null）。 */
    private Integer round;

    /** 轮次查询专用：该轮对手球队代码。 */
    private String oppTeam;

    /**
     * 只要本赛季的新秀（新秀榜用）。
     *
     * <p>判据是「他在 player_stats 里最早的赛季就是这一季」，不是选秀年份——
     * 库里根本没有选秀数据，而且**落选新秀按选秀反推会被整批漏掉**。
     * 这个口径经过对照：1976-77 那一季（我们逐季数据的最早一批里最容易出问题的）
     * 按它算出 100 人，按 {@code nba_career_totals.FIRST_YEAR} 算也是 100 人，
     * 而且是同一批 100 人——同季还有 173 名 1977 年之前就出道的老将，两种口径
     * 都正确地把他们排除在外。
     *
     * <p>请求参数，不回显。
     */
    @JsonIgnore
    private Boolean rookieOnly;
}
