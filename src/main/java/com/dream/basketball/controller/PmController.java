package com.dream.basketball.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.dream.basketball.common.Result;
import com.dream.basketball.config.RequiresRole;
import com.dream.basketball.config.Role;
import com.dream.basketball.entity.DreamPrivateMessage;
import com.dream.basketball.entity.DreamUser;
import com.dream.basketball.mapper.PrivateMessageMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.BaseUtils;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.SecUtil;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Private messages (P5, login required). Writes are REST; delivery is pushed over
 * STOMP to "/user/queue/pm" (see WebSocketConfig) so both sides update in real time.
 * Payload shape: {type: 'message'|'recall', data: ...} — the frontend switches on type.
 */
@RestController
@RequestMapping("/pm")
public class PmController extends BaseUtils {

    /** recall window: only own messages sent within the last 2 minutes */
    private static final long RECALL_WINDOW_MS = 2 * 60 * 1000L;

    private static final String FLAG_ON = "1";
    private static final String FLAG_OFF = "0";

    @Autowired
    private PrivateMessageMapper privateMessageMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private com.dream.basketball.config.PresenceService presenceService;

    /** push one event to a user's personal queue (no-op for offline users; they catch up via REST) */
    private void push(String userId, String type, Object data) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("data", data);
        messagingTemplate.convertAndSendToUser(userId, "/queue/pm", payload);
    }

    /** 发私信：校验后落库，然后把消息推给对方（和自己的其他标签页） */
    @RequiresRole(Role.USER)
    @PostMapping("/send")
    public Object send(String receiverId, String content, HttpServletRequest request) {
        String me = SecUtil.getLoginUserIdToSession(request);
        content = StringUtils.trim(content);
        if (StringUtils.isBlank(receiverId) || StringUtils.isBlank(content)) {
            return new Result<>(1, "内容不能为空", null);
        }
        if (content.length() > 500) {
            return new Result<>(1, "单条私信最多 500 字", null);
        }
        if (StringUtils.equals(me, receiverId)) {
            return new Result<>(1, "不能给自己发私信", null);
        }
        DreamUser peer = userMapper.selectById(receiverId);
        if (peer == null) {
            return new Result<>(1, "用户不存在", null);
        }

        DreamPrivateMessage msg = new DreamPrivateMessage();
        msg.setPmId(UUID.randomUUID().toString());
        msg.setSenderId(me);
        msg.setReceiverId(receiverId);
        msg.setContent(content);
        msg.setSendTime(new Date());
        msg.setWhetherRead(Constants.TO_READ);
        msg.setRecalled(FLAG_OFF);
        msg.setSenderDeleted(FLAG_OFF);
        msg.setReceiverDeleted(FLAG_OFF);
        privateMessageMapper.insert(msg);

        push(receiverId, "message", msg);
        push(me, "message", msg);
        return new Result<>(0, "发送成功", msg);
    }

    /** 会话列表：每个对话最后一条 + 未读数（SQL 里窗口函数推导） */
    @RequiresRole(Role.USER)
    @GetMapping("/conversations")
    public Object conversations(HttpServletRequest request) {
        return new Result<>(0, "成功", privateMessageMapper.findConversations(SecUtil.getLoginUserIdToSession(request)));
    }

    /** 与某人的消息记录，倒序分页；已撤回的消息不下发原文 */
    @RequiresRole(Role.USER)
    @GetMapping("/history")
    public Object history(String peerId, Integer page, Integer limit, HttpServletRequest request) {
        if (StringUtils.isBlank(peerId)) {
            return new Result<>(1, "缺少对方用户", null);
        }
        String me = SecUtil.getLoginUserIdToSession(request);
        PageHelper.startPage(page == null ? 1 : page, limit == null ? 30 : limit);
        List<DreamPrivateMessage> rows = privateMessageMapper.findHistory(me, peerId);
        for (DreamPrivateMessage m : rows) {
            if (FLAG_ON.equals(m.getRecalled())) {
                m.setContent("");
            }
        }
        return handlerSuccessPageJson(0, "成功", (int) new PageInfo<>(rows).getTotal(), rows);
    }

    /** 打开会话：把对方发我的未读全部标已读 */
    @RequiresRole(Role.USER)
    @PostMapping("/read")
    public Object read(String peerId, HttpServletRequest request) {
        if (StringUtils.isBlank(peerId)) {
            return new Result<>(1, "缺少对方用户", null);
        }
        privateMessageMapper.update(null, new UpdateWrapper<DreamPrivateMessage>()
                .eq("SENDER_ID", peerId)
                .eq("RECEIVER_ID", SecUtil.getLoginUserIdToSession(request))
                .eq("WHETHER_READ", Constants.TO_READ)
                .set("WHETHER_READ", Constants.READ));
        return new Result<>(0, "成功", null);
    }

    /** 撤回：只能撤自己 2 分钟内且未撤回过的消息；顺带标已读避免幽灵未读数 */
    @RequiresRole(Role.USER)
    @PostMapping("/recall")
    public Object recall(String pmId, HttpServletRequest request) {
        String me = SecUtil.getLoginUserIdToSession(request);
        DreamPrivateMessage msg = StringUtils.isBlank(pmId) ? null : privateMessageMapper.selectById(pmId);
        if (msg == null || !StringUtils.equals(msg.getSenderId(), me)) {
            return new Result<>(1, "只能撤回自己的消息", null);
        }
        if (FLAG_ON.equals(msg.getRecalled())) {
            return new Result<>(1, "该消息已撤回", null);
        }
        if (msg.getSendTime() == null || System.currentTimeMillis() - msg.getSendTime().getTime() > RECALL_WINDOW_MS) {
            return new Result<>(1, "只能撤回 2 分钟内发出的消息", null);
        }
        privateMessageMapper.update(null, new UpdateWrapper<DreamPrivateMessage>()
                .eq("PM_ID", msg.getPmId())
                .set("RECALLED", FLAG_ON)
                .set("WHETHER_READ", Constants.READ));

        Map<String, Object> data = new HashMap<>();
        data.put("pmId", msg.getPmId());
        data.put("senderId", msg.getSenderId());
        data.put("receiverId", msg.getReceiverId());
        push(msg.getReceiverId(), "recall", data);
        push(me, "recall", data);
        return new Result<>(0, "已撤回", null);
    }

    /** 删除会话（单侧隐藏）：只动自己这一侧的可见性，对方不受影响；顺带清掉该会话的未读 */
    @RequiresRole(Role.USER)
    @PostMapping("/deleteConversation")
    public Object deleteConversation(String peerId, HttpServletRequest request) {
        if (StringUtils.isBlank(peerId)) {
            return new Result<>(1, "缺少对方用户", null);
        }
        String me = SecUtil.getLoginUserIdToSession(request);
        privateMessageMapper.update(null, new UpdateWrapper<DreamPrivateMessage>()
                .eq("SENDER_ID", me)
                .eq("RECEIVER_ID", peerId)
                .set("SENDER_DELETED", FLAG_ON));
        privateMessageMapper.update(null, new UpdateWrapper<DreamPrivateMessage>()
                .eq("SENDER_ID", peerId)
                .eq("RECEIVER_ID", me)
                .set("RECEIVER_DELETED", FLAG_ON)
                .set("WHETHER_READ", Constants.READ));
        return new Result<>(0, "会话已删除", null);
    }

    /** 在线状态：传逗号分隔的 userIds，返回 {userId: 是否在线}。前端进会话/轮询时查对方是否在线。 */
    @RequiresRole(Role.USER)
    @GetMapping("/presence")
    public Object presence(String userIds) {
        Map<String, Boolean> map = new HashMap<>();
        if (StringUtils.isNotBlank(userIds)) {
            for (String id : userIds.split(",")) {
                String uid = id.trim();
                if (!uid.isEmpty()) {
                    map.put(uid, presenceService.isOnline(uid));
                }
            }
        }
        return new Result<>(0, "成功", map);
    }

    /** 私信总未读（顶栏角标）：撤回的和已删会话里的不算 */
    @RequiresRole(Role.USER)
    @GetMapping("/unreadCount")
    public Object unreadCount(HttpServletRequest request) {
        Integer n = privateMessageMapper.selectCount(new QueryWrapper<DreamPrivateMessage>()
                .eq("RECEIVER_ID", SecUtil.getLoginUserIdToSession(request))
                .eq("WHETHER_READ", Constants.TO_READ)
                .eq("RECALLED", FLAG_OFF)
                .eq("RECEIVER_DELETED", FLAG_OFF));
        return new Result<>(0, "成功", n == null ? 0 : n);
    }
}
