package com.dream.basketball.storage;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

/**
 * S3 后端的**类路径**测试，不联网。
 *
 * <h2>为什么非要有这个测试</h2>
 *
 * 2026-08-23 切 dual 那次，站点挂了约 4 分钟，根因是 AWS SDK 的 apache-client 需要
 * Apache HttpClient 5.4+，而 Spring Boot 2.7.6 把 httpclient5 钉在 5.1.4 并且赢了——
 * {@code TlsSocketStrategy} 这个类根本不在包里。**构建、单测、启动全都不报错**，
 * 直到第一次真的去构造 S3 客户端，才抛 NoClassDefFoundError。
 *
 * <p>当时之所以能一路推到生产，是因为**从头到尾没有任何一步真的构造过 S3 客户端**：
 * 本地跑的是 local 档，那条分支直接 return，连类都不加载。
 *
 * <p>这个测试就是把那一步补上。它**不发任何网络请求**——预签名是拿密钥在本地算一次
 * HMAC——但它会真的把 S3Client 和 S3Presigner 造出来，类路径缺东西当场就炸。
 * 凭据用系统属性喂假的（SDK 默认凭据链的第二档），签出来的地址不指望能用。
 */
class S3UploadStoreTest {

    @BeforeEach
    void fakeCreds() {
        System.setProperty("aws.accessKeyId", "AKIAQATESTQATESTQATE");
        System.setProperty("aws.secretAccessKey", "0123456789012345678901234567890123456789");
    }

    @AfterEach
    void clearCreds() {
        System.clearProperty("aws.accessKeyId");
        System.clearProperty("aws.secretAccessKey");
    }

    @Test
    void constructsWithoutMissingClasses_andPresignsLocally() {
        try (S3UploadStore store = new S3UploadStore("dream-uploads-epoch", "ap-southeast-2", "uploads/")) {
            String url = store.presignedGet("topicfs-x/abc123.pdf", "季度报告.pdf", Duration.ofMinutes(5));

            assertNotNull(url, "预签名 URL 不该是 null");
            assertTrue(url.startsWith("https://"), url);
            // 桶名和 key 前缀都要出现在地址里
            assertTrue(url.contains("dream-uploads-epoch"), url);
            assertTrue(url.contains("uploads/topicfs-x/abc123.pdf"), url);
            // 签名参数（SigV4）
            assertTrue(url.contains("X-Amz-Signature="), url);
            assertTrue(url.contains("X-Amz-Expires=300"), url);
            // 响应头覆盖：这是「落盘名是指纹、下载时还原成原名」能成立的关键
            assertTrue(url.contains("response-content-disposition"), url);
            // 中文原名要被 URL 编码进去，不能原样出现
            assertFalse(url.contains("季度报告"), "文件名应当是编码过的");
        }
    }

    /** key 为空一律当「不存在」，不能拼出 uploads/null 这种真实存在的键 */
    @Test
    void blankKeyIsRefused() {
        try (S3UploadStore store = new S3UploadStore("dream-uploads-epoch", "ap-southeast-2", "uploads/")) {
            assertNull(store.presignedGet(null, "x.pdf", Duration.ofMinutes(5)));
            assertNull(store.presignedGet("", "x.pdf", Duration.ofMinutes(5)));
            assertFalse(store.delete(null));
            assertFalse(store.delete(""));
        }
    }
}
