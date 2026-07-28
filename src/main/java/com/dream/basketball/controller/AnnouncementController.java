package com.dream.basketball.controller;

import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.SiteAnnouncement;
import com.dream.basketball.mapper.SiteAnnouncementMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * 全站滚动公告：超管写，所有人（含游客）读。
 *
 * 读接口**公开**——公告本来就是给所有人看的，登录与否都该看到。
 * 关闭状态存在浏览器 localStorage 里，按 version 记，不占后端存储也不用登录。
 */
@RestController
@RequestMapping("/announce")
public class AnnouncementController {

    private static final int MAX_LEN = 500;

    @Autowired
    private SiteAnnouncementMapper mapper;

    /** 当前公告。没开或者内容为空时返回 null，前端据此整条不渲染。 */
    @GetMapping("/current")
    public Object current() {
        SiteAnnouncement a = mapper.selectById(SiteAnnouncement.ONLY_ID);
        if (a == null || !"1".equals(a.getEnabled()) || StringUtils.isBlank(a.getContent())) {
            return new Result<>(0, "成功", null);
        }
        return new Result<>(0, "成功", view(a));
    }

    /** 超管查看当前配置（含关闭状态和原文），用于编辑弹窗回填。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @GetMapping("/get")
    public Object get() {
        SiteAnnouncement a = mapper.selectById(SiteAnnouncement.ONLY_ID);
        return new Result<>(0, "成功", a == null ? null : view(a));
    }

    /** 保存（超管）。改了内容或开关，UPDATE_TIME 就变，等于换了一版，关过的人会重新看到。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @PostMapping("/save")
    public Object save(String content, String enabled, String level, HttpServletRequest request) {
        String text = StringUtils.trimToEmpty(content);
        if (text.length() > MAX_LEN) {
            return new Result<>(1, "公告最多 " + MAX_LEN + " 个字", null);
        }
        boolean on = "1".equals(enabled);
        if (on && text.isEmpty()) {
            return new Result<>(1, "公告内容不能为空", null);
        }
        DreamUser me = SecUtil.getLoginUserToSession(request);
        SiteAnnouncement a = mapper.selectById(SiteAnnouncement.ONLY_ID);
        boolean insert = a == null;
        if (insert) {
            a = new SiteAnnouncement();
            a.setId(SiteAnnouncement.ONLY_ID);
        }
        a.setContent(text);
        a.setEnabled(on ? "1" : "0");
        a.setLevel(StringUtils.defaultIfBlank(level, "info"));
        a.setUpdateTime(new Date());
        a.setUpdateBy(me == null ? null : me.getUserId());
        if (insert) {
            mapper.insert(a);
        } else {
            mapper.updateById(a);
        }
        return new Result<>(0, "已保存", view(a));
    }

    private Map<String, Object> view(SiteAnnouncement a) {
        Map<String, Object> m = new HashMap<>();
        m.put("content", a.getContent());
        m.put("enabled", "1".equals(a.getEnabled()));
        m.put("level", a.getLevel());
        // version 就是修改时间戳：前端拿它当"我关掉的是哪一版"的键
        m.put("version", a.getUpdateTime() == null ? 0 : a.getUpdateTime().getTime());
        return m;
    }
}
