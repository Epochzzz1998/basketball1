package com.dream.basketball.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.dto.UserInformationDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserInformation;
import org.springframework.web.bind.annotation.RequestBody;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

public interface UserInformationService extends IService<UserInformation> {

    public void saveUserInformation(String operatorId, String operatorName, String receiverId, String msgType, String msgId, String msgIdSecond, String msgIdThird, String level, String commentContent, String commentRelRelId);

    public void removeUserInformation(String msgType, String msgId, String operatorId);

    public void updateInformationRead(String userInformationId);

    public void updateInformationToRead(String userInformationId);

    public List<UserInformationDto> getUserInformationListByParam(UserInformationDto param);

}
