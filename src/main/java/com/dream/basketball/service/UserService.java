package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamPlayerDto;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.PlayerStatsDto;
import com.dream.basketball.entity.DreamPlayer;
import com.dream.basketball.entity.DreamUser;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

public interface UserService extends IService<DreamUser> {

    public List<DreamUserDto> findAllUsers(@RequestBody(required = false) DreamUserDto param);

}
