package com.dream.basketball.controller;

import com.dream.basketball.dto.DreamNewsCommentDto;
import com.dream.basketball.dto.NewsDto;
import com.dream.basketball.dto.UserInformationDto;
import com.dream.basketball.entity.DreamNewsComment;
import com.dream.basketball.entity.UserInformation;
import com.dream.basketball.esEntity.News;
import com.dream.basketball.service.DreamNewsCommentService;
import com.dream.basketball.service.DreamNewsService;
import com.dream.basketball.service.NewsService;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.SecUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/userInformation")
public class UserInformationController extends BaseUtils {

    private Logger logger = LoggerFactory.getLogger(getClass());

    @Autowired
    NewsService newsService;

    @Autowired
    DreamNewsService dreamNewsService;

    @Autowired
    DreamNewsCommentService dreamNewsCommentService;

    @Autowired
    UserInformationService userInformationService;

    /**
    * @Description: 个人消息通知
    * @param: [model, request]
    * @Author: Epoch
    * @return: java.lang.String
    * @Date: 2024/2/1
    * @time: 15:55
    */
    @RequestMapping("/userInformationList")
    public String userInformationList(Model model, HttpServletRequest request) {
        menuPower(model, request);
        return "user/user-information";
    }

    /**
    * @Description: 个人消息通知数据
    * @param: [param, page, limit, response]
    * @Author: Epoch
    * @return: java.lang.Object
    * @Date: 2024/2/1
    * @time: 15:55
    */
    @RequestMapping("/userInformationListData")
    @ResponseBody
    public Object userInformationListData(UserInformationDto param, Integer page, Integer limit, HttpServletRequest request) throws Exception {
        int code = -1;
        List<UserInformationDto> rows = new ArrayList<>();
        int count = 0;
        try {
            PageHelper.startPage(page, limit);
            param.setReceiverId(SecUtil.getLoginUserIdToSession(request));
            rows = userInformationService.getUserInformationListByParam(param);
            PageInfo<UserInformationDto> playerStatsDtoPageInfo = new PageInfo<>(rows);
            count = (int) playerStatsDtoPageInfo.getTotal();
            code = 0;
        } catch (Exception e) {
            logger.error("{newsListData}错误" + e.getMessage(), e);
        }
        return handlerSuccessPageJson(code, "成功获取", count, rows);
    }

}
