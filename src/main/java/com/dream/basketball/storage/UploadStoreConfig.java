package com.dream.basketball.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 按 {@code upload.backend} 选一个存储后端。
 *
 * <p>三档：{@code local}（现状，也是回滚位）、{@code dual}（双写过渡）、{@code s3}。
 * **改一行配置重启就能来回切**，这是这次改造的后悔药。
 *
 * <p>注意 S3 客户端是**按需构造**的：{@code local} 档下完全不碰 AWS SDK，
 * 所以本机开发不需要任何凭据，跑测试也不会因为连不上 AWS 而失败。
 */
@Configuration
public class UploadStoreConfig {

    private static final Logger log = LoggerFactory.getLogger(UploadStoreConfig.class);

    @Value("${upload.backend:local}")
    private String backend;

    @Value("${picPath.uploadPath:}")
    private String uploadPath;

    @Value("${upload.s3.bucket:}")
    private String bucket;

    @Value("${upload.s3.region:ap-southeast-2}")
    private String region;

    @Value("${upload.s3.key-prefix:uploads/}")
    private String keyPrefix;

    @Bean
    public UploadStore uploadStore() {
        LocalUploadStore local = new LocalUploadStore(uploadPath);
        String mode = backend == null ? "local" : backend.trim().toLowerCase();
        if ("local".equals(mode)) {
            log.info("上传存储后端: local（{}）", uploadPath);
            return local;
        }
        if (bucket == null || bucket.isEmpty()) {
            // 配错了就退回本地而不是启动失败：上传功能降级好过整个站起不来
            log.error("upload.backend={} 但没配 upload.s3.bucket，退回 local", mode);
            return local;
        }
        S3UploadStore s3 = new S3UploadStore(bucket, region, keyPrefix);
        if ("dual".equals(mode)) {
            log.info("上传存储后端: dual（本地 {} + s3://{}/{}）", uploadPath, bucket, keyPrefix);
            return new DualUploadStore(local, s3);
        }
        log.info("上传存储后端: s3://{}/{}", bucket, keyPrefix);
        return s3;
    }
}
