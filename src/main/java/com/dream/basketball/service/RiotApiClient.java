package com.dream.basketball.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Riot 公开 API 的客户端。纯 JDK，不引 SDK——需要的只有两个 GET，
 * 而官方 SDK 会拖进一大串传递依赖（这个项目是 Boot 2.7，版本冲突是这类依赖最常见的坑）。
 * 同样的判断在 {@link FcmSender} 那边已经验证过一次。
 *
 * <h2>三类接口，三个不同的主机</h2>
 *
 * 这是上手最容易踩的坑：同一把 key，三种路由方式。
 *
 * <pre>
 *   Riot ID → PUUID   account-v1   asia.api.riotgames.com    ← 只有 americas/asia/europe，**没有 sea**
 *   对局列表 / 详情     match-v5     sea.api.riotgames.com     ← 澳服的对局在 SEA 集群
 *   段位等平台级        league-v4    oc1.api.riotgames.com
 * </pre>
 *
 * <b>主机写错报的是 403，不是 404</b>（2026-07-30 实测：account-v1 打 sea → 403 Forbidden，
 * match-v5 打 oc1 → 403 Forbidden）。看到 Forbidden 的第一反应一定是「key 过期了」，
 * 而真正的原因往往是主机用错了——尤其 dev key 24 小时就过期，这个误判会更容易发生。
 * 所以 {@link RiotException} 在 403 时把请求的主机一起带出去。
 *
 * <h2>限流：全局串行 + 按响应头自适应</h2>
 *
 * Riot 明说限额会变，所以**不硬编数字**，而是读 {@code X-App-Rate-Limit} 响应头
 * （形如 {@code 100:120,20:1} = 120 秒内 100 次、1 秒内 20 次），
 * 取其中**最严的那条**推出安全间隔：
 *
 * <pre>
 *   100:120 → 1200 ms/次      20:1 → 50 ms/次      取最大值 → 1200 ms
 * </pre>
 *
 * 然后所有请求串行、按这个间隔发。这么做放弃了「1 秒内突发 20 次」的额度，
 * 但那点额度对本模块毫无用处：常规轮询 20 个账号每 5 分钟一轮只占配额 8%，
 * 唯一的大批量是首次回填，而回填慢几分钟没有任何影响。
 * 换来的是**永远不会撞 429**，代码里也就不需要一套重试和退避的状态机。
 */
@Component
public class RiotApiClient {

    private static final Logger log = LoggerFactory.getLogger(RiotApiClient.class);

    /** 起始间隔。第一次拿到响应头之后就会被真实值取代 */
    private static final long INITIAL_INTERVAL_MS = 1300;
    /** 安全余量：Riot 的计数窗口和我们的时钟不可能完全对齐，贴着极限发迟早擦枪走火 */
    private static final double MARGIN = 1.05;

    @Value("${riot.api-key:}")
    private String apiKey;

    /** 请求全局串行。同时也是「上一次发出的时刻」的锁 */
    private final Object gate = new Object();
    private long lastRequestAt = 0;
    private volatile long intervalMs = INITIAL_INTERVAL_MS;

    /** 没配 key 时整个模块静默停用，而不是让应用起不来（同 VAPID / FCM 的处理） */
    public boolean isConfigured() {
        return StringUtils.isNotBlank(apiKey);
    }

    // ───────────────────────────────────────────── 对外的三个接口

    /**
     * Riot ID → 账号信息（含 PUUID）。找不到这个人时抛 404。
     *
     * <p>只在**绑定时**调一次，之后 PUUID 永久存库。这也是本模块唯一会查
     * 「任意 ID」的地方——查得到任何人是 API 本身的性质，不是漏洞。
     */
    public JSONObject accountByRiotId(String gameName, String tagLine) {
        String path = "/riot/account/v1/accounts/by-riot-id/"
                + enc(gameName) + "/" + enc(tagLine);
        return JSON.parseObject(get("asia", path));
    }

    /**
     * 某人最近的对局 id。
     *
     * @param startTimeSec 只要这个时刻之后的（epoch 秒）；null = 不限
     * @param count        单次上限 100，这是 Riot 定的
     */
    public List<String> matchIds(String region, String puuid, Long startTimeSec, int start, int count) {
        StringBuilder q = new StringBuilder("/lol/match/v5/matches/by-puuid/" + enc(puuid)
                + "/ids?start=" + start + "&count=" + Math.min(count, 100));
        if (startTimeSec != null) {
            q.append("&startTime=").append(startTimeSec);
        }
        JSONArray arr = JSON.parseArray(get(region, q.toString()));
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < arr.size(); i++) {
            ids.add(arr.getString(i));
        }
        return ids;
    }

    /**
     * 一场对局的完整详情，**返回原文而不是解析后的对象**——原文要原样 gzip 存库，
     * 解析再序列化回去会丢字段顺序、也丢掉将来可能有用的未知字段。
     */
    public String matchDetailRaw(String region, String matchId) {
        return get(region, "/lol/match/v5/matches/" + enc(matchId));
    }

    // ───────────────────────────────────────────── 底层

    private String get(String host, String path) {
        if (!isConfigured()) {
            throw new RiotException(0, host, "RIOT_API_KEY 没配置");
        }
        pace();
        String url = "https://" + host + ".api.riotgames.com" + path;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod("GET");
            c.setConnectTimeout(10000);
            c.setReadTimeout(20000);
            c.setRequestProperty("X-Riot-Token", apiKey);
            int code = c.getResponseCode();
            adaptInterval(c.getHeaderField("X-App-Rate-Limit"));
            String body = read(code < 400 ? c.getInputStream() : c.getErrorStream());
            if (code >= 400) {
                throw new RiotException(code, host, brief(body));
            }
            return body;
        } catch (IOException e) {
            throw new RiotException(-1, host, e.getClass().getSimpleName() + ": " + e.getMessage());
        } finally {
            if (c != null) {
                c.disconnect();
            }
        }
    }

    /** 串行 + 保持最小间隔。刻意用 sleep 而不是队列/信号量：调用方本来就是后台任务，阻塞它没有代价 */
    private void pace() {
        synchronized (gate) {
            long wait = lastRequestAt + intervalMs - System.currentTimeMillis();
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RiotException(-1, "-", "被中断");
                }
            }
            lastRequestAt = System.currentTimeMillis();
        }
    }

    /**
     * 从 {@code X-App-Rate-Limit} 反推安全间隔。
     *
     * <p>头的格式是逗号分隔的若干 {@code 次数:秒数}。每一条都给出一个「平均多久能发一次」，
     * **取最大值**才能同时满足所有窗口——取最小值等于只顾着最宽松的那条，另一条立刻爆。
     */
    private void adaptInterval(String header) {
        if (StringUtils.isBlank(header)) {
            return;
        }
        long strictest = 0;
        for (String pair : header.split(",")) {
            String[] kv = pair.trim().split(":");
            if (kv.length != 2) {
                continue;
            }
            try {
                long times = Long.parseLong(kv[0].trim());
                long seconds = Long.parseLong(kv[1].trim());
                if (times > 0 && seconds > 0) {
                    strictest = Math.max(strictest, (long) (seconds * 1000.0 / times * MARGIN));
                }
            } catch (NumberFormatException ignored) {
                // 头的格式变了就沿用当前间隔，不要因为解析失败把自己卡死或者放飞
            }
        }
        if (strictest > 0 && strictest != intervalMs) {
            log.info("Riot 限流间隔调整为 {} ms（响应头 {}）", strictest, header);
            intervalMs = strictest;
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String read(InputStream in) throws IOException {
        if (in == null) {
            return "";
        }
        try (InputStream is = in) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = is.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
            }
            return buf.toString(StandardCharsets.UTF_8.name());
        }
    }

    /** 错误体可能很长，日志里留个能认出问题的开头就够 */
    private static String brief(String body) {
        if (body == null) {
            return "";
        }
        String s = body.replaceAll("\\s+", " ").trim();
        return s.length() > 160 ? s.substring(0, 160) : s;
    }

    /**
     * 调 Riot 失败。{@code status} 是 HTTP 状态码，-1 表示连接层面的失败、0 表示没配 key。
     *
     * <p>调用方主要分三种情况处理：404 记下别重试（这场对局不存在）、
     * 403 报警（key 或主机的问题，会导致抓取**静默停摆**）、其余重试。
     */
    public static class RiotException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final int status;
        private final String host;

        public RiotException(int status, String host, String msg) {
            super("Riot " + status + " @" + host + " " + msg);
            this.status = status;
            this.host = host;
        }

        public int getStatus() {
            return status;
        }

        public String getHost() {
            return host;
        }

        /** 主机写错和 key 失效都报这个，所以消息里必须带上主机名，否则会往错的方向查 */
        public boolean isForbidden() {
            return status == 403 || status == 401;
        }

        public boolean isNotFound() {
            return status == 404;
        }
    }
}
