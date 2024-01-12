package com.dream.basketball.dto;

import com.dream.basketball.entity.PlayerStats;
import lombok.Data;

@Data
public class PlayerStatsDto extends PlayerStats {
    private String playerName;
    private String playerNumber;
    private String field;
    private String order;
}
