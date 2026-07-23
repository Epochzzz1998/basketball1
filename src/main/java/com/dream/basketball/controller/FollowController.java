package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.UserFollow;
import com.dream.basketball.mapper.UserFollowMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.service.UserInformationService;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.*;

/**
 * Follow/fans. toggle = follow/unfollow (one edge per pair, unique key backed); status feeds
 * the profile header; list returns following/followers with the viewer's own follow state so
 * the modal can show 互关 badges. Following someone notifies them (msgType=follow).
 */
@RestController
@RequestMapping("/follow")
public class FollowController {

    private static final int LIST_CAP = 500; // 个人站量级：列表一次取满，前端不分页

    @Autowired
    private UserFollowMapper followMapper;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private UserInformationService userInformationService;
    @Autowired
    private com.dream.basketball.mapper.UserBlockMapper blockMapper;

    private boolean edgeExists(String followerId, String followeeId) {
        return followMapper.selectCount(new QueryWrapper<UserFollow>()
                .eq("FOLLOWER_ID", followerId).eq("FOLLOWEE_ID", followeeId)) > 0;
    }

    /** 关注/取关（登录）：已关→取关，未关→关注并通知对方。返回最新状态+对方粉丝数。 */
    @RequiresRole(Role.USER)
    @PostMapping("/toggle")
    public Object toggle(String userId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        DreamUser target = StringUtils.isBlank(userId) ? null : userMapper.selectById(userId);
        if (target == null) {
            return new Result<>(1, "用户不存在", null);
        }
        if (StringUtils.equals(me.getUserId(), userId)) {
            return new Result<>(1, "不能关注自己", null);
        }
        // 拉黑关系下不允许建立关注（任一方向）
        if (blockMapper.selectCount(new QueryWrapper<com.dream.basketball.entity.UserBlock>()
                .eq("USER_ID", userId).eq("BLOCKED_ID", me.getUserId())) > 0
                || blockMapper.selectCount(new QueryWrapper<com.dream.basketball.entity.UserBlock>()
                        .eq("USER_ID", me.getUserId()).eq("BLOCKED_ID", userId)) > 0) {
            if (!edgeExists(me.getUserId(), userId)) {
                return new Result<>(1, "当前无法关注该用户", null);
            }
        }
        boolean following;
        if (edgeExists(me.getUserId(), userId)) {
            followMapper.delete(new QueryWrapper<UserFollow>()
                    .eq("FOLLOWER_ID", me.getUserId()).eq("FOLLOWEE_ID", userId));
            following = false;
        } else {
            UserFollow f = new UserFollow();
            f.setId(UUID.randomUUID().toString());
            f.setFollowerId(me.getUserId());
            f.setFolloweeId(userId);
            f.setCreateTime(new Date());
            followMapper.insert(f);
            following = true;
            // 站内通知：msgId=关注者 id，消息页点击跳其主页
            userInformationService.saveUserInformation(me.getUserId(), me.getUserNickname(), userId,
                    Constants.FOLLOW, me.getUserId(), "", "", "", "", "");
        }
        Map<String, Object> out = new HashMap<>();
        out.put("following", following);
        out.put("followerCount", followMapper.selectCount(new QueryWrapper<UserFollow>().eq("FOLLOWEE_ID", userId)));
        return new Result<>(0, following ? "已关注" : "已取消关注", out);
    }

    /** 某用户的关注/粉丝计数 + 我与 TA 的关系（公开，登录可选）。 */
    @GetMapping("/status")
    public Object status(String userId, HttpServletRequest request) {
        if (StringUtils.isBlank(userId)) {
            return new Result<>(1, "参数缺失", null);
        }
        DreamUser viewer = SecUtil.getLoginUserToSession(request);
        Map<String, Object> out = new HashMap<>();
        out.put("followerCount", followMapper.selectCount(new QueryWrapper<UserFollow>().eq("FOLLOWEE_ID", userId)));
        out.put("followingCount", followMapper.selectCount(new QueryWrapper<UserFollow>().eq("FOLLOWER_ID", userId)));
        out.put("following", viewer != null && edgeExists(viewer.getUserId(), userId));
        out.put("followedBy", viewer != null && edgeExists(userId, viewer.getUserId()));
        return new Result<>(0, "成功", out);
    }

    /** 关注列表/粉丝列表（公开）：type=following|followers；行带昵称/头像/互关/我是否已关注。 */
    @GetMapping("/list")
    public Object list(String userId, String type, HttpServletRequest request) {
        if (StringUtils.isBlank(userId)) {
            return new Result<>(1, "参数缺失", null);
        }
        boolean followers = "followers".equals(type);
        List<UserFollow> edges = followMapper.selectList(new QueryWrapper<UserFollow>()
                .eq(followers ? "FOLLOWEE_ID" : "FOLLOWER_ID", userId)
                .orderByDesc("CREATE_TIME").last("LIMIT " + LIST_CAP));
        List<String> ids = new ArrayList<>();
        for (UserFollow e : edges) {
            ids.add(followers ? e.getFollowerId() : e.getFolloweeId());
        }
        if (ids.isEmpty()) {
            return new Result<>(0, "成功", new ArrayList<>());
        }
        // 名单用户 + 反向边（算互关）+ 观察者的关注集合，各一把查询
        Map<String, DreamUser> users = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>().in("USER_ID", ids))) {
            users.put(u.getUserId(), u);
        }
        Set<String> reverse = new HashSet<>(); // 对方也关注了 userId（互关判定的另一半）
        for (UserFollow e : followMapper.selectList(new QueryWrapper<UserFollow>()
                .eq(followers ? "FOLLOWER_ID" : "FOLLOWEE_ID", userId)
                .in(followers ? "FOLLOWEE_ID" : "FOLLOWER_ID", ids))) {
            reverse.add(followers ? e.getFolloweeId() : e.getFollowerId());
        }
        DreamUser viewer = SecUtil.getLoginUserToSession(request);
        Set<String> myFollowing = new HashSet<>();
        if (viewer != null) {
            for (UserFollow e : followMapper.selectList(new QueryWrapper<UserFollow>()
                    .eq("FOLLOWER_ID", viewer.getUserId()).in("FOLLOWEE_ID", ids))) {
                myFollowing.add(e.getFolloweeId());
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (String id : ids) {
            DreamUser u = users.get(id);
            if (u == null) {
                continue;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("userId", id);
            row.put("userNickname", u.getUserNickname());
            row.put("avatar", u.getAvatar());
            row.put("mutual", reverse.contains(id));
            row.put("followingByMe", viewer != null && myFollowing.contains(id));
            out.add(row);
        }
        return new Result<>(0, "成功", out);
    }
}
