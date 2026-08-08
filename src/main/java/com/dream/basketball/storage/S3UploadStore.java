package com.dream.basketball.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * S3 后端。
 *
 * <h2>凭据从哪来</h2>
 *
 * 代码里**一个凭据字段都没有**，走 SDK 的默认凭据链：环境变量 → 系统属性 →
 * Web Identity → {@code ~/.aws/credentials} → 容器元数据 → 实例元数据。
 * 现在服务器上是第一档（{@code dream-app/.env} 里的三个变量），
 * 阶段 4 搬上 ECS 之后自动变成第五档（Task Role），**代码零改动**。
 * 写死 {@code AwsBasicCredentials} 就会放弃这个性质。
 *
 * <h2>预签名 URL 是本地算的</h2>
 *
 * {@link #presignedGet} 不发任何网络请求——签名就是用 Secret Key 对
 * 「方法 + 桶 + Key + 过期时间 + 一堆头」算一次 HMAC。所以它零延迟、零费用，
 * 而且在桶的 Block Public Access 全开的情况下照常工作（它不是匿名访问，
 * 是带着我们身份签名的授权访问，两件事不冲突）。
 */
public class S3UploadStore implements UploadStore, Closeable {

    private static final Logger log = LoggerFactory.getLogger(S3UploadStore.class);

    /** 批量删除一次最多 1000 个 key，这是 S3 DeleteObjects 的硬上限 */
    private static final int DELETE_BATCH = 1000;

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final String prefix;

    public S3UploadStore(String bucket, String region, String keyPrefix) {
        this.bucket = bucket;
        this.prefix = keyPrefix == null ? "" : keyPrefix;
        Region r = Region.of(region);
        this.s3 = S3Client.builder().region(r).build();
        this.presigner = S3Presigner.builder().region(r).build();
    }

    private String full(String key) {
        return prefix + key;
    }

    /**
     * key 为空一律当「不存在」处理，不往下走。
     *
     * <p>{@code FileUtils.keyOf} 对外链、越界路径都返回 null，调用方常常直接把结果传进来。
     * 不挡的话 {@code prefix + null} 会拼出 {@code uploads/null} 这种真实存在的 key，
     * 于是「删一个非法 URL」变成了「删一个叫 null 的对象」——本地后端不会有这个问题
     * （它的路径检查会拦下），两个后端行为分叉就是从这种地方开始的。
     */
    private static boolean blank(String key) {
        return key == null || key.isEmpty();
    }

    @Override
    public void put(String key, byte[] bytes, String contentType, boolean attachment) throws IOException {
        if (blank(key)) {
            throw new IOException("key 不能为空");
        }
        PutObjectRequest.Builder b = PutObjectRequest.builder()
                .bucket(bucket)
                .key(full(key))
                .contentType(contentType);
        if (attachment) {
            // 类型在写入时定死之后，扩展名就不再是安全边界了：一个 .html 传上来
            // 也只会被下载，不会在我们域名下渲染成页面
            b.contentDisposition("attachment");
        }
        try {
            s3.putObject(b.build(), RequestBody.fromBytes(bytes));
        } catch (RuntimeException e) {
            throw new IOException("S3 上传失败: " + key, e);
        }
    }

    /** head 一下；不存在返回 null。exists / size 共用，省得写两遍同样的异常处理 */
    private HeadObjectResponse head(String key) {
        if (blank(key)) {
            return null;
        }
        try {
            return s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(full(key)).build());
        } catch (NoSuchKeyException e) {
            return null;
        } catch (RuntimeException e) {
            // 删过的对象 head 会拿到 404（当前版本是删除标记），SDK 抛的不一定是 NoSuchKeyException
            log.debug("head 失败，当作不存在: {}", key, e);
            return null;
        }
    }

    @Override
    public boolean exists(String key) {
        return head(key) != null;
    }

    @Override
    public InputStream open(String key) throws IOException {
        if (blank(key)) {
            return null;
        }
        try {
            return s3.getObject(GetObjectRequest.builder().bucket(bucket).key(full(key)).build());
        } catch (NoSuchKeyException e) {
            return null;
        } catch (RuntimeException e) {
            log.warn("S3 读取失败: {}", key, e);
            return null;
        }
    }

    @Override
    public long size(String key) {
        HeadObjectResponse h = head(key);
        return h == null ? -1 : h.contentLength();
    }

    @Override
    public boolean delete(String key) {
        if (blank(key)) {
            return false;
        }
        try {
            // 桶开了版本控制，所以这里只是**盖一个删除标记**，字节还在。
            // 真正的销毁交给生命周期规则（30 天），而这把密钥没有 s3:DeleteObjectVersion，
            // 就算泄露了也销毁不掉任何数据。
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(full(key)).build());
            return true;
        } catch (RuntimeException e) {
            log.warn("S3 删除失败: {}", key, e);
            return false;
        }
    }

    @Override
    public void deleteFolder(String folderKey) {
        if (folderKey == null || folderKey.isEmpty()) {
            return;   // 空前缀会把整个桶删光
        }
        String p = full(folderKey.endsWith("/") ? folderKey : folderKey + "/");
        try {
            String token = null;
            do {
                ListObjectsV2Response page = s3.listObjectsV2(ListObjectsV2Request.builder()
                        .bucket(bucket).prefix(p).continuationToken(token).build());
                List<ObjectIdentifier> batch = new ArrayList<>();
                for (S3Object o : page.contents()) {
                    batch.add(ObjectIdentifier.builder().key(o.key()).build());
                    if (batch.size() == DELETE_BATCH) {
                        deleteBatch(batch);
                        batch = new ArrayList<>();
                    }
                }
                if (!batch.isEmpty()) {
                    deleteBatch(batch);
                }
                token = Boolean.TRUE.equals(page.isTruncated()) ? page.nextContinuationToken() : null;
            } while (token != null);
        } catch (RuntimeException e) {
            log.warn("S3 删除目录失败: {}", folderKey, e);
        }
    }

    private void deleteBatch(List<ObjectIdentifier> keys) {
        s3.deleteObjects(DeleteObjectsRequest.builder()
                .bucket(bucket)
                .delete(Delete.builder().objects(keys).quiet(true).build())
                .build());
    }

    @Override
    public String presignedGet(String key, String downloadName, Duration ttl) {
        if (blank(key)) {
            return null;
        }
        // response-content-disposition 会覆盖对象自身的元数据，只对这一张签名链接生效。
        // 这一行是「专题文件下载」这个接口能被搬走的原因：落盘名是内容指纹，
        // 原名存在库里，原来必须由我们自己流出去才能带上正确的文件名。
        String fn = URLEncoder.encode(downloadName == null ? key : downloadName, StandardCharsets.UTF_8)
                .replace("+", "%20");
        GetObjectRequest get = GetObjectRequest.builder()
                .bucket(bucket)
                .key(full(key))
                .responseContentType("application/octet-stream")
                .responseContentDisposition("attachment; filename*=UTF-8''" + fn)
                .build();
        return presigner.presignGetObject(r -> r.signatureDuration(ttl).getObjectRequest(get))
                .url().toString();
    }

    @Override
    public void close() {
        s3.close();
        presigner.close();
    }
}
