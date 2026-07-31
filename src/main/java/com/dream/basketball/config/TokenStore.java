package com.dream.basketball.config;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

/**
 * 登录令牌的签发、校验与吊销（阶段 1 · Token 认证）。
 *
 * <h2>为什么要有令牌，Cookie 不够用吗</h2>
 *
 * 浏览器里够用。但套壳成 App 之后 WebView 的源变成 {@code capacitor://localhost}，
 * 三条一起挡住 Cookie：请求成了跨源要靠 CORS；跨源带 Cookie 需要
 * {@code SameSite=None; Secure}，而 {@code Secure} 要求源是 HTTPS，{@code capacitor://} 不是；
 * iOS 的 WKWebView 还有 ITP，会主动清理它认为属于第三方的 Cookie。
 * {@code Authorization: Bearer} 是一个普通请求头，同源策略、SameSite、ITP 一条都管不到它。
 *
 * <h2>为什么是随机串 + Redis，不是 JWT</h2>
 *
 * <table border="1">
 *   <tr><th></th><th>自签 JWT</th><th>随机串 + Redis</th></tr>
 *   <tr><td>要引库</td><td>要</td><td>不要</td></tr>
 *   <tr><td>密钥轮换</td><td>要管</td><td>没有这回事</td></tr>
 *   <tr><td><b>主动吊销</b></td><td><b>做不到</b>，签出去就只能等它过期</td><td>一条 DEL</td></tr>
 * </table>
 *
 * 决定性的是第三行：封号、改密码、"退出所有设备"这些都要求能立刻作废一个已经发出去的凭据，
 * JWT 天生做不到（除非再挂一张黑名单，那就等于又回到了需要 Redis）。
 * 而这个项目的 session 本来就存在 Redis 里、30 天滑动过期——语义完全一致，
 * 等于把已有的机制换一种取用方式，不是新引入一套。
 *
 * <h2>为什么存的是哈希而不是令牌本身</h2>
 *
 * Redis 里存 {@code sha256(token)}。这样即使有人拿到了 Redis 的内容（备份文件、
 * {@code KEYS *} 扫一遍、快照泄露），也**推不回**能用的令牌——他手里只有哈希。
 * 代价是每次请求多算一次 SHA-256，微秒级。
 * 这和密码不存明文是同一个道理：令牌就是一段和密码等价的凭据。
 *
 * <p>不加盐：令牌本身是 32 字节的强随机，没有字典可撞，加盐防的是"弱口令被彩虹表反查"，
 * 这里那个前提不成立。
 */
@Component
public class TokenStore {

    /** Redis key 前缀。和 session 的 {@code dream:session} 并列，一眼看得出是哪一类 */
    static final String PREFIX = "dream:token:";

    /**
     * 30 天滑动过期——**和现有 session 的口径完全一致**
     * （{@code application-ubuntu.yml} 里 {@code spring.session.timeout: 30d}）。
     * 两套凭据的有效期不一致会造出很难解释的现象：网页还登着、App 掉线了，反之亦然。
     */
    private static final Duration TTL = Duration.ofDays(30);

    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private StringRedisTemplate redis;

    /**
     * 签发一个新令牌。
     *
     * <p>32 字节强随机，Base64 URL 安全编码去掉填充 = 43 个字符。
     * 用 URL 安全字母表是因为这串东西会出现在 WebSocket 握手的查询参数里
     * （握手不能自定义请求头，见 {@code WebSocketConfig}），普通 Base64 的
     * {@code +} {@code /} {@code =} 在 URL 里都要转义。
     */
    public String issue(String userId) {
        byte[] buf = new byte[32];
        RANDOM.nextBytes(buf);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
        redis.opsForValue().set(PREFIX + hash(token), userId, TTL);
        return token;
    }

    /**
     * 令牌 → 用户 id；无效或已过期返回 null。
     *
     * <p>命中就续期，所以"一直在用的 App 不会掉线，三十天没打开的会"——
     * 和网页端 session 的行为一样。
     */
    public String resolve(String token) {
        if (StringUtils.isBlank(token)) {
            return null;
        }
        String key = PREFIX + hash(token);
        String userId = redis.opsForValue().get(key);
        if (userId != null) {
            redis.expire(key, TTL);   // 滑动续期
        }
        return userId;
    }

    /** 作废一个令牌（登出）。已经不存在也不报错。 */
    public void revoke(String token) {
        if (StringUtils.isNotBlank(token)) {
            redis.delete(PREFIX + hash(token));
        }
    }

    /** 令牌 → 存进 Redis 的那个哈希。{@link SingleSessionGuard} 要拿它记指针 */
    public static String hashOf(String token) {
        return hash(token);
    }

    private static String hash(String token) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(d);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 必须实现的算法，走不到这儿；真走到了也不能降级成明文存
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
