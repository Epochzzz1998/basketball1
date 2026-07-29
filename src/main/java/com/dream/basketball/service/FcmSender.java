package com.dream.basketball.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.dream.basketball.entity.PushDevice;
import com.dream.basketball.mapper.PushDeviceMapper;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.Date;
import java.util.List;

/**
 * 安卓原生推送（FCM HTTP v1）。
 *
 * <h2>为什么不用 firebase-admin</h2>
 *
 * 官方 SDK 一行就能发，但它会拖进 Guava、gRPC、protobuf、google-http-client 一大串，
 * 而这个项目是 Spring Boot 2.7，Guava 和 protobuf 的版本冲突是这类依赖最常见的坑，
 * 撞上了要花的时间远超自己写。
 *
 * 而我们只需要它的**一个**能力：往一个设备令牌发一条通知。
 * 那条路只有两步 HTTP，纯 JDK 就能做完：
 *
 * <pre>
 * ① 用服务账号的私钥签一个 JWT  ──▶  oauth2.googleapis.com/token  ──▶  access_token（1 小时）
 * ② Bearer access_token         ──▶  fcm.googleapis.com/v1/projects/{id}/messages:send
 * </pre>
 *
 * <h2>凭据放哪</h2>
 *
 * 服务账号 JSON **整个 base64 之后塞进服务器的 .env**（`FCM_SERVICE_ACCOUNT_B64`），
 * 和 VAPID 私钥同一个待遇。
 *
 * 为什么不是挂一个文件进容器：那要改 docker-compose 加一个 bind mount，
 * 多一处部署时容易忘的东西；而且私钥是多行 PEM，直接写进 .env 会被换行折断。
 * base64 之后是一整行，什么都不用改。
 *
 * <h2>没配凭据时整个类静默失效</h2>
 *
 * 和 {@link WebPushSender} 一样：读不到凭据就 {@code enabled=false}，
 * 所有发送变成空操作。本地开发和测试环境不会因为少一个密钥就起不来。
 */
@Service
public class FcmSender {

    private static final Logger log = LoggerFactory.getLogger(FcmSender.class);

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    /** 提前 5 分钟换新的：别掐着 1 小时的点用，时钟稍有偏差就会拿到 401 */
    private static final long REFRESH_MARGIN_MS = 5 * 60 * 1000L;

    @Value("${fcm.service-account-b64:}")
    private String serviceAccountB64;

    @Autowired
    private PushDeviceMapper deviceMapper;

    private boolean enabled;
    private String projectId;
    private String clientEmail;
    private PrivateKey privateKey;

    private volatile String accessToken;
    private volatile long accessTokenExpiresAt;

    @PostConstruct
    void init() {
        if (StringUtils.isBlank(serviceAccountB64)) {
            log.warn("FCM service account absent — native push disabled. Set FCM_SERVICE_ACCOUNT_B64 to enable.");
            return;
        }
        try {
            String json = new String(Base64.getDecoder().decode(serviceAccountB64.trim()), StandardCharsets.UTF_8);
            JSONObject sa = JSON.parseObject(json);
            projectId = sa.getString("project_id");
            clientEmail = sa.getString("client_email");
            privateKey = parsePkcs8(sa.getString("private_key"));
            enabled = StringUtils.isNoneBlank(projectId, clientEmail) && privateKey != null;
            log.info("FCM ready, project={}", projectId);
        } catch (Exception e) {
            // 凭据坏了要吵一声，但不能让应用起不来——推送不是核心链路
            log.error("FCM service account unreadable — native push disabled", e);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * 发给某个用户的**全部**设备。返回成功条数。
     *
     * <p>同一个人可能同时装了手机和平板，所以是 1 对 N。
     */
    public int sendToUser(String userId, String title, String body, String url) {
        if (!enabled || StringUtils.isBlank(userId)) {
            return 0;
        }
        List<PushDevice> devices = deviceMapper.selectList(
                new QueryWrapper<PushDevice>().eq("USER_ID", userId));
        int ok = 0;
        for (PushDevice d : devices) {
            if (send(d, title, body, url)) {
                ok++;
            }
        }
        return ok;
    }

    private boolean send(PushDevice device, String title, String body, String url) {
        try {
            JSONObject notification = new JSONObject();
            notification.put("title", title);
            notification.put("body", body);

            JSONObject data = new JSONObject();
            data.put("url", url == null ? "/me" : url);   // 点开跳哪儿，和 Web Push 同一套规则

            JSONObject message = new JSONObject();
            message.put("token", device.getToken());
            message.put("notification", notification);
            message.put("data", data);

            JSONObject payload = new JSONObject();
            payload.put("message", message);

            int code = post("https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send",
                    payload.toJSONString(), "Bearer " + accessToken());
            if (code == 200) {
                deviceMapper.touchLastOk(device.getDeviceId(), new Date());
                return true;
            }
            // 404 UNREGISTERED / 400 INVALID_ARGUMENT：这个令牌已经死了（卸载、清数据、令牌轮换）。
            // 留着它每次都会白发一次，而且量大了会被 FCM 判定为滥用
            if (code == 404 || code == 400) {
                log.info("FCM token dead (HTTP {}), removing device {}", code, device.getDeviceId());
                deviceMapper.deleteById(device.getDeviceId());
            } else {
                log.warn("FCM send failed with HTTP {} for device {}", code, device.getDeviceId());
            }
        } catch (Exception e) {
            log.warn("FCM send blew up for device {}", device.getDeviceId(), e);
        }
        return false;
    }

    // ───────────────────────────── OAuth：JWT 换 access_token

    /** 缓存的访问令牌；快过期了就换一个。加 synchronized 是因为推送在单线程池里跑，争用本来就少 */
    private synchronized String accessToken() throws Exception {
        long now = System.currentTimeMillis();
        if (accessToken != null && now < accessTokenExpiresAt - REFRESH_MARGIN_MS) {
            return accessToken;
        }
        String jwt = signedJwt(now);
        String form = "grant_type=" + urlEncode("urn:ietf:params:oauth:grant-type:jwt-bearer")
                + "&assertion=" + urlEncode(jwt);
        String resp = postForString(TOKEN_URL, form, "application/x-www-form-urlencoded");
        JSONObject o = JSON.parseObject(resp);
        accessToken = o.getString("access_token");
        accessTokenExpiresAt = now + o.getLongValue("expires_in") * 1000L;
        return accessToken;
    }

    /**
     * 服务账号的 JWT：header.claims 各自 base64url，用私钥 RS256 签第三段。
     *
     * <p>`aud` 必须正好是令牌端点的地址——Google 用它防止一个签给别处的断言被拿来这里用。
     */
    private String signedJwt(long now) throws Exception {
        String header = b64url("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
        long iat = now / 1000;
        JSONObject claims = new JSONObject();
        claims.put("iss", clientEmail);
        claims.put("scope", SCOPE);
        claims.put("aud", TOKEN_URL);
        claims.put("iat", iat);
        claims.put("exp", iat + 3600);
        String body = b64url(claims.toJSONString());

        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initSign(privateKey);
        sig.update((header + "." + body).getBytes(StandardCharsets.UTF_8));
        return header + "." + body + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(sig.sign());
    }

    /** JSON 里的 private_key 是带页眉页脚和换行的 PEM，去掉之后才是 base64 的 PKCS#8 */
    private static PrivateKey parsePkcs8(String pem) throws Exception {
        if (StringUtils.isBlank(pem)) {
            return null;
        }
        String base64 = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        return KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
    }

    // ───────────────────────────── 光秃秃的 HTTP，不引客户端库

    private static int post(String url, String json, String auth) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        c.setRequestProperty("Authorization", auth);
        try (OutputStream os = c.getOutputStream()) {
            os.write(json.getBytes(StandardCharsets.UTF_8));
        }
        int code = c.getResponseCode();
        c.disconnect();
        return code;
    }

    private static String postForString(String url, String form, String contentType) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestProperty("Content-Type", contentType);
        try (OutputStream os = c.getOutputStream()) {
            os.write(form.getBytes(StandardCharsets.UTF_8));
        }
        try (java.io.InputStream in = c.getResponseCode() < 400 ? c.getInputStream() : c.getErrorStream()) {
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
            }
            return buf.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    private static String b64url(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    private static String urlEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);   // UTF-8 一定存在
        }
    }
}
