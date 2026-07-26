package com.dream.basketball.dto;

import com.dream.basketball.entity.PlayerStats;
import lombok.Data;

@Data
public class PlayerStatsDto extends PlayerStats {
    private String playerName;
    private String playerNumber;
    /** 球员照片 URL（dream_player.PHOTO；没上传过为 null） */
    private String photo;
    private String field;
    private String order;

    /** 季后赛数据行附带的当季球队季后赛成绩（读时联 team_season，常规赛查询为 null）。 */
    private String playoffResult;

    /** 轮次查询专用：1 首轮 / 2 半决赛 / 3 分区决赛 / 4 总决赛（其他查询为 null）。 */
    private Integer round;

    /** 轮次查询专用：该轮对手球队代码。 */
    private String oppTeam;
}
