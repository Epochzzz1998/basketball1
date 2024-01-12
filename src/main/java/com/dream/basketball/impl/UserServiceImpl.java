package com.dream.basketball.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.PlayerMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.PlayerService;
import com.dream.basketball.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, DreamUser> implements UserService {

    public List<DreamUserDto> findAllUsers(@RequestBody DreamUserDto param){
        return baseMapper.findAllUsers(param);
    }
}
