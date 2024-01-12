package com.dream.basketball.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.PlayerStats;
import com.dream.basketball.mapper.PlayerStatsMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.PlayerService;
import com.dream.basketball.service.PlayerStatsService;
import com.dream.basketball.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@Service
public class PlayerStatsServiceImpl extends ServiceImpl<PlayerStatsMapper, PlayerStats> implements PlayerStatsService {

}
