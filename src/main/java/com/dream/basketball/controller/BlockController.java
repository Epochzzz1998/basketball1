package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserBlock;
import com.dream.basketball.entity.UserFollow;
import com.dream.basketball.mapper.UserBlockMapper;
import com.dream.basketball.mapper.UserFollowMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Blocklist. Scope: a blocked user cannot DM or follow the blocker (history stays readable);
 * posts/comments remain mutually visible. Blocking removes follow edges in both directions.
 */
@RestController
@RequestMapping("/block")
public class BlockController {

    @Autowired
    private UserBlockMapper blockMapper;
    @Autowired
    private UserFollowMapper followMapper;
    @Autowired
    private UserMapper userMapper;

    /** 拉黑/解除（登录）：拉黑时顺带解除双向关注。返回最新 blocked 状态。 */
    @RequiresRole(Role.USER)
    @PostMapping("/toggle")
    public Object toggle(String userId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (StringUtils.isBlank(userId) || userMapper.selectById(userId) == null) {
            return new Result<>(1, "用户不存在", null);
        }
        if (StringUtils.equals(me.getUserId(), userId)) {
            return new Result<>(1, "不能拉黑自己", null);
        }
        QueryWrapper<UserBlock> mineQ = new QueryWrapper<UserBlock>()
                .eq("USER_ID", me.getUserId()).eq("BLOCKED_ID", userId);
        boolean blocked;
        if (blockMapper.selectCount(mineQ) > 0) {
            blockMapper.delete(mineQ);
            blocked = false;
        } else {
            UserBlock b = new UserBlock();
            b.setId(UUID.randomUUID().toString());
            b.setUserId(me.getUserId());
            b.setBlockedId(userId);
            b.setCreateTime(new Date());
            blockMapper.insert(b);
            blocked = true;
            // 拉黑即解除双向关注（对方也无法再关注你，见 FollowController 拦截）
            followMapper.delete(new QueryWrapper<UserFollow>()
                    .eq("FOLLOWER_ID", me.getUserId()).eq("FOLLOWEE_ID", userId));
            followMapper.delete(new QueryWrapper<UserFollow>()
                    .eq("FOLLOWER_ID", userId).eq("FOLLOWEE_ID", me.getUserId()));
        }
        Map<String, Object> out = new HashMap<>();
        out.put("blocked", blocked);
        return new Result<>(0, blocked ? "已拉黑" : "已解除拉黑", out);
    }

    /** 我的黑名单（仅本人）：昵称/头像/拉黑时间。 */
    @RequiresRole(Role.USER)
    @GetMapping("/list")
    public Object list(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        List<UserBlock> rows = blockMapper.selectList(new QueryWrapper<UserBlock>()
                .eq("USER_ID", me.getUserId()).orderByDesc("CREATE_TIME"));
        if (rows.isEmpty()) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        List<String> ids = new ArrayList<>();
        for (UserBlock b : rows) {
            ids.add(b.getBlockedId());
        }
        Map<String, DreamUser> users = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>().in("USER_ID", ids))) {
            users.put(u.getUserId(), u);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (UserBlock b : rows) {
            DreamUser u = users.get(b.getBlockedId());
            Map<String, Object> row = new HashMap<>();
            row.put("userId", b.getBlockedId());
            row.put("userNickname", u == null ? b.getBlockedId() : u.getUserNickname());
            row.put("avatar", u == null ? null : u.getAvatar());
            row.put("blockTime", b.getCreateTime());
            out.add(row);
        }
        return new Result<>(0, "成功", out);
    }
}
