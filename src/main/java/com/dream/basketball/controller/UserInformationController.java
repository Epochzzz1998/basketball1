package com.dream.basketball.controller;

import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.dto.UserInformationDto;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.SecUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

/**
 * 个人消息通知 JSON 接口（P4-1 REST 化）。需登录（P2-5）。
 */
@RestController
@RequestMapping("/userInformation")
public class UserInformationController extends BaseUtils {

    @Autowired
    private UserInformationService userInformationService;

    /** 当前登录用户的消息通知列表 */
    @RequiresRole(Role.USER)
    @GetMapping("/userInformationListData")
    public Object userInformationListData(UserInformationDto param, Integer page, Integer limit, HttpServletRequest request) {
        PageHelper.startPage(page, limit);
        param.setReceiverId(SecUtil.getLoginUserIdToSession(request));
        List<UserInformationDto> rows = userInformationService.getUserInformationListByParam(param);
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }
}
