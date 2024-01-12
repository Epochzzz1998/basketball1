package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.PlayerStats;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

public interface PlayerStatsService extends IService<PlayerStats> {

}
