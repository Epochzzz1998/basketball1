package com.dream.basketball.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;

/**
 * 过渡期用的双写后端：**写两边、读优先 S3 失败回落本地、删两边**。
 *
 * <p>它的作用是把切换拆成可观察的两步——先跑一周 dual，看日志里有没有回落记录、
 * 看桶里对象数在不在涨，确认无误再切 {@code s3}。直接从 local 跳到 s3，
 * 出问题的时候没有中间态可看，只能靠猜。
 *
 * <p>**S3 写失败会抛，本地写失败也会抛。** 不做「S3 失败就静默只写本地」——
 * 那样双写期就变成了单写期而没人知道，等切到 s3 才发现桶里少了一周的文件。
 * 宁可上传报错让人当场看见。
 *
 * <p>这个类是**临时的**，切到 s3 稳定两周后连同 {@code dual} 这个档一起删掉。
 */
public class DualUploadStore implements UploadStore, Closeable {

    private static final Logger log = LoggerFactory.getLogger(DualUploadStore.class);

    private final UploadStore local;
    private final UploadStore s3;

    public DualUploadStore(UploadStore local, UploadStore s3) {
        this.local = local;
        this.s3 = s3;
    }

    @Override
    public void put(String key, byte[] bytes, String contentType, boolean attachment) throws IOException {
        local.put(key, bytes, contentType, attachment);
        s3.put(key, bytes, contentType, attachment);
    }

    @Override
    public boolean exists(String key) {
        // 只要有一边有就算有。写入方靠它跳过重复落盘，宁可多写一次也不能漏
        return s3.exists(key) || local.exists(key);
    }

    @Override
    public InputStream open(String key) throws IOException {
        InputStream in = s3.open(key);
        if (in != null) {
            return in;
        }
        log.info("回落本地读取（S3 没有这个 key）: {}", key);
        return local.open(key);
    }

    @Override
    public long size(String key) {
        long n = s3.size(key);
        return n >= 0 ? n : local.size(key);
    }

    @Override
    public boolean delete(String key) {
        boolean a = s3.delete(key);
        boolean b = local.delete(key);
        return a || b;
    }

    @Override
    public void deleteFolder(String folderKey) {
        s3.deleteFolder(folderKey);
        local.deleteFolder(folderKey);
    }

    @Override
    public String presignedGet(String key, String downloadName, Duration ttl) {
        // 双写期只有 S3 那边签得出直链；存量还没搬完的文件签出来会 404，
        // 所以先确认对象真的在 S3 上再签
        return s3.exists(key) ? s3.presignedGet(key, downloadName, ttl) : null;
    }

    @Override
    public void close() throws IOException {
        if (s3 instanceof Closeable) {
            ((Closeable) s3).close();
        }
    }
}
