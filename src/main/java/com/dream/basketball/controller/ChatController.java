package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.config.TopicPermissionService;
import com.dream.basketball.config.WebSocketConfig;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.entity.ForumTopic;
import com.dream.basketball.entity.TopicChatMessage;
import com.dream.basketball.mapper.TopicChatMessageMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.SecUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 专题群聊。
 *
 * 沿用私信那套「socket 只推不收」的分工：发消息走这里的 REST，权限校验、长度限制、
 * 限流都留在熟悉的 HTTP 层；WebSocket 只负责把服务端认可的消息广播出去
 * （目的地 /room/{topicId}，谁能订阅由 WebSocketConfig 的拦截器把关）。
 *
 * 这样做的好处是：想加敏感词、加封禁、加审计，都只改这个类，不用碰消息通道。
 */
@RestController
@RequestMapping("/chat")
public class ChatController {

    /** 单条消息长度上限，和表里 CONTENT 的 varchar(500) 对齐 */
    private static final int MAX_LEN = 500;
    /** 一次最多拉多少条历史 */
    private static final int MAX_PAGE = 50;
    /** 同一个人两条消息之间的最小间隔（毫秒），挡住手抖和脚本刷屏 */
    private static final long SEND_INTERVAL_MS = 500;

    private final Map<String, Long> lastSendAt = new ConcurrentHashMap<>();

    @Autowired
    private TopicChatMessageMapper chatMapper;
    @Autowired
    private TopicPermissionService perms;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private SimpMessagingTemplate broker;

    /**
     * 拉历史：默认给最近 30 条，往上翻传 before（上一屏最早那条的时间戳，毫秒）。
     * 库里按时间倒序取，返回前翻正，前端拿到就是从旧到新可以直接铺。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/history")
    public Object history(String topicId, Long before, Integer limit, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canChat(me, t)) {
            return new Result<>(1, "你不能进入该专题的群聊", null);
        }
        int size = limit == null || limit <= 0 || limit > MAX_PAGE ? 30 : limit;
        QueryWrapper<TopicChatMessage> qw = new QueryWrapper<TopicChatMessage>()
                .eq("TOPIC_ID", topicId)
                .orderByDesc("SEND_TIME").orderByDesc("MSG_ID")
                .last("limit " + size);
        if (before != null && before > 0) {
            qw.lt("SEND_TIME", new Date(before));
        }
        List<TopicChatMessage> rows = chatMapper.selectList(qw);
        Collections.reverse(rows); // 倒序取、正序还
        return new Result<>(0, "成功", withSenders(rows));
    }

    /** 发一条：校验 → 落库 → 广播给房间里的人。发送者自己也是通过广播收到的，不做本地回显。 */
    @RequiresRole(Role.USER)
    @PostMapping("/send")
    public Object send(String topicId, String content, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canChat(me, t)) {
            return new Result<>(1, "你在该专题的群聊里不能发言", null);
        }
        String text = StringUtils.trimToEmpty(content);
        if (text.isEmpty()) {
            return new Result<>(1, "说点什么吧", null);
        }
        if (text.length() > MAX_LEN) {
            return new Result<>(1, "一条最多 " + MAX_LEN + " 个字", null);
        }
        long now = System.currentTimeMillis();
        Long last = lastSendAt.get(me.getUserId());
        if (last != null && now - last < SEND_INTERVAL_MS) {
            return new Result<>(1, "发得太快了，慢一点", null);
        }
        lastSendAt.put(me.getUserId(), now);

        TopicChatMessage msg = new TopicChatMessage();
        msg.setMsgId(UUID.randomUUID().toString());
        msg.setTopicId(topicId);
        msg.setSenderId(me.getUserId());
        msg.setContent(text);
        msg.setSendTime(new Date(now));
        chatMapper.insert(msg);

        Map<String, Object> view = withSenders(Collections.singletonList(msg)).get(0);
        broker.convertAndSend(WebSocketConfig.ROOM_PREFIX + topicId, view);
        return new Result<>(0, "成功", view);
    }

    /** 给消息补上发送者的昵称和头像（一次 IN 查完，不在循环里查库）。 */
    private List<Map<String, Object>> withSenders(List<TopicChatMessage> rows) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (rows.isEmpty()) {
            return out;
        }
        java.util.Set<String> ids = new java.util.HashSet<>();
        for (TopicChatMessage m : rows) {
            ids.add(m.getSenderId());
        }
        Map<String, DreamUser> users = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>().in("USER_ID", ids))) {
            users.put(u.getUserId(), u);
        }
        for (TopicChatMessage m : rows) {
            DreamUser u = users.get(m.getSenderId());
            Map<String, Object> v = new HashMap<>();
            v.put("msgId", m.getMsgId());
            v.put("topicId", m.getTopicId());
            v.put("senderId", m.getSenderId());
            v.put("senderName", u == null ? null : u.getUserNickname());
            v.put("senderAvatar", u == null ? null : u.getAvatar());
            v.put("content", m.getContent());
            v.put("sendTime", m.getSendTime() == null ? null : m.getSendTime().getTime());
            out.add(v);
        }
        return out;
    }
}
