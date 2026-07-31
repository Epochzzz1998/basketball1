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
    @Autowired
    private com.dream.basketball.config.TokenStore tokenStore;

    @Autowired
    private com.dream.basketball.config.SingleSessionGuard singleSession;
    @Autowired
    private com.dream.basketball.config.CaptchaStore captchaStore;
    @Autowired
    private com.dream.basketball.mapper.BbqStaffMapper bbqStaffMapper;
    @Autowired
    private com.dream.basketball.mapper.ForumTopicMapper topicMapper;

    /**
     * 登录：先校验单次验证码（P2-2），再核对账号/密码（BCrypt，旧 MD5 透明升级，P2-3）。
     *
     * <p><b>阶段 1 加了两件事，都是"加一条路"而不是"换一条路"：</b>
     *
     * <p>① <b>验证码支持两种关联方式</b>。带了 {@code captchaId} 就走 Redis（新，
     * 不依赖 Cookie，App 和网页通用），没带就走原来的 session（旧）。
     * 保留旧路是为了老前端缓存还在的人也能登录，以及新路万一有问题时能只回滚前端。
     *
     * <p>② <b>{@code wantToken=1} 时额外签发一个令牌</b>。不主动发是有意的：
     * 令牌存在客户端的 JS 能读到的地方（localStorage），而浏览器现在用的 Cookie 是
     * httpOnly 的，XSS 偷不走。给网页端无端发一个令牌等于凭空降低它的安全性。
     * 只有拿不到 Cookie 的客户端（套壳 App）才需要它。
     */
    @PostMapping("/login")
    public Object login(DreamUserDto dreamUserDto, HttpServletRequest request) {
        // P2-2: 验证码强制校验，单次消费
        String inputCode = request.getParameter("code");
        String captchaId = request.getParameter("captchaId");
        String answer;
        if (StringUtils.isNotBlank(captchaId)) {
            answer = captchaStore.consume(captchaId);       // 新：Redis，取出即删
        } else {
            javax.servlet.http.HttpSession s = request.getSession(false);
            Object v = s == null ? null : s.getAttribute("captcha");
            if (s != null) {
                s.removeAttribute("captcha");
            }
            answer = v == null ? null : v.toString();       // 旧：session
        }
        if (answer == null || StringUtils.isBlank(inputCode)
                || !StringUtils.equalsIgnoreCase(inputCode.trim(), answer)) {
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
        // 拿不到 Cookie 的客户端（套壳 App）显式索要令牌；网页端不要，继续用 httpOnly Cookie
        if ("1".equals(request.getParameter("wantToken"))) {
            String token = tokenStore.issue(dreamUser.getUserId());
            // App 端一处：作废这个人上一个 App 令牌。**必须在签发之后**——
            // 指针要指向新令牌，先踢后签会把新令牌的指针写丢
            singleSession.enforceApp(dreamUser.getUserId(),
                    com.dream.basketball.config.TokenStore.hashOf(token));
            Map<String, Object> data = new HashMap<>();
            data.put("token", token);
            return new Result<>(0, "登录成功！", data);
        }
        // 网页端一处：给本次 session 打 principal 索引，踢掉这个人的其它网页会话
        singleSession.enforceWeb(request, dreamUser.getUserId());
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
        // 新用户默认不开放「数据分析(NBA 模块)」；新闻/百家说/私信不设(null=开放)。超管可在用户管理里放开。
        dreamUser.setFeatData("0");
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
        // 功能模块可用性（前端据此显隐导航菜单）。
        // NBA 与其余几项语义相反：**默认关**，超管逐个放行才是 true（见 config.Feature.NBA_DATA）
        data.put("featData", "1".equals(u.getFeatData()));
        data.put("featNews", !"0".equals(u.getFeatNews()));
        data.put("featForum", !"0".equals(u.getFeatForum()));
        data.put("featPm", !"0".equals(u.getFeatPm()));
        data.put("featSchedule", !"0".equals(u.getFeatSchedule()));
        // 耿阿姨烤串的店内角色（'manager'|'staff'|null）：店长见全部菜单，店员只见自己的台账
        com.dream.basketball.entity.BbqStaff bbq = bbqStaffMapper.selectById(u.getUserId());
        data.put("bbqRole", bbq == null ? null : bbq.getStaffRole());
        data.put("titles", u.getTitles()); // 头衔（逗号分隔）
        return new Result<>(0, "成功", data);
    }

    /** 登出 */
    @RequiresRole(Role.USER)
    @PostMapping("/loginOut")
    public Object loginOut(HttpServletRequest request) {
        // 令牌登录的客户端：登出必须把令牌真的作废掉。
        // 只清客户端存的那份是不够的——那串东西如果被抄走过，服务端这边还认它
        String tk = com.dream.basketball.config.TokenAuthFilter.extract(request);
        if (org.apache.commons.lang3.StringUtils.isNotBlank(tk)) {
            singleSession.clearApp(SecUtil.getLoginUserIdToSession(request),
                    com.dream.basketball.config.TokenStore.hashOf(tk));
        }
        tokenStore.revoke(tk);
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
            m.put("featData", "1".equals(u.getFeatData()));
            m.put("featNews", !"0".equals(u.getFeatNews()));
            m.put("featForum", !"0".equals(u.getFeatForum()));
            m.put("featPm", !"0".equals(u.getFeatPm()));
            m.put("featSchedule", !"0".equals(u.getFeatSchedule()));
            m.put("titles", u.getTitles());
            m.put("isSuperManager", Role.fromUserRole(u.getUserRole()) == Role.SUPER_MANAGER);
            rows.add(m);
        }
        return handlerSuccessPageJson(0, "成功", (int) info.getTotal(), rows);
    }

    /** 设置某用户的全局权限（超管）：登录/浏览/发言/发帖。不能改超管、不能改自己。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/setUserPerms")
    public Object setUserPerms(String userId, String enabled, String canBrowse, String canComment, String canPost,
                              String canCreateTopic, String topicLimit,
                              String featData, String featNews, String featForum, String featPm, String featSchedule,
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
        if (canCreateTopic != null) {
            uw.set("CAN_CREATE_TOPIC", "1".equals(canCreateTopic) ? "1" : "0");
        }
        // 专题配额：参数缺省=不动；传空串=清回系统默认（存 NULL）；传数字=按人设定，夹在 0-99
        if (topicLimit != null) {
            if (StringUtils.isBlank(topicLimit)) {
                uw.set("TOPIC_LIMIT", null);
            } else {
                try {
                    int n = Integer.parseInt(topicLimit.trim());
                    uw.set("TOPIC_LIMIT", Math.max(0, Math.min(99, n)));
                } catch (NumberFormatException ignore) {
                    return handlerResultJson(false, "专题上限必须是数字");
                }
            }
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
        if (featSchedule != null) {
            uw.set("FEAT_SCHEDULE", "1".equals(featSchedule) ? "1" : "0");
        }
        userService.update(uw);
        return handlerResultJson(true, "已保存");
    }

    /** 用户管理详情（超管）：一个用户的全部可管理项，供"点进用户"的详情页用。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @GetMapping("/adminDetail")
    public Object adminDetail(String userId) {
        DreamUser u = StringUtils.isBlank(userId) ? null : userService.getById(userId);
        if (u == null) {
            return new Result<>(1, "用户不存在", null);
        }
        Map<String, Object> m = new HashMap<>();
        m.put("userId", u.getUserId());
        m.put("userNickname", u.getUserNickname());
        m.put("userName", u.getUserName());
        m.put("loginName", u.getLoginName());
        m.put("avatar", u.getAvatar());
        m.put("userRole", u.getUserRole());
        m.put("isSuperManager", Role.fromUserRole(u.getUserRole()) == Role.SUPER_MANAGER);
        m.put("registTime", u.getRegistTime());
        m.put("lastLoginTime", u.getLastLoginTime());
        m.put("enabled", !Constants.DISABLE.equals(u.getUserStatus()));
        m.put("canBrowse", !"0".equals(u.getCanBrowse()));
        m.put("canComment", !"0".equals(u.getCanComment()));
        m.put("canPost", !"0".equals(u.getCanPost()));
        m.put("canCreateTopic", !"0".equals(u.getCanCreateTopic()));
        // 专题配额：topicLimit 为 null 表示跟随系统默认，前端据此显示占位而不是硬写一个数
        m.put("topicLimit", u.getTopicLimit());
        m.put("topicLimitDefault", Constants.DEFAULT_TOPIC_LIMIT);
        m.put("topicOwned", topicMapper.selectCount(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.dream.basketball.entity.ForumTopic>()
                        .eq("OWNER_ID", u.getUserId())));
        m.put("featData", "1".equals(u.getFeatData()));
        m.put("featNews", !"0".equals(u.getFeatNews()));
        m.put("featForum", !"0".equals(u.getFeatForum()));
        m.put("featPm", !"0".equals(u.getFeatPm()));
        m.put("featSchedule", !"0".equals(u.getFeatSchedule()));
        com.dream.basketball.entity.BbqStaff bbq = bbqStaffMapper.selectById(u.getUserId());
        m.put("bbqRole", bbq == null ? null : bbq.getStaffRole());
        m.put("titles", u.getTitles());
        return new Result<>(0, "成功", m);
    }

    /** 头衔颜色白名单（antd Tag 预设色）。非白名单一律兜底成 blue。 */
    private static final java.util.List<String> TITLE_COLORS = java.util.Arrays.asList(
            "red", "volcano", "orange", "gold", "yellow", "lime", "green", "teal", "cyan", "sky",
            "blue", "geekblue", "indigo", "purple", "magenta", "pink", "brown", "slate", "gray", "crimson");

    /**
     * 分配头衔（超管）：整表替换该用户的头衔集。入参 titles 是 JSON 数组 [{"t":"文字","c":"颜色"}]，可多个。
     * 逐项校验（文字非空且≤20、颜色须在白名单）、按文字去重、最多 10 个，再存规范 JSON。头衔是荣誉标签、非权限，可给任何人（含超管/自己）。
     */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/setUserTitles")
    public Object setUserTitles(String userId, String titles) {
        DreamUser target = StringUtils.isBlank(userId) ? null : userService.getById(userId);
        if (target == null) {
            return handlerResultJson(false, "用户不存在");
        }
        com.alibaba.fastjson.JSONArray out = new com.alibaba.fastjson.JSONArray();
        java.util.Set<String> seen = new java.util.HashSet<>();
        if (StringUtils.isNotBlank(titles)) {
            try {
                com.alibaba.fastjson.JSONArray arr = com.alibaba.fastjson.JSON.parseArray(titles);
                for (int i = 0; i < arr.size() && out.size() < 10; i++) {
                    com.alibaba.fastjson.JSONObject o = arr.getJSONObject(i);
                    if (o == null) {
                        continue;
                    }
                    String t = o.getString("t");
                    if (t == null || (t = t.trim()).isEmpty() || t.length() > 20 || !seen.add(t)) {
                        continue;
                    }
                    String c = o.getString("c");
                    if (c == null || !TITLE_COLORS.contains(c)) {
                        c = "blue"; // 非法颜色兜底
                    }
                    com.alibaba.fastjson.JSONObject e = new com.alibaba.fastjson.JSONObject();
                    e.put("t", t);
                    e.put("c", c);
                    out.add(e);
                }
            } catch (Exception ignore) {
                // 解析失败：当作清空
            }
        }
        String cleaned = out.isEmpty() ? null : out.toJSONString();
        userService.update(new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<DreamUser>()
                .eq("USER_ID", userId).set("TITLES", cleaned));
        return handlerResultJson(true, "已保存");
    }

    /**
     * 验证码（JSON 版）：{@code {captchaId, image}}，答案存 Redis 两分钟、用完即删。
     *
     * <p><b>为什么要新开一个而不是改老的</b>：老的 {@code /user/captcha} 直接把 gif 字节流
     * 写进响应，前端拿 {@code <img src>} 加载——而 {@code <img>} 标签发不出
     * {@code Authorization} 头，也读不到响应体里的 {@code captchaId}。
     * 要把 id 交给前端，就只能改成 JSON + 图片内嵌成 data URI。
     *
     * <p>图片 base64 之后体积涨约 33%（一张 130×48 的 gif 大概 2KB → 2.7KB），
     * 换来的是少一次请求、且不依赖 Cookie。这个交换在登录页上非常划算。
     *
     * <p>老接口保留：老前端缓存还在的人照样能登录，新路真出问题也能只回滚前端。
     */
    @GetMapping("/captchaJson")
    public Object captchaJson() throws Exception {   // setFont 会抛 FontFormatException，和老接口同样处理
        SpecCaptcha specCaptcha = new SpecCaptcha(130, 48, 4);
        specCaptcha.setFont(Captcha.FONT_1);
        specCaptcha.setCharType(Captcha.TYPE_ONLY_NUMBER);
        java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
        specCaptcha.out(buf);
        Map<String, Object> data = new HashMap<>();
        data.put("captchaId", captchaStore.save(specCaptcha.text().toLowerCase()));
        data.put("image", "data:image/gif;base64,"
                + java.util.Base64.getEncoder().encodeToString(buf.toByteArray()));
        return new Result<>(0, "成功", data);
    }

    /** 验证码图片（旧版，答案存 session）。新前端走 /captchaJson，这个留给老缓存兜底 */
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
