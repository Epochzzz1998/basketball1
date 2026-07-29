package com.dream.basketball.config;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

/**
 * 验证码答案的存取（阶段 1 · Token 认证）。
 *
 * <h2>原来的写法为什么在 App 里必然坏掉</h2>
 *
 * 现在是这样的：
 *
 * <pre>{@code
 * // GET /user/captcha  —— 出图，把答案写进 session
 * request.getSession().setAttribute("captcha", specCaptcha.text().toLowerCase());
 *
 * // POST /user/login   —— 从 session 里取出来比对
 * Object sessionCaptcha = request.getSession().getAttribute("captcha");
 * }</pre>
 *
 * 两次请求靠 <b>Cookie 里的 session id</b> 串起来。而 App 端根本没有 Cookie，
 * 两次请求在服务端看来毫无关系——取图那次写进了 A session，登录那次读的是 B session，
 * 永远读到 null，<b>验证码永远错</b>。
 *
 * <p>更关键的是顺序问题：这是<b>登录之前</b>的事，那时候还没有令牌可用，
 * 所以不能指望"用令牌把两次请求关联起来"。必须由服务端发一个一次性的凭据，
 * 客户端原样带回来——这就是 {@code captchaId}。
 *
 * <h2>换成什么</h2>
 *
 * <pre>
 * GET  /user/captchaJson  →  {captchaId: "xxx", image: "data:image/gif;base64,..."}
 *                            答案存 Redis: dream:captcha:xxx = "1234"，2 分钟过期
 * POST /user/login        →  带上 captchaId + code，服务端取出来比对，比完即删
 * </pre>
 *
 * 不依赖 session，所以浏览器和 App 走的是同一套。
 *
 * <h2>三个必须做对的地方</h2>
 *
 * <b>① 用完立刻删（一次性）。</b> 不删的话，一张验证码能反复提交，
 * 撞库脚本只要过一次人工识别就能一直用——验证码就白设了。
 * 这里用 {@code getAndDelete} 保证"取出来"和"删掉"是原子的，
 * 否则并发提交两次会同时取到同一个答案。
 *
 * <b>② 短过期。</b> 2 分钟。验证码是"证明这一刻有人在操作"，
 * 留半小时等于给自动化留了半小时的窗口。
 *
 * <b>③ id 要不可猜。</b> 用随机串而不是自增数字：可猜的话，攻击者能先请求一张
 * 自己看得懂的验证码，再拿别人的 id 去试。
 */
@Component
public class CaptchaStore {

    private static final String PREFIX = "dream:captcha:";
    /** 2 分钟：够一个人看清并输入，又不给自动化留窗口 */
    private static final Duration TTL = Duration.ofMinutes(2);
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private StringRedisTemplate redis;

    /** 存下一张验证码的答案，返回给客户端的 id */
    public String save(String answer) {
        byte[] buf = new byte[16];
        RANDOM.nextBytes(buf);
        String id = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
        redis.opsForValue().set(PREFIX + id, answer, TTL);
        return id;
    }

    /**
     * 取出并<b>立即删除</b>某个 id 的答案；不存在或已过期返回 null。
     *
     * <p>{@code getAndDelete} 是 Redis 6.2 的 GETDEL，一条命令完成"读+删"。
     * 分成 GET 再 DEL 两步的话，两个并发请求会同时读到同一个答案，
     * 一次性就不成立了。
     */
    public String consume(String id) {
        if (StringUtils.isBlank(id)) {
            return null;
        }
        return redis.opsForValue().getAndDelete(PREFIX + id);
    }
}
