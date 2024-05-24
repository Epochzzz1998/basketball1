package com.dream.basketball.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.UserInformationDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserInformation;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface UserInformationMapper extends BaseMapper<UserInformation> {

    public List<UserInformationDto> getUserInformationListByParam(@Param("param") UserInformationDto param);

}
