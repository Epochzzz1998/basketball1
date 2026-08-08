package com.dream.basketball.storage;

import com.dream.basketball.utils.FileUtils;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.time.Duration;

/**
 * 本地磁盘后端——就是改造前的行为，一个字节都没变。
 *
 * <p>它存在的意义不是「另一种选择」，而是**回滚路径**：{@code upload.backend=local}
 * 时整个应用的表现和改造前完全一致，所以部署那天可以先只上代码、不切存储，
 * 把「重构有没有改坏东西」和「S3 有没有配对」两类故障分开（见文档 63 §C）。
 *
 * <p>路径安全**不自己写**，一律走 {@link FileUtils#resolveUploadFile}——那里有三道防线
 * （必须是本站上传前缀、不许出现 {@code ..} 之类的段、规范化路径确认落在上传根目录内），
 * 已经在线上跑了很久。同一条规则写两份就是下一个 bug 的来源。
 */
public class LocalUploadStore implements UploadStore {

    private final String root;

    public LocalUploadStore(String root) {
        this.root = root;
    }

    /** key → 磁盘文件；任何一道检查不过、或文件不存在，都返回 null */
    private File fileOf(String key) {
        return FileUtils.resolveUploadFile(root, FileUtils.urlOf(key));
    }

    @Override
    public void put(String key, byte[] bytes, String contentType, boolean attachment) throws IOException {
        // 本地后端存不下类型信息——磁盘上只有字节。contentType / attachment 在这里必然被丢掉，
        // 这正是老架构那个「类型由读取时的扩展名决定」问题的根源，也是迁 S3 的理由之一。
        // 现阶段由 ImgConfigurer 的 nosniff 头兜底（见 51-专题文件系统 §10）。
        File target = new File(root, key);
        File dir = target.getParentFile();
        if (dir != null && !dir.exists() && !dir.mkdirs()) {
            throw new IOException("无法创建上传目录");
        }
        if (!target.exists()) {
            Files.write(target.toPath(), bytes);
        }
    }

    @Override
    public boolean exists(String key) {
        return fileOf(key) != null;
    }

    @Override
    public InputStream open(String key) throws IOException {
        File f = fileOf(key);
        return f == null ? null : Files.newInputStream(f.toPath());
    }

    @Override
    public long size(String key) {
        File f = fileOf(key);
        return f == null ? -1 : f.length();
    }

    @Override
    public boolean delete(String key) {
        File f = fileOf(key);
        return f != null && f.delete();
    }

    @Override
    public void deleteFolder(String folderKey) {
        FileUtils.deleteUploadFolderOnDisk(root, folderKey);
    }

    /** 本地磁盘没有「让浏览器绕过我们直接取」这回事，返回 null 让调用方走流式直出 */
    @Override
    public String presignedGet(String key, String downloadName, Duration ttl) {
        return null;
    }
}
