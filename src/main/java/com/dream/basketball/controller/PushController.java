package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.PushSubscription;
import com.dream.basketball.mapper.PushSubscriptionMapper;
import com.dream.basketball.service.WebPushSender;
import com.dream.basketball.common.Result;
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
import java.util.UUID;

/**
 * Web Push 的订阅管理。
 *
 * 流程：前端先取 publicKey，用它调 pushManager.subscribe() 拿到 {endpoint, p256dh, auth}，
 * 再 POST 到 /push/subscribe 存下来。之后有消息时后端就能加密投递到那个 endpoint。
 */
@RestController
@RequestMapping("/push")
public class PushController {

    @Autowired
    private WebPushSender sender;

    @Autowired
    private PushSubscriptionMapper subMapper;

    /**
     * 前端 subscribe() 需要的 applicationServerKey（VAPID 公钥）。
     *
     * 公开接口：它按定义就是公开的，浏览器拿它去跟推送服务登记"只接受这把私钥签名的推送"。
     * 服务端没配密钥时返回空串，前端据此把开关整个藏起来，而不是让人点了报错。
     */
    @GetMapping("/publicKey")
    public Object publicKey() {
        return new Result<>(0, "成功", sender.applicationServerKey());
    }

    /** 我这台设备是否已经订阅过（前端用来决定开关的初始状态）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/status")
    public Object status(String endpoint, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        Map<String, Object> out = new HashMap<>();
        out.put("enabled", StringUtils.isNotBlank(sender.applicationServerKey()));
        out.put("subscribed", StringUtils.isNotBlank(endpoint) && subMapper.selectCount(
                new QueryWrapper<PushSubscription>()
                        .eq("USER_ID", me.getUserId()).eq("ENDPOINT", endpoint)) > 0);
        return new Result<>(0, "成功", out);
    }

    /**
     * 登记一台设备。
     *
     * 按 endpoint 覆盖而不是新增：同一台设备重新授权、或者浏览器自己轮换了 endpoint 之后
     * 再订阅，堆两条只会让每条消息推两遍。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/subscribe")
    public Object subscribe(String endpoint, String p256dh, String auth, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (StringUtils.isAnyBlank(endpoint, p256dh, auth)) {
            return new Result<>(1, "订阅信息不完整", null);
        }
        subMapper.delete(new QueryWrapper<PushSubscription>().eq("ENDPOINT", endpoint));
        PushSubscription s = new PushSubscription();
        s.setSubId(UUID.randomUUID().toString());
        s.setUserId(me.getUserId());
        s.setEndpoint(endpoint);
        s.setP256dh(p256dh);
        s.setAuth(auth);
        // 只为排查用：一个人有好几台设备时，光看 endpoint 认不出是哪台
        s.setUserAgent(StringUtils.substring(request.getHeader("User-Agent"), 0, 300));
        s.setCreateTime(new Date());
        subMapper.insert(s);
        return new Result<>(0, "已开启推送", null);
    }

    /**
     * 注销一台设备。
     *
     * 按 endpoint 删而不是按人删：关掉手机上的推送不该把桌面浏览器的也关了。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/unsubscribe")
    public Object unsubscribe(String endpoint, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (StringUtils.isBlank(endpoint)) {
            return new Result<>(1, "缺少 endpoint", null);
        }
        subMapper.delete(new QueryWrapper<PushSubscription>()
                .eq("USER_ID", me.getUserId()).eq("ENDPOINT", endpoint));
        return new Result<>(0, "已关闭推送", null);
    }

    /**
     * 给自己发一条测试推送。
     *
     * 通知链路很长（权限 → 订阅 → 加密 → 推送服务 → service worker → 系统通知），
     * 中间任何一环断了，表现都是"没反应"。有个能主动触发的入口，排查时能立刻分清
     * 是发不出去还是收不到。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/test")
    public Object test(HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        long devices = subMapper.selectCount(
                new QueryWrapper<PushSubscription>().eq("USER_ID", me.getUserId()));
        int ok = sender.sendTest(me.getUserId());
        // 报**成功数**而不是设备数。第一版报的是设备数，于是两台设备全都发失败时
        // 界面照样弹「已发往 2 台设备」，把唯一的线索盖掉了，只能去翻服务器日志
        if (devices == 0) {
            return new Result<>(1, "这个账号还没有已登记的设备", 0);
        }
        if (ok == 0) {
            return new Result<>(1, devices + " 台设备全部发送失败，去看服务器日志", 0);
        }
        return new Result<>(0, "已送达 " + ok + "/" + devices + " 台设备", ok);
    }
}
