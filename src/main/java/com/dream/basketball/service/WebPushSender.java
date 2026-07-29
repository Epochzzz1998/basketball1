package com.dream.basketball.service;

import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.entity.PushSubscription;
import com.dream.basketball.entity.UserInformation;
import com.dream.basketball.mapper.PushSubscriptionMapper;
import com.interaso.webpush.VapidKeys;
import com.interaso.webpush.WebPush;
import com.interaso.webpush.WebPushService;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static com.dream.basketball.utils.Constants.COMMENT_COMMENT;
import static com.dream.basketball.utils.Constants.COMMENT_NEWS;
import static com.dream.basketball.utils.Constants.MENTION_CHAT;
import static com.dream.basketball.utils.Constants.MENTION_COMMENT;
import static com.dream.basketball.utils.Constants.MENTION_NEWS;
import static com.dream.basketball.utils.Constants.SCHEDULE_ASSIGN;
import static com.dream.basketball.utils.Constants.SCHEDULE_OVERDUE;
import static com.dream.basketball.utils.Constants.SCHEDULE_REMIND;
import static com.dream.basketball.utils.Constants.TOPIC_APPLY;
import static com.dream.basketball.utils.Constants.TOPIC_APPROVED;
import static com.dream.basketball.utils.Constants.TOPIC_REJECTED;

/**
 * 把站内消息推到用户的手机上（Web Push，RFC 8291 + 8292）。
 *
 * 推送服务（Apple/Google/Mozilla 各一套）只负责转发，**看不懂内容**——载荷是用设备
 * 自己的公钥加密的，密钥在 push_subscription 里。所以这里做三件事：挑出该推的消息、
 * 用每台设备的密钥各加密一份、POST 到各自的 endpoint。
 *
 * 两个刻意的设计：
 *
 * 1. **异步。** 调用点在 saveUserInformation 里，那是业务事务中间。往 Apple 的服务器
 *    发一次 HTTPS 要几百毫秒还可能超时，挂在事务里会把发帖、评论这些操作一起拖慢甚至拖挂。
 *
 * 2. **不推点赞点踩。** 见 PUSHABLE。推送是"打断你现在在做的事"，得配得上这个打断。
 */
@Service
public class WebPushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    /**
     * 哪些消息值得响一下手机。
     *
     * 标准是"需要你知道或需要你处理"，不是"有人碰了你的东西"：
     *  - 被 @、被回复 → 有人在等你
     *  - 日程指派/提醒/超时 → 有时间性
     *  - 专题申请/通过/驳回 → 要么等你审，要么你在等结果
     *
     * **点赞点踩故意不推**（goodNews/badNews/goodComment/badComment）。它们量大、成串来、
     * 而且晚看半天没有任何损失。推了只会让人把通知权限关掉，连带真正要紧的也收不到。
     *
     * follow（有人关注你）同理，属于知道了也不用做什么的，先不推。
     */
    private static final Set<String> PUSHABLE = new HashSet<>(Arrays.asList(
            MENTION_CHAT, MENTION_COMMENT, MENTION_NEWS,
            COMMENT_NEWS, COMMENT_COMMENT,
            SCHEDULE_ASSIGN, SCHEDULE_REMIND, SCHEDULE_OVERDUE,
            TOPIC_APPLY, TOPIC_APPROVED, TOPIC_REJECTED));

    /** 推送服务最多替我们存这么久（秒）。设备关机超过一天再开，这条就不用补了。 */
    private static final int TTL_SECONDS = 24 * 60 * 60;

    @Value("${push.vapid.public-key:}")
    private String publicKey;

    @Value("${push.vapid.private-key:}")
    private String privateKey;

    /** VAPID 的 sub 字段，出问题时推送服务据此联系我们。必须是 mailto: 或 https: */
    @Value("${push.vapid.subject:mailto:bliuzzz1016@gmail.com}")
    private String subject;

    @Autowired
    private PushSubscriptionMapper subMapper;

    /** 套壳 App 那条传输路。没配 Firebase 凭据时它自己就是空操作，这里不用判断 */
    @Autowired
    private FcmSender fcm;

    private WebPushService push;

    /**
     * 单线程就够：这个站的消息量很小，而且顺序发出去比并发更好排查。
     * 用有界队列 + 丢弃策略，宁可漏推也不能因为推送把内存堆满。
     */
    private final ExecutorService pool = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "web-push");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void init() {
        if (StringUtils.isAnyBlank(publicKey, privateKey)) {
            // 没配密钥不是错误：本地开发、以及还没生成密钥的环境都该正常启动，只是不推送
            log.warn("VAPID keys absent — web push disabled. Set push.vapid.* to enable.");
            return;
        }
        try {
            push = new WebPushService(subject, VapidKeys.create(publicKey, privateKey));
            log.info("Web push ready.");
        } catch (Exception e) {
            log.error("VAPID keys present but unusable — web push disabled.", e);
        }
    }

    @PreDestroy
    void shutdown() {
        pool.shutdown();
        try {
            pool.awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** 前端 subscribe() 要用的 applicationServerKey。没配密钥时返回空串，前端据此隐藏开关。 */
    public String applicationServerKey() {
        return push == null ? "" : java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(push.getVapidKeys().getApplicationServerKey());
    }

    /**
     * 消息落库之后调这里。**不抛异常、不阻塞**——推送失败绝不能影响发帖/评论本身。
     *
     * <p>两条传输路一起发：<b>Web Push</b>（网页 / 装到主屏的 PWA）和
     * <b>FCM</b>（套壳 App）。判断"哪些事件值得推"的规则（{@link #PUSHABLE}）只有这一份，
     * 两条路共用——这正是当初插队先做 Web Push 的理由：通知管线里最容易出 bug 的部分
     * （推什么、点开跳哪、失效订阅怎么清）先用便宜的方式踩完，换传输层时原样复用。
     */
    public void notifyAsync(UserInformation info) {
        if (info == null || !PUSHABLE.contains(info.getMsgType())) {
            return;
        }
        String receiverId = info.getReceiverId();
        // 载荷在这里就拼好：异步任务跑起来时业务对象可能已经被改过
        final String payload = push == null ? null : payloadOf(info);
        // FCM 要的是**渲染好的**标题正文（App 关着时由系统直接弹，来不及让 JS 算），
        // 所以这里就算好；规则见 NotificationText 类头的说明
        final String title = fcm.isEnabled() ? NotificationText.titleOf(info) : null;
        final String body = fcm.isEnabled() ? NotificationText.bodyOf(info) : null;
        final String url = fcm.isEnabled() ? NotificationText.linkOf(info) : null;
        try {
            pool.execute(() -> {
                if (payload != null) {
                    sendToUser(receiverId, payload);
                }
                if (title != null) {
                    fcm.sendToUser(receiverId, title, body, url);
                }
            });
        } catch (RuntimeException e) {
            log.warn("Push queue rejected a message for {}", receiverId, e);
        }
    }

    /**
     * 载荷只带**原始字段**，不带渲染好的文案。
     *
     * 文案和跳转链接的规则（哪种消息显示什么话、点了去哪一页）已经在前端
     * notificationText.js 里，service worker 直接复用同一份。在 Java 里再写一遍
     * 就是两份会各自演化的规则，改了一处忘了另一处，通知里的说法和消息列表里的对不上。
     */
    private String payloadOf(UserInformation info) {
        JSONObject o = new JSONObject();
        o.put("userInformationId", info.getUserInformationId());
        o.put("msgType", info.getMsgType());
        o.put("msgId", info.getMsgId());
        o.put("msgIdSecond", info.getMsgIdSecond());
        o.put("operatorName", info.getOperatorName());
        o.put("content", info.getContent());
        o.put("contentMsg", info.getContentMsg());
        return o.toJSONString();
    }

    /**
     * 私信的推送入口。
     *
     * 私信**不经过** saveUserInformation —— 它直接写 dream_private_message 表、走 STOMP
     * 推给在线的标签页，库里根本没有对应的 user_information 行。所以上面那个统一入口
     * 覆盖不到它，必须单开一条。
     *
     * 而私信恰恰是最该响手机的一类：它是一对一的，对方明确在等回复。
     *
     * msgId 里放**发信人 id**，前端据此深链到 /messages?peerId=xxx 直接打开那个会话。
     */
    public void notifyPmAsync(String receiverId, String senderId, String senderName, String content) {
        if (StringUtils.isBlank(receiverId)) {
            return;
        }
        String who = StringUtils.defaultIfBlank(senderName, "有人");
        // 纯附件的私信 content 是空串，通知里给个说得通的占位，别显示成空白
        String text = StringUtils.defaultIfBlank(content, "[附件]");

        JSONObject o = new JSONObject();
        o.put("msgType", "pm");
        o.put("msgId", senderId);
        o.put("operatorName", who);
        o.put("contentMsg", text);
        final String payload = push == null ? null : o.toJSONString();

        final boolean toFcm = fcm.isEnabled();
        final String title = who + " 给你发了一条私信";
        final String body = NotificationText.stripHtml(text);
        final String url = "/messages?peerId=" + senderId;
        try {
            pool.execute(() -> {
                if (payload != null) {
                    sendToUser(receiverId, payload);
                }
                if (toFcm) {
                    fcm.sendToUser(receiverId, title, body, url);
                }
            });
        } catch (RuntimeException e) {
            log.warn("Push queue rejected a PM for {}", receiverId, e);
        }
    }

    /**
     * 给某个人的所有设备发一条测试通知，**同步**发并返回真正成功的台数。
     *
     * 返回成功数而不是设备数：这是个诊断入口，报"已发往 2 台设备"而实际两台都失败了，
     * 等于把唯一的线索藏起来——第一次上线就是这么被瞒过去的。
     *
     * 用 msgType=test，前端 service worker 认这个类型，点开就回消息列表。
     */
    public int sendTest(String userId) {
        int ok = 0;
        if (push != null) {
            JSONObject o = new JSONObject();
            o.put("msgType", "test");
            o.put("operatorName", "测试");
            ok += sendToUser(userId, o.toJSONString());
        }
        // 两条路都试：诊断入口就该把两边的实际结果加在一起报，
        // 只报一边会让"App 收得到、网页收不到"这类问题看上去像全好
        ok += fcm.sendToUser(userId, "测试 推送已经通了", "收到这条就说明整条链路是通的", "/me");
        return ok;
    }

    /** 返回成功送出的台数。 */
    private int sendToUser(String userId, String payload) {
        List<PushSubscription> subs = subMapper.selectList(
                new QueryWrapper<PushSubscription>().eq("USER_ID", userId));
        int ok = 0;
        for (PushSubscription s : subs) {
            try {
                // 参数顺序是 (payload, endpoint, p256dh, auth, ...)，**载荷在前**。
                // 这个库的 javap 签名不带参数名，全是 String，写反了编译照过；
                // 真正说明顺序的是它的 byte[] 重载 send(byte[], String, byte[], byte[], ...)
                // ——第一个是 byte[] 只可能是载荷，第二个 String 才是 endpoint。
                // 写反的表现是把 JSON 当 URI 解析：URISyntaxException: Illegal character in scheme name
                WebPush.SubscriptionState state = push.send(
                        payload, s.getEndpoint(), s.getP256dh(), s.getAuth(),
                        TTL_SECONDS, null, WebPush.Urgency.Normal);
                if (state == WebPush.SubscriptionState.EXPIRED) {
                    // 推送服务明确说这个订阅没了（卸载、清数据、换设备）。留着只会每次都失败一遍
                    subMapper.deleteById(s.getSubId());
                    log.info("Dropped expired push subscription {}", s.getSubId());
                } else {
                    s.setLastOk(new Date());
                    subMapper.updateById(s);
                    ok++;
                }
            } catch (Exception e) {
                // 网络抖动、推送服务 5xx：这次漏掉就漏掉了，不重试也不删订阅
                log.warn("Push failed for subscription {}", s.getSubId(), e);
            }
        }
        return ok;
    }
}
