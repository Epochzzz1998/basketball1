package com.dream.basketball.dto;

import com.dream.basketball.entity.DreamPlayer;
import lombok.Data;

@Data
public class DreamPlayerDto extends DreamPlayer {
    private Integer seasonNum;
}
