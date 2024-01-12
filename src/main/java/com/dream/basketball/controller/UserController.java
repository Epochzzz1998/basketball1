package com.dream.basketball.controller;

import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.UserService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.SecUtil;
import com.wf.captcha.SpecCaptcha;
import com.wf.captcha.base.Captcha;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.view.RedirectView;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * @Author Epoch
 * @Description 用户及登录的controller
 * @Date 2023/2/2 11:06
 * @Param
 * @return
 **/
@Controller
@RequestMapping("/user")
public class UserController extends BaseUtils {
    private Logger logger = LoggerFactory.getLogger(getClass());

    @Autowired
    private UserService userService;

    /**
     * @Author Epoch
     * @Description 跳转登录页
     * @Date 2023/2/2 13:53
     * @Param [model]
     * @return java.lang.String
     **/
    @RequestMapping("/loginPage")
    public String loginPage(Model model){
        return "login";
    }

    /**
     * @Author Epoch
     * @Description 注册页面
     * @Date 2023/2/2 16:19
     * @Param [model]
     * @return java.lang.String
     **/
    @RequestMapping("/registPage")
    public String registPage(Model model){
        return "regist";
    }

    /**
     * @Author Epoch
     * @Description 处理用户登录
     * @Date 2023/2/2 14:44
     * @Param [userNickname, password, request, response]
     * @return java.lang.Object
     **/
    @RequestMapping("/login")
    @ResponseBody
    public Object login(DreamUserDto dreamUserDto, HttpServletRequest request, HttpServletResponse response){
        String msg = "登陆失败！";
        boolean result = false;
        try{
            List<DreamUserDto> dreamUserDtos = userService.findAllUsers(dreamUserDto);
            if(!CollectionUtils.isEmpty(dreamUserDtos)){
                if(StringUtils.equals(dreamUserDto.getPassword(), dreamUserDtos.get(0).getPassword())){
                    DreamUser dreamUser = dreamUserDtos.get(0);
                    // 设置session信息
                    SecUtil.setLoginUserIdToSession(request, dreamUser);
                    SecUtil.setLoginUserToSession(request, dreamUser);
                    SecUtil.setCookie(response, Constants.TOKEN, UUID.randomUUID().toString(), Constants.EXPIRE);
                    msg = "登陆成功！";
                    result = true;
                }
                else {
                    msg = "密码错误，请检查后重新输入！";
                }
            }
            else {
                msg = "账号不存在！请检查后重新输入！";
            }
        }catch (Exception e) {
            logger.error("", e);
        }
        return handlerResultJson(result, msg);
    }

    /**
     * @Author Epoch
     * @Description 登出
     * @Date 2023/2/2 17:44
     * @Param [dreamUserDto, request, response]
     * @return java.lang.Object
     **/
    @RequestMapping("/loginOut")
    @ResponseBody
    public RedirectView loginOut(DreamUserDto dreamUserDto, HttpServletRequest request, HttpServletResponse response){
        String msg = "登出失败！";
        boolean result = false;
        try{
            if(SecUtil.isLogin(request)){
                SecUtil.deleteCookie(response, Constants.TOKEN);
                SecUtil.logout4Session(request);
                msg = "已登出！";
                result = true;
            }
        }catch (Exception e) {
            logger.error("", e);
        }
        return new RedirectView(getAbsContextPath(request));
    }

    /**
     * @Author Epoch
     * @Description 用户注册
     * @Date 2023/2/2 16:19
     * @Param [dreamUserDto, request, response]
     * @return java.lang.Object
     **/
    @RequestMapping("/regist")
    @ResponseBody
    public Object regist(DreamUserDto dreamUserDto, HttpServletRequest request, HttpServletResponse response){
        String msg = "登陆失败！";
        boolean result = false;
        try{
            List<DreamUserDto> dreamUserDtos = userService.findAllUsers(dreamUserDto);
            if(!CollectionUtils.isEmpty(dreamUserDtos)){
                msg = "该用户已存在！";
            }
            DreamUser dreamUser = new DreamUser();
            dreamUser.setUserId(UUID.randomUUID().toString());
            dreamUser.setRegistTime(new Date());
            dreamUser.setUserNickname(dreamUserDto.getUserNickname());
            dreamUser.setPassword(dreamUserDto.getPassword());
            dreamUser.setUserStatus(Constants.USABLE);
            dreamUser.setUserName(dreamUserDto.getUserName());
            dreamUser.setUserRole(Constants.NORMAL_USER);
            dreamUser.setPlayerIdentification(Constants.UNIDENTIFICATION);
            userService.save(dreamUser);
            msg = "注册成功！";
            result = true;
        }catch (Exception e) {
            logger.error("", e);
        }
        return handlerResultJson(result, msg);
    }

    /**
     * @Author Epoch
     * @Description 验证码
     * @Date 2023/2/2 13:53
     * @Param [request, response]
     * @return void
     **/
    @RequestMapping("/captcha")
    @ResponseBody
    public void captcha(Model model, HttpServletRequest request, HttpServletResponse response) throws Exception {
        // 设置请求头为输出图片类型
        response.setHeader("Pragma", "No-cache");
        response.setContentType("image/gif");
        response.setDateHeader("Expires", 0);
        response.setHeader("Cache-Control", "no-cache");
        // 三个参数分别为宽、高、位数
        SpecCaptcha specCaptcha = new SpecCaptcha(130, 48, 4);
        System.out.println(specCaptcha.text());
        specCaptcha.setFont(Captcha.FONT_1);
        // 设置类型，纯数字、纯字母、字母数字混合
        specCaptcha.setCharType(Captcha.TYPE_ONLY_NUMBER);
        // 验证码存入session
        request.getSession().setAttribute("captcha", specCaptcha.text().toLowerCase());
        // 输出图片流
        specCaptcha.out(response.getOutputStream());
    }

    /**
     * @Author Epoch
     * @Description 获取绝对路径
     * @Date 2023/2/2 17:47
     * @Param [request]
     * @return java.lang.String
     **/
    public String getAbsContextPath(HttpServletRequest request) {
        return request.getScheme() + "://" + request.getServerName() + ":" + request.getServerPort() + "/player/playerList";
    }
}
