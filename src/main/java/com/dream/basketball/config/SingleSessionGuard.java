package com.dream.basketball.config;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import java.time.Duration;
import java.util.Map;

/**
 * 「网页端一处、App 端一处」——同一账号同时在线的会话数，按客户端类型各限一个。
 *
 * <h2>为什么不是简单的互踢</h2>
 *
 * 全局只留一个会话的话，这个项目自己就用不了：同一个人手机装着 App、电脑开着网页，
 * 每换一台设备另一台就掉线。而「网页一个 + App 一个」既挡住了账号被多处使用，
 * 又不打扰正常的一人多端。
 *
 * <h2>两端是两套机制，所以这里有两段代码</h2>
 *
 * <table border="1">
 *   <tr><th></th><th>网页端</th><th>App 端</th></tr>
 *   <tr><td>凭据</td><td>httpOnly Cookie + Spring Session</td><td>{@code Authorization: Bearer} 随机串</td></tr>
 *   <tr><td>存在哪</td><td>{@code dream:session:sessions:*}</td><td>{@code dream:token:*}</td></tr>
 *   <tr><td>怎么找到同一个人的其它会话</td><td>Spring Session 的 principal 索引</td><td>本类自己维护的指针</td></tr>
 * </table>
 *
 * 网页那边**借的是框架自己的索引**：登录时给 session 打上
 * {@code PRINCIPAL_NAME_INDEX_NAME} 属性，Spring Session 就会维护
 * {@code dream:session:index:...:<userId>} 这个集合，之后按 userId 反查即可。
 * 好处是它的生命周期由框架跟着 session 一起管——自己维护指针的话，
 * session 是 30 天滑动续期而指针不是，续到第 31 天指针先过期，
 * 新登录就找不到旧会话了。
 *
 * App 那边没有这套索引可借（令牌不是 Spring Session），所以自己记一条
 * {@code dream:login:<userId>:app -> sha256(token)}；它的续期由
 * {@link TokenStore#resolve} 跟着令牌一起做，避开同一个陷阱。
 *
 * <h2>已经登录着的人不受影响</h2>
 *
 * 上线时 Redis 里已有的 500 条网页 session 没有 principal 索引，反查不到，
 * 所以不会被踢；等他们下次登录才纳入管理。这是刻意的——上线动作不该把所有人踢下线。
 */
@Component
public class SingleSessionGuard {

    /** 客户端类型：网页端与 App 端各自独立计数 */
    public static final String KIND_WEB = "web";
    public static final String KIND_APP = "app";

    /** App 端指针前缀。和 {@code dream:token:} / {@code dream:session:} 并列 */
    static final String LOGIN_PREFIX = "dream:login:";

    /** 与令牌、session 同口径的 30 天 */
    static final Duration TTL = Duration.ofDays(30);

    @Autowired
    private StringRedisTemplate redis;

    /** Spring Session 的仓库。按 principal 反查用 */
    @Autowired(required = false)
    private FindByIndexNameSessionRepository<? extends Session> indexedSessions;

    @Autowired(required = false)
    private SessionRepository<? extends Session> sessions;

    /**
     * 这个请求来自网页还是 App。
     *
     * <p><b>判据是 {@code Origin} 请求头，不是客户端自报的参数。</b>套壳 App 的 WebView
     * 源是 {@code capacitor://localhost}（iOS）或 {@code http://localhost}（安卓），
     * 网页端是站点域名——这几个源本来就写在 CORS 白名单里
     * （{@link BeanResolveConfiguration#NATIVE_ORIGINS}），不是新引入的约定。
     * 浏览器不允许页面伪造 {@code Origin}，所以网页端冒充不了 App。
     *
     * <p>登录是 POST，浏览器一定会带 {@code Origin}；万一没有（非浏览器客户端、
     * 某些代理剥头），退回看客户端自报的 {@code client} 参数，再退回当网页端。
     * 这条退路不是安全边界：伪造它最多只能让自己多占一个同类名额，
     * 拿不到别人的任何东西。
     *
     * <p><b>手机浏览器和「添加到主屏」的 PWA 算网页端</b>，因为它们跑的就是网页版那份
     * 构建。真正的分界线是「网页版 vs 套壳 App」，不是「电脑 vs 手机」。
     * 想改成按设备类型分，只改这一个方法就够了——下面那套踢人的管道和类型怎么分无关。
     */
    public String kindOf(HttpServletRequest request) {
        String origin = StringUtils.trimToEmpty(request.getHeader("Origin"));
        if (!origin.isEmpty()) {
            for (String nat : BeanResolveConfiguration.NATIVE_ORIGINS) {
                if (origin.equalsIgnoreCase(nat)) {
                    return KIND_APP;
                }
            }
            return KIND_WEB;
        }
        return KIND_APP.equalsIgnoreCase(StringUtils.trimToEmpty(request.getParameter("client")))
                ? KIND_APP : KIND_WEB;
    }

    // ───────────────────────────────────────────── 网页端

    /**
     * 网页端登录成功后调用：给本次 session 打上 principal 索引，并踢掉这个人的其它网页会话。
     *
     * <p>顺序很重要——**先打索引再反查**，否则反查结果里没有自己，
     * 下一次登录时这一条就成了「其它会话」里的孤儿。打了索引之后反查会带上自己，
     * 所以要按 id 把自己排除掉。
     */
    public void enforceWeb(HttpServletRequest request, String userId) {
        HttpSession session = request.getSession(false);
        if (session == null || StringUtils.isBlank(userId)) {
            return;
        }
        session.setAttribute(
                FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME, userId);
        if (indexedSessions == null) {
            return;   // 非索引仓库（本地跑内存 session 时）：不做限制，也不报错
        }
        String mine = session.getId();
        Map<String, ? extends Session> all = indexedSessions.findByPrincipalName(userId);
        for (String id : all.keySet()) {
            if (!StringUtils.equals(id, mine)) {
                indexedSessions.deleteById(id);
            }
        }
    }

    // ───────────────────────────────────────────── App 端

    /**
     * App 端登录成功后调用：作废这个人上一个 App 令牌，把指针指向新的。
     *
     * @param tokenHash 新令牌的哈希（{@link TokenStore#hashOf}）
     */
    public void enforceApp(String userId, String tokenHash) {
        if (StringUtils.isBlank(userId) || StringUtils.isBlank(tokenHash)) {
            return;
        }
        String pointer = LOGIN_PREFIX + userId + ":" + KIND_APP;
        String old = redis.opsForValue().get(pointer);
        if (StringUtils.isNotBlank(old) && !StringUtils.equals(old, tokenHash)) {
            redis.delete(TokenStore.PREFIX + old);
        }
        redis.opsForValue().set(pointer, tokenHash, TTL);
    }

    /** App 令牌续期时把指针一起续上（见类注释里「自己维护指针」的那个陷阱） */
    public void touchApp(String userId) {
        if (StringUtils.isNotBlank(userId)) {
            redis.expire(LOGIN_PREFIX + userId + ":" + KIND_APP, TTL);
        }
    }

    /** 登出时清掉指针（令牌本身由 {@link TokenStore#revoke} 删） */
    public void clearApp(String userId, String tokenHash) {
        if (StringUtils.isBlank(userId)) {
            return;
        }
        String pointer = LOGIN_PREFIX + userId + ":" + KIND_APP;
        String old = redis.opsForValue().get(pointer);
        if (old == null || StringUtils.equals(old, tokenHash)) {
            redis.delete(pointer);
        }
    }

    // ───────────────────────────────────────────── 全部踢掉

    /**
     * 作废这个人的**全部**凭据：网页会话 + App 令牌。改密码时调用。
     *
     * <p>改密码不作废旧凭据是个真实的漏洞：令牌或 Cookie 一旦被抄走，
     * 改密码是拦不住的。当初选「随机串 + Redis」而不是 JWT，理由之一
     * 正是「改密码要能立刻作废已发出的凭据」（见 {@link TokenStore} 类注释），
     * 但那个能力一直没接上。
     *
     * @param keepSessionId 保留哪一条网页 session（改密码的人自己那条，别把他也踢下线）
     */
    public void revokeAll(String userId, String keepSessionId) {
        if (StringUtils.isBlank(userId)) {
            return;
        }
        if (indexedSessions != null) {
            for (String id : indexedSessions.findByPrincipalName(userId).keySet()) {
                if (!StringUtils.equals(id, keepSessionId)) {
                    indexedSessions.deleteById(id);
                }
            }
        }
        String pointer = LOGIN_PREFIX + userId + ":" + KIND_APP;
        String old = redis.opsForValue().get(pointer);
        if (StringUtils.isNotBlank(old)) {
            redis.delete(TokenStore.PREFIX + old);
        }
        redis.delete(pointer);
    }
}
