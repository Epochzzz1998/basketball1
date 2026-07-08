package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.dto.DreamUserDto;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.service.UserService;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.PasswordUtil;
import com.dream.basketball.utils.SecUtil;
import com.wf.captcha.SpecCaptcha;
import com.wf.captcha.base.Captcha;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户与登录 JSON 接口（P4-1 REST 化）。登录/注册/验证码公开；登出与「当前用户」需登录。
 */
@RestController
@RequestMapping("/user")
public class UserController extends BaseUtils {

    @Autowired
    private UserService userService;

    /**
     * 登录：先校验单次验证码（P2-2），再核对账号/密码（BCrypt，旧 MD5 透明升级，P2-3）。
     */
    @PostMapping("/login")
    public Object login(DreamUserDto dreamUserDto, HttpServletRequest request) {
        // P2-2: 验证码强制校验，单次消费
        String inputCode = request.getParameter("code");
        Object sessionCaptcha = request.getSession().getAttribute("captcha");
        request.getSession().removeAttribute("captcha");
        if (sessionCaptcha == null || StringUtils.isBlank(inputCode)
                || !StringUtils.equalsIgnoreCase(inputCode.trim(), sessionCaptcha.toString())) {
            return handlerResultJson(false, "验证码错误！");
        }
        List<DreamUserDto> users = userService.findAllUsers(dreamUserDto);
        if (CollectionUtils.isEmpty(users)) {
            return handlerResultJson(false, "账号不存在！请检查后重新输入！");
        }
        DreamUser dreamUser = users.get(0);
        if (!PasswordUtil.matches(dreamUserDto.getPassword(), dreamUser.getPassword())) {
            return handlerResultJson(false, "密码错误，请检查后重新输入！");
        }
        // 全局用户管理：账号被超管禁用则不允许登录
        if (Constants.DISABLE.equals(dreamUser.getUserStatus())) {
            return handlerResultJson(false, "账号已被禁用，请联系管理员");
        }
        // P2-3: 旧 MD5 校验通过即透明升级为 BCrypt（只更新 PASSWORD 一列）
        if (PasswordUtil.needsUpgrade(dreamUser.getPassword())) {
            String upgraded = PasswordUtil.hash(dreamUserDto.getPassword());
            userService.update(new UpdateWrapper<DreamUser>()
                    .eq("USER_ID", dreamUser.getUserId())
                    .set("PASSWORD", upgraded));
            dreamUser.setPassword(upgraded);
        }
        // 登录成功即刷新"最近活跃"（个人主页展示用）
        Date now = new Date();
        userService.update(new UpdateWrapper<DreamUser>()
                .eq("USER_ID", dreamUser.getUserId())
                .set("LAST_LOGIN_TIME", now));
        dreamUser.setLastLoginTime(now);
        SecUtil.setLoginUserIdToSession(request, dreamUser);
        SecUtil.setLoginUserToSession(request, dreamUser);
        return handlerResultJson(true, "登录成功！");
    }

    /**
     * 注册：昵称查重（P3-1，命中即拒）；DB 唯一索引兜并发，重复键由 GlobalExceptionHandler 友好化。
     */
    @PostMapping("/regist")
    public Object regist(DreamUserDto dreamUserDto) {
        // 登录名（注册后固定，用于登录）与昵称（显示名，之后可改）都必须唯一，各查各的
        if (StringUtils.isBlank(dreamUserDto.getLoginName())) {
            return handlerResultJson(false, "请填写登录名");
        }
        if (StringUtils.isBlank(dreamUserDto.getUserNickname())) {
            return handlerResultJson(false, "请填写昵称");
        }
        DreamUserDto byLogin = new DreamUserDto();
        byLogin.setLoginName(dreamUserDto.getLoginName().trim());
        if (!CollectionUtils.isEmpty(userService.findAllUsers(byLogin))) {
            return handlerResultJson(false, "该登录名已被占用！");
        }
        DreamUserDto byNick = new DreamUserDto();
        byNick.setUserNickname(dreamUserDto.getUserNickname().trim());
        if (!CollectionUtils.isEmpty(userService.findAllUsers(byNick))) {
            return handlerResultJson(false, "该昵称已被占用！");
        }
        DreamUser dreamUser = new DreamUser();
        dreamUser.setUserId(UUID.randomUUID().toString());
        dreamUser.setRegistTime(new Date());
        dreamUser.setLoginName(dreamUserDto.getLoginName().trim());
        dreamUser.setUserNickname(dreamUserDto.getUserNickname().trim());
        // userName = 真实姓名（老字段，新注册表单不再收集，留空；老用户的姓名数据保留不动）
        dreamUser.setUserName(dreamUserDto.getUserName());
        dreamUser.setPassword(PasswordUtil.hash(dreamUserDto.getPassword()));
        dreamUser.setUserStatus(Constants.USABLE);
        dreamUser.setUserRole(Constants.NORMAL_USER);
        dreamUser.setPlayerIdentification(Constants.UNIDENTIFICATION);
        userService.save(dreamUser);
        return handlerResultJson(true, "注册成功！");
    }

    /** 检测登录状态 */
    @GetMapping("/checkLogin")
    public Object checkLogin(HttpServletRequest request) {
        DreamUser dreamUser = SecUtil.getLoginUserToSession(request);
        return dreamUser == null ? handlerResultJson(false, "请先登录！") : handlerResultJson(true, "已登录！");
    }

    /** 当前登录用户信息 + 角色标识（供前端渲染菜单/权限，P4-1） */
    @RequiresRole(Role.USER)
    @GetMapping("/current")
    public Object current(HttpServletRequest request) {
        DreamUser u = SecUtil.getLoginUserToSession(request);
        // 权限/功能开关实时读 DB（session 存的是登录时快照）：超管改了开关，用户刷新一次即生效，不用重登
        DreamUser fresh = u == null ? null : userService.getById(u.getUserId());
        if (fresh != null) {
            u = fresh;
        }
        Role role = Role.fromUserRole(u.getUserRole());
        Map<String, Object> data = new HashMap<>();
        data.put("userId", u.getUserId());
        data.put("userNickname", u.getUserNickname());
        data.put("userName", u.getUserName());
        data.put("userRole", u.getUserRole());
        data.put("avatar", u.getAvatar());
        data.put("isSuperManager", role == Role.SUPER_MANAGER);
        data.put("isManagerOrOver", role.covers(Role.MANAGER));
        // 全局权限（超管可控）：前端据此显隐入口/给提示；后端有兜底
        data.put("canBrowse", !"0".equals(u.getCanBrowse()));
        data.put("canComment", !"0".equals(u.getCanComment()));
        data.put("canPost", !"0".equals(u.getCanPost()));
        // 功能模块可用性（前端据此显隐导航菜单）
        data.put("featData", !"0".equals(u.getFeatData()));
        data.put("featNews", !"0".equals(u.getFeatNews()));
        data.put("featForum", !"0".equals(u.getFeatForum()));
        data.put("featPm", !"0".equals(u.getFeatPm()));
        return new Result<>(0, "成功", data);
    }

    /** 登出 */
    @RequiresRole(Role.USER)
    @PostMapping("/loginOut")
    public Object loginOut(HttpServletRequest request) {
        SecUtil.logout4Session(request);
        return handlerResultJson(true, "已登出");
    }

    // ===== 全局用户管理（超级管理员） =====

    /** 用户列表（超管）：按昵称/用户名模糊分页，带全局权限位。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @GetMapping("/adminList")
    public Object adminList(String keyword, Integer page, Integer limit) {
        com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<DreamUser> qw =
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<>();
        if (StringUtils.isNotBlank(keyword)) {
            String kw = keyword.trim();
            qw.and(w -> w.like("USER_NICKNAME", kw).or().like("USER_NAME", kw));
        }
        qw.orderByDesc("REGIST_TIME");
        com.github.pagehelper.PageHelper.startPage(page == null ? 1 : page, limit == null ? 20 : limit);
        java.util.List<DreamUser> users = userService.list(qw);
        com.github.pagehelper.PageInfo<DreamUser> info = new com.github.pagehelper.PageInfo<>(users);
        java.util.List<java.util.Map<String, Object>> rows = new java.util.ArrayList<>();
        for (DreamUser u : users) {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("userId", u.getUserId());
            m.put("userNickname", u.getUserNickname());
            m.put("userName", u.getUserName());
            m.put("userRole", u.getUserRole());
            m.put("avatar", u.getAvatar());
            m.put("registTime", u.getRegistTime());
            m.put("lastLoginTime", u.getLastLoginTime());
            m.put("enabled", !Constants.DISABLE.equals(u.getUserStatus()));
            m.put("canBrowse", !"0".equals(u.getCanBrowse()));
            m.put("canComment", !"0".equals(u.getCanComment()));
            m.put("canPost", !"0".equals(u.getCanPost()));
            m.put("featData", !"0".equals(u.getFeatData()));
            m.put("featNews", !"0".equals(u.getFeatNews()));
            m.put("featForum", !"0".equals(u.getFeatForum()));
            m.put("featPm", !"0".equals(u.getFeatPm()));
            m.put("isSuperManager", Role.fromUserRole(u.getUserRole()) == Role.SUPER_MANAGER);
            rows.add(m);
        }
        return handlerSuccessPageJson(0, "成功", (int) info.getTotal(), rows);
    }

    /** 设置某用户的全局权限（超管）：登录/浏览/发言/发帖。不能改超管、不能改自己。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/setUserPerms")
    public Object setUserPerms(String userId, String enabled, String canBrowse, String canComment, String canPost,
                              String featData, String featNews, String featForum, String featPm,
                              HttpServletRequest request) {
        DreamUser target = StringUtils.isBlank(userId) ? null : userService.getById(userId);
        if (target == null) {
            return handlerResultJson(false, "用户不存在");
        }
        if (Role.fromUserRole(target.getUserRole()) == Role.SUPER_MANAGER) {
            return handlerResultJson(false, "不能修改超级管理员");
        }
        if (StringUtils.equals(userId, SecUtil.getLoginUserIdToSession(request))) {
            return handlerResultJson(false, "不能修改自己");
        }
        UpdateWrapper<DreamUser> uw = new UpdateWrapper<DreamUser>().eq("USER_ID", userId);
        if (enabled != null) {
            uw.set("USER_STATUS", "1".equals(enabled) ? Constants.USABLE : Constants.DISABLE);
        }
        if (canBrowse != null) {
            uw.set("CAN_BROWSE", "1".equals(canBrowse) ? "1" : "0");
        }
        if (canComment != null) {
            uw.set("CAN_COMMENT", "1".equals(canComment) ? "1" : "0");
        }
        if (canPost != null) {
            uw.set("CAN_POST", "1".equals(canPost) ? "1" : "0");
        }
        if (featData != null) {
            uw.set("FEAT_DATA", "1".equals(featData) ? "1" : "0");
        }
        if (featNews != null) {
            uw.set("FEAT_NEWS", "1".equals(featNews) ? "1" : "0");
        }
        if (featForum != null) {
            uw.set("FEAT_FORUM", "1".equals(featForum) ? "1" : "0");
        }
        if (featPm != null) {
            uw.set("FEAT_PM", "1".equals(featPm) ? "1" : "0");
        }
        userService.update(uw);
        return handlerResultJson(true, "已保存");
    }

    /** 验证码图片（前端以 <img src> 加载；答案存 session 供 /login 校验，不再打印到控制台） */
    @GetMapping("/captcha")
    public void captcha(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.setHeader("Pragma", "No-cache");
        response.setContentType("image/gif");
        response.setDateHeader("Expires", 0);
        response.setHeader("Cache-Control", "no-cache");
        SpecCaptcha specCaptcha = new SpecCaptcha(130, 48, 4);
        specCaptcha.setFont(Captcha.FONT_1);
        specCaptcha.setCharType(Captcha.TYPE_ONLY_NUMBER);
        request.getSession().setAttribute("captcha", specCaptcha.text().toLowerCase());
        specCaptcha.out(response.getOutputStream());
    }
}
