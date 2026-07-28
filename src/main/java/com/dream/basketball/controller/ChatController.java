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
import com.dream.basketball.entity.TopicChatRead;
import com.dream.basketball.mapper.TopicChatMessageMapper;
import com.dream.basketball.mapper.TopicChatReadMapper;
import com.dream.basketball.mapper.UserMapper;
import com.dream.basketball.utils.Constants;
import com.dream.basketball.utils.FileUtils;
import com.dream.basketball.utils.MentionUtil;
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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 专题群聊。
 *
 * 沿用私信那套「socket 只推不收」的分工：发消息走这里的 REST，权限校验、长度限制、
 * 限流都留在熟悉的 HTTP 层；WebSocket 只负责把服务端认可的事件广播出去
 * （目的地 /room/{topicId}，谁能订阅由 WebSocketConfig 的拦截器把关）。
 *
 * 广播帧统一是 {type, data}：type = 'message' | 'recall'，和私信那条通道一个形状。
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
    /** 自己撤回自己的消息的时限；超过这个时间只有管理者能撤 */
    private static final long RECALL_WINDOW_MS = 2 * 60 * 1000L;

    private final Map<String, Long> lastSendAt = new ConcurrentHashMap<>();

    /** 上传根目录，导出要按 URL 找回原文件、清理要把文件一起删 */
    @org.springframework.beans.factory.annotation.Value("${picPath.uploadPath:}")
    private String uploadPath;

    @Autowired
    private TopicChatMessageMapper chatMapper;
    @Autowired
    private TopicChatReadMapper readMapper;
    @Autowired
    private TopicPermissionService perms;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private SimpMessagingTemplate broker;
    @Autowired
    private com.dream.basketball.service.UserInformationService userInformationService;

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

    /** 发一条：校验 → 落库 → 广播。自己也是从广播里收到的，前端不做本地回显。 */
    @RequiresRole(Role.USER)
    @PostMapping("/send")
    public Object send(String topicId, String content, String imageUrl,
                       String fileUrl, String fileName, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canChat(me, t)) {
            return new Result<>(1, "你在该专题的群聊里不能发言", null);
        }
        String text = StringUtils.trimToEmpty(content);
        String img = StringUtils.trimToEmpty(imageUrl);
        String file = StringUtils.trimToEmpty(fileUrl);
        if (text.isEmpty() && img.isEmpty() && file.isEmpty()) {
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
        msg.setImageUrl(img.isEmpty() ? null : img);
        msg.setFileUrl(file.isEmpty() ? null : file);
        msg.setFileName(file.isEmpty() ? null : StringUtils.abbreviate(StringUtils.trimToEmpty(fileName), 200));
        msg.setSendTime(new Date(now));
        msg.setRecalled("0");
        // @：复用评论那套「按全站昵称、最长前缀匹配」的识别，前端插的就是真实昵称
        msg.setMentions(MentionUtil.resolveTextMentions(text, allNickToId()));
        chatMapper.insert(msg);

        Map<String, Object> view = withSenders(Collections.singletonList(msg)).get(0);
        broker.convertAndSend(WebSocketConfig.ROOM_PREFIX + topicId, envelope("message", view));
        notifyMentioned(msg, me, t);
        return new Result<>(0, "成功", view);
    }

    /**
     * 撤回：自己发的 2 分钟内可撤；专题管理者不受时限（这是他们清理刷屏的手段）。
     * 不删行，只打标记——留着才知道"这里本来有条消息"。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/recall")
    public Object recall(String msgId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        TopicChatMessage msg = StringUtils.isBlank(msgId) ? null : chatMapper.selectById(msgId);
        if (msg == null) {
            return new Result<>(1, "消息不存在", null);
        }
        ForumTopic t = perms.getTopic(msg.getTopicId());
        boolean manager = perms.canManage(me, t);
        boolean mine = me != null && StringUtils.equals(me.getUserId(), msg.getSenderId());
        if (!manager && !mine) {
            return new Result<>(1, "只能撤回自己发的消息", null);
        }
        if (!manager && System.currentTimeMillis() - msg.getSendTime().getTime() > RECALL_WINDOW_MS) {
            return new Result<>(1, "超过 2 分钟就撤不回来了", null);
        }
        msg.setRecalled("1");
        chatMapper.updateById(msg);
        Map<String, Object> data = new HashMap<>();
        data.put("msgId", msg.getMsgId());
        broker.convertAndSend(WebSocketConfig.ROOM_PREFIX + msg.getTopicId(), envelope("recall", data));
        return new Result<>(0, "已撤回", null);
    }

    /** 我在这个专题群聊里的未读条数（别人发的、在我的已读游标之后的）。 */
    @RequiresRole(Role.USER)
    @GetMapping("/unread")
    public Object unread(String topicId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canChat(me, t)) {
            return new Result<>(0, "成功", 0);
        }
        TopicChatRead cursor = readMapper.selectOne(new QueryWrapper<TopicChatRead>()
                .eq("USER_ID", me.getUserId()).eq("TOPIC_ID", topicId));
        QueryWrapper<TopicChatMessage> qw = new QueryWrapper<TopicChatMessage>()
                .eq("TOPIC_ID", topicId).ne("SENDER_ID", me.getUserId()).ne("RECALLED", "1");
        if (cursor != null) {
            qw.gt("SEND_TIME", cursor.getLastRead());
        }
        return new Result<>(0, "成功", chatMapper.selectCount(qw));
    }

    /** 打卡：把已读游标推到此刻（游标只进不退，见 mapper 的 greatest）。 */
    @RequiresRole(Role.USER)
    @PostMapping("/read")
    public Object read(String topicId, HttpServletRequest request) {
        DreamUser me = SecUtil.getLoginUserToSession(request);
        if (me != null && StringUtils.isNotBlank(topicId)) {
            readMapper.upsert(me.getUserId(), topicId, new Date());
        }
        return new Result<>(0, "成功", null);
    }

    // ===== 备份 / 清理 / 占用 =====

    /**
     * 清理前的预览：这个日期之前有多少条、其中多少条带附件。
     * 删除是不可逆的，所以先让题主看清楚要删掉什么。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/purgePreview")
    public Object purgePreview(String topicId, String before, HttpServletRequest request) {
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            return new Result<>(1, "无权管理该专题", null);
        }
        Date cut = parseDate(before);
        if (cut == null) {
            return new Result<>(1, "请选择日期", null);
        }
        Map<String, Object> m = new HashMap<>();
        m.put("count", chatMapper.selectCount(new QueryWrapper<TopicChatMessage>()
                .eq("TOPIC_ID", topicId).lt("SEND_TIME", cut)));
        m.put("files", urlsOf(chatMapper.attachmentsOf(topicId, cut, null)).size());
        return new Result<>(0, "成功", m);
    }

    /**
     * 按日期清理（题主/管理者）：删掉该日期 00:00 之前的消息，**连同它们的图片和附件一起删**。
     * 只删行不删文件的话，磁盘并没有腾出来，那这个功能就没意义了。
     */
    @RequiresRole(Role.USER)
    @PostMapping("/purge")
    public Object purge(String topicId, String before, HttpServletRequest request) {
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            return new Result<>(1, "无权管理该专题", null);
        }
        Date cut = parseDate(before);
        if (cut == null) {
            return new Result<>(1, "请选择日期", null);
        }
        // 相同内容的文件只落一份盘（上传时按内容指纹命名去重），所以删之前要看清楚：
        // 留下来的消息里还有没有人指着同一个 URL。有的话只删行不删文件，否则会把别人的图删没。
        Set<String> doomed = urlsOf(chatMapper.attachmentsOf(topicId, cut, null));
        Set<String> surviving = urlsOf(chatMapper.attachmentsOf(topicId, null, cut));
        doomed.removeAll(surviving);

        // 先删文件再删行——顺序反了就再也找不到该删哪些文件了
        int files = 0;
        for (String url : doomed) {
            java.io.File f = FileUtils.resolveUploadFile(uploadPath, url);
            if (f != null && f.delete()) {
                files++;
            }
        }
        int rows = chatMapper.delete(new QueryWrapper<TopicChatMessage>()
                .eq("TOPIC_ID", topicId).lt("SEND_TIME", cut));
        Map<String, Object> m = new HashMap<>();
        m.put("messages", rows);
        m.put("files", files);
        return new Result<>(0, "已清理", m);
    }

    /** 各专题群聊的占用（仅超管）：正文字节来自库，附件字节按文件逐个 stat。 */
    @RequiresRole(Role.SUPER_MANAGER)
    @GetMapping("/usage")
    public Object usage() {
        // 附件体积按专题汇总：库里只有 URL，大小得去磁盘上问
        Map<String, long[]> fileAgg = new HashMap<>(); // topicId -> [字节数, 文件数]
        for (Map<String, Object> row : chatMapper.attachmentsOf(null, null, null)) {
            String tid = String.valueOf(row.get("topicId"));
            long[] agg = fileAgg.computeIfAbsent(tid, k -> new long[2]);
            for (String key : new String[]{"imageUrl", "fileUrl"}) {
                java.io.File f = FileUtils.resolveUploadFile(uploadPath, (String) row.get(key));
                if (f != null) {
                    agg[0] += f.length();
                    agg[1]++;
                }
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : chatMapper.usageByTopic()) {
            Map<String, Object> m = new HashMap<>(row);
            long[] agg = fileAgg.getOrDefault(String.valueOf(row.get("topicId")), new long[2]);
            long text = row.get("textBytes") == null ? 0 : ((Number) row.get("textBytes")).longValue();
            m.put("fileBytes", agg[0]);
            m.put("files", agg[1]);
            m.put("totalBytes", text + agg[0]);
            out.add(m);
        }
        return new Result<>(0, "成功", out);
    }

    /**
     * 导出备份（题主/管理者）：一个 zip，里面是
     *   messages.json —— 全部消息的结构化数据（含发送者、时间、@ 到谁、附件文件名）
     *   chat.txt      —— 同样的内容排成人能读的流水
     *   files/        —— 所有图片和附件的原件
     * 直接流式写进响应，不在内存里攒整个包——附件多了会撑爆堆。
     */
    @RequiresRole(Role.USER)
    @GetMapping("/export")
    public void export(String topicId, HttpServletRequest request, javax.servlet.http.HttpServletResponse response)
            throws java.io.IOException {
        ForumTopic t = perms.getTopic(topicId);
        if (!perms.canManage(SecUtil.getLoginUserToSession(request), t)) {
            response.setStatus(javax.servlet.http.HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":403,\"msg\":\"无权管理该专题\",\"data\":null}");
            return;
        }
        List<TopicChatMessage> rows = chatMapper.selectList(new QueryWrapper<TopicChatMessage>()
                .eq("TOPIC_ID", topicId).orderByAsc("SEND_TIME"));
        Map<String, String> names = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>().select("USER_ID", "USER_NICKNAME"))) {
            names.put(u.getUserId(), u.getUserNickname());
        }

        String base = "chat-" + safeName(t.getName()) + "-"
                + new java.text.SimpleDateFormat("yyyyMMdd").format(new Date());
        response.setContentType("application/zip");
        // filename* 才是带中文能正确落地的写法；filename= 留个 ASCII 兜底给老浏览器
        response.setHeader("Content-Disposition", "attachment; filename=\"" + base + ".zip\"; "
                + "filename*=UTF-8''" + java.net.URLEncoder.encode(base + ".zip", "UTF-8"));

        try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(response.getOutputStream())) {
            com.alibaba.fastjson.JSONArray arr = new com.alibaba.fastjson.JSONArray();
            StringBuilder txt = new StringBuilder("# ").append(t.getName()).append(" 群聊记录\n\n");
            java.text.SimpleDateFormat fmt = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            java.util.Set<String> packed = new java.util.HashSet<>();

            for (TopicChatMessage m : rows) {
                String who = names.getOrDefault(m.getSenderId(), m.getSenderId());
                String when = m.getSendTime() == null ? "" : fmt.format(m.getSendTime());
                boolean recalled = "1".equals(m.getRecalled());
                String imgName = packFile(zip, m.getImageUrl(), packed);
                String fileName = packFile(zip, m.getFileUrl(), packed);

                com.alibaba.fastjson.JSONObject o = new com.alibaba.fastjson.JSONObject(true);
                o.put("time", when);
                o.put("sender", who);
                o.put("senderId", m.getSenderId());
                o.put("recalled", recalled);
                o.put("content", recalled ? "" : m.getContent());
                o.put("image", imgName);
                o.put("file", fileName);
                o.put("fileName", m.getFileName());
                o.put("mentions", m.getMentions());
                arr.add(o);

                txt.append('[').append(when).append("] ").append(who).append(": ");
                if (recalled) {
                    txt.append("(已撤回)");
                } else {
                    txt.append(StringUtils.trimToEmpty(m.getContent()));
                    if (imgName != null) {
                        txt.append(" [图片 files/").append(imgName).append(']');
                    }
                    if (fileName != null) {
                        txt.append(" [附件 files/").append(fileName).append(']');
                    }
                }
                txt.append('\n');
            }

            zip.putNextEntry(new java.util.zip.ZipEntry("messages.json"));
            zip.write(com.alibaba.fastjson.JSON.toJSONString(arr, true).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new java.util.zip.ZipEntry("chat.txt"));
            zip.write(txt.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zip.closeEntry();
        }
    }

    /** 一批消息行里出现过的所有附件 URL（去重）。 */
    private Set<String> urlsOf(List<Map<String, Object>> rows) {
        Set<String> out = new java.util.HashSet<>();
        for (Map<String, Object> row : rows) {
            for (String key : new String[]{"imageUrl", "fileUrl"}) {
                String u = (String) row.get(key);
                if (StringUtils.isNotBlank(u)) {
                    out.add(u);
                }
            }
        }
        return out;
    }

    /** 把一个附件塞进 zip 的 files/ 下，返回包内文件名；不是本站文件或已经塞过就返回原名/ null。 */
    private String packFile(java.util.zip.ZipOutputStream zip, String url, java.util.Set<String> packed)
            throws java.io.IOException {
        java.io.File f = FileUtils.resolveUploadFile(uploadPath, url);
        if (f == null) {
            return null;
        }
        String name = f.getName();
        if (packed.add(name)) {
            zip.putNextEntry(new java.util.zip.ZipEntry("files/" + name));
            java.nio.file.Files.copy(f.toPath(), zip);
            zip.closeEntry();
        }
        return name;
    }

    /** 文件名里只留安全字符，中文保留（zip 内部用 UTF-8） */
    private String safeName(String s) {
        return StringUtils.trimToEmpty(s).replaceAll("[\\\\/:*?\"<>|\\s]", "_");
    }

    /** yyyy-MM-dd → 当天 00:00；解析不出来返回 null。 */
    private Date parseDate(String s) {
        try {
            return new java.text.SimpleDateFormat("yyyy-MM-dd").parse(StringUtils.trimToEmpty(s));
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> envelope(String type, Object data) {
        Map<String, Object> m = new HashMap<>();
        m.put("type", type);
        m.put("data", data);
        return m;
    }

    /** 全站昵称 → id，@ 识别用。人不多，一次全量查即可（评论那边也是这么做的）。 */
    private Map<String, String> allNickToId() {
        Map<String, String> map = new HashMap<>();
        for (DreamUser u : userMapper.selectList(new QueryWrapper<DreamUser>().select("USER_ID", "USER_NICKNAME"))) {
            if (u != null && StringUtils.isNotBlank(u.getUserNickname())) {
                map.put(u.getUserNickname(), u.getUserId());
            }
        }
        return map;
    }

    /** 被 @ 到的人发一条站内信（排除自己，也排除进不了这个群聊的人——通知他也没用）。 */
    private void notifyMentioned(TopicChatMessage msg, DreamUser sender, ForumTopic t) {
        Set<String> ids = MentionUtil.parseCommentMentionIds(msg.getMentions());
        for (String uid : ids) {
            if (StringUtils.equals(uid, sender.getUserId())) {
                continue;
            }
            DreamUser target = userMapper.selectById(uid);
            if (target == null || !perms.canChat(target, t)) {
                continue;
            }
            userInformationService.saveUserInformation(sender.getUserId(), sender.getUserNickname(), uid,
                    Constants.MENTION_CHAT, msg.getTopicId(), "", "", "", msg.getContent(), "");
        }
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
            boolean recalled = "1".equals(m.getRecalled());
            Map<String, Object> v = new HashMap<>();
            v.put("msgId", m.getMsgId());
            v.put("topicId", m.getTopicId());
            v.put("senderId", m.getSenderId());
            v.put("senderName", u == null ? null : u.getUserNickname());
            v.put("senderAvatar", u == null ? null : u.getAvatar());
            // 撤回的消息不把原文发出去——已经撤了还能从接口里读到就没意义了
            v.put("content", recalled ? "" : m.getContent());
            v.put("imageUrl", recalled ? null : m.getImageUrl());
            v.put("fileUrl", recalled ? null : m.getFileUrl());
            v.put("fileName", recalled ? null : m.getFileName());
            v.put("mentions", recalled ? null : m.getMentions());
            v.put("recalled", recalled);
            v.put("sendTime", m.getSendTime() == null ? null : m.getSendTime().getTime());
            out.add(v);
        }
        return out;
    }
}
