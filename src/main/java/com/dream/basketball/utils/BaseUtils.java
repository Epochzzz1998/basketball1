package com.dream.basketball.utils;

import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.UserService;
import org.apache.commons.lang3.StringUtils;
import org.springframework.ui.Model;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * @Author Epoch
 * @Description 常用方法工具类
 * @Date 2023/2/1 10:12
 * @Param
 * @return
 **/
public class BaseUtils {
    /**
     * @Author Epoch
     * @Description 处理返回前台的数据列表
     * @Date 2023/2/1 10:12
     * @Param [code, msg, count, data]
     * @return java.lang.Object
     **/
    public Object handlerSuccessPageJson(int code, String msg, int count, Object data) {
        Map<String, Object> map = new HashMap<String, Object>();
        map.put("code", code);
        map.put("msg", msg);
        map.put("count", count);
        map.put("data", data);
        return map;
    }

    /**
     * @Author Epoch
     * @Description 返回处理结果
     * @Date 2023/2/2 14:41
     * @Param [result, msg]
     * @return java.lang.Object
     **/
    public Object handlerResultJson(boolean result, String msg) {
        Map<String, Object> map = new HashMap<String, Object>();
        map.put("msg", msg);
        map.put("result", result);
        return map;
    }

    /**
     * 数据表字段名转换为驼峰式名字的实体类属性名
     * @param tabAttr   数据表字段名
     * @return  转换后的驼峰式命名
     */
    public static String camelize(String tabAttr){
        if(isBlank(tabAttr))
            return tabAttr;
        Pattern pattern = Pattern.compile("(.*)_(\\w)(.*)");
        Matcher matcher = pattern.matcher(tabAttr);
        if(matcher.find()){
            return camelize(matcher.group(1) + matcher.group(2).toUpperCase() + matcher.group(3));
        }else{
            return tabAttr;
        }
    }

    /**
     * 驼峰式的实体类属性名转换为数据表字段名
     * @param camelCaseStr  驼峰式的实体类属性名
     * @return  转换后的以"_"分隔的数据表字段名
     */
    public static String decamelize(String camelCaseStr){
        return isBlank(camelCaseStr) ? camelCaseStr : camelCaseStr.replaceAll("[A-Z]", "_$0").toLowerCase();
    }

    /**
     * 字符串是否为空
     * @param str   待检查的字符串
     * @return  空：true; 非空：false
     */
    public static boolean isBlank(String str){
        return str == null || "".equals(str);
    }

    /**
     * 从HttpSession对象中获取uid
     * @param session HttpSession对象
     * @return 当前登录的用户的id
     */
    public final Integer getUidFromSession(HttpSession session) {
        return Integer.valueOf(session.getAttribute("uid").toString());
    }

    /**
     * 从HttpSession对象中获取用户名
     * @param session HttpSession对象
     * @return 当前登录的用户名
     */
    public final String getUsernameFromSession(HttpSession session) {
        return session.getAttribute("username").toString();
    }

    /**
     * @Author Epoch
     * @Description 检测是否登录并将状态传到前端
     * @Date 2023/2/3 8:54
     * @Param [model, request]
     * @return void
     **/
    public boolean isLogin(Model model, HttpServletRequest request){
        model.addAttribute("isLogin", SecUtil.isLogin(request) ? "true" : "");
        return SecUtil.isLogin(request) ? true : false;
    }

    /**
     * @Author Epoch
     * @Description 判断是否为超级管理员
     * @Date 2023/2/3 13:17
     * @Param [model, request]
     * @return void
     **/
    public boolean isSuperManager(Model model, HttpServletRequest request){
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        if(dreamUser != null){
            model.addAttribute("isSuperManager", StringUtils.equals(dreamUser.getUserRole(), Constants.SUPER_MANAGER) ? "true" : "");
            return StringUtils.equals(dreamUser.getUserRole(), Constants.SUPER_MANAGER) ? true : false;
        }
        return false;
    }

    /**
    * @Description: 是否至少是管理员
    * @param: [model, request]
    * @Author: Epoch
    * @return: boolean
    * @Date: 2024/1/11
    * @time: 15:53
    */
    public boolean isManagerOrOver(Model model, HttpServletRequest request){
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        if(dreamUser != null){
            model.addAttribute("isManagerOrOver", StringUtils.contains(dreamUser.getUserRole().toLowerCase(), Constants.MANAGER) ? "true" : "");
            return StringUtils.contains(dreamUser.getUserRole().toLowerCase(), Constants.MANAGER) ? true : false;
        }
        return false;
    }

    /**
    * @Description: 获取登录用户
    * @param: [request]
    * @Author: Epoch
    * @return: com.dream.basketball.entity.DreamUser
    * @Date: 2024/1/10
    * @time: 16:57
    */
    public DreamUser getLoginDreamUser(HttpServletRequest request) {
        return SecUtil.getLoginUserToSession(request);
    }

    /**
     * @Author Epoch
     * @Description 集成加载页面的菜单权限
     * @Date 2023/2/3 13:19
     * @Param [model, request]
     * @return void
     **/
    public boolean menuPower(Model model, HttpServletRequest request){
        if(isLogin(model, request)){
            if(isSuperManager(model, request)){
                return true;
            }
        }
        return false;
    }
}
