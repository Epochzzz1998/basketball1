package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserRemark;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.mapper.UserRemarkMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Per-viewer user remarks (备注), WeChat-style: any user can alias any other user; only the
 * owner ever sees their remarks. Display substitution happens client-side off the /mine map;
 * the profile page keeps showing the real nickname alongside.
 */
@RestController
@RequestMapping("/remark")
public class RemarkController {

    private static final int REMARK_MAX = 20;

    @Autowired
    private UserRemarkMapper remarkMapper;
    @Autowired
    private UserMapper userMapper;

    /** 设置/修改/清除备注：remark 传空 = 删除。只能备注别人。 */
    @RequiresRole(Role.USER)
    @PostMapping("/set")
    public Object set(String targetId, String remark, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (StringUtils.isBlank(targetId) || userMapper.selectById(targetId) == null) {
            return new Result<>(1, "用户不存在", null);
        }
        if (StringUtils.equals(targetId, me.getUserId())) {
            return new Result<>(1, "不能给自己设置备注", null);
        }
        String r = StringUtils.trimToNull(remark);
        QueryWrapper<UserRemark> qw = new QueryWrapper<UserRemark>()
                .eq("OWNER_ID", me.getUserId()).eq("TARGET_ID", targetId);
        if (r == null) {
            remarkMapper.delete(qw);
            return new Result<>(0, "已清除备注", null);
        }
        if (r.length() > REMARK_MAX) {
            return new Result<>(1, "备注不能超过 " + REMARK_MAX + " 字", null);
        }
        UserRemark row = remarkMapper.selectList(qw).stream().findFirst().orElse(null);
        if (row == null) {
            row = new UserRemark();
            row.setId(UUID.randomUUID().toString());
            row.setOwnerId(me.getUserId());
            row.setTargetId(targetId);
            row.setRemark(r);
            row.setCreateTime(new Date());
            remarkMapper.insert(row);
        } else {
            row.setRemark(r);
            remarkMapper.updateById(row);
        }
        return new Result<>(0, "已备注", r);
    }

    /** 我的全部备注（前端启动时拉一次做显示替换的映射表）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/mine")
    public Object mine(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        List<Map<String, Object>> out = new ArrayList<>();
        for (UserRemark r : remarkMapper.selectList(new QueryWrapper<UserRemark>()
                .eq("OWNER_ID", me.getUserId()).last("limit 500"))) {
            Map<String, Object> m = new HashMap<>();
            m.put("targetId", r.getTargetId());
            m.put("remark", r.getRemark());
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }
}
