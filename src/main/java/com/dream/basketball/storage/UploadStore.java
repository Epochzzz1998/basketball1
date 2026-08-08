package com.dream.basketball.storage;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;

/**
 * 上传文件的存储后端。
 *
 * <h2>为什么要有这一层</h2>
 *
 * 改造前，「按 URL 找到文件」这件事的出口是 {@code FileUtils.resolveUploadFile}，
 * 它**返回 {@code java.io.File}**——这个返回类型本身就把实现钉死在本地文件系统上了，
 * S3 上根本没有「磁盘上的文件」这种东西。典型的抽象泄漏：接口暴露了它不该暴露的实现细节。
 * 不换掉这个类型，第二种存储永远接不进来。
 *
 * <h2>为什么只有这几个方法</h2>
 *
 * 查过全部 6 处 {@code resolveUploadFile} 调用点（TopicFileController ×3、ChatController ×3），
 * 它们真正需要的只有三件事：**删、取字节数、开读流**。加上写和存在性判断，就是这个接口的全部。
 * 不做成通用文件系统——用不到的方法是负债，每加一个都要在三个实现里都写对。
 *
 * <h2>key 是什么</h2>
 *
 * key 是公开 URL 去掉 {@code /picImg/} 前缀之后的那一段，例如
 * {@code topicfs-xxx/9bceb458….pdf}。URL 格式是对外契约（数据库里的帖子正文、
 * 两个 App 的套壳、Service Worker 都依赖它），**只换背后的存储，地址一个字不改**。
 * URL 和 key 的互转在 {@link com.dream.basketball.utils.FileUtils#keyOf}。
 */
public interface UploadStore {

    /**
     * 落一个对象。
     *
     * @param contentType 服务端判定的类型。**在写入时定死**是这次改造的核心安全收益：
     *                    改造前类型由读取时的扩展名决定，于是一个 .html 就是我们域名下的
     *                    储存型 XSS；现在图片写真实类型、其余一律 octet-stream。
     * @param attachment  true 时附带 {@code Content-Disposition: attachment}，
     *                    浏览器只会下载不会渲染
     */
    void put(String key, byte[] bytes, String contentType, boolean attachment) throws IOException;

    /** 已经有了就不用重复写——文件名是内容指纹，重复上传是常态 */
    boolean exists(String key);

    /** 打开读流；不存在返回 null。**调用方负责关** */
    InputStream open(String key) throws IOException;

    /** 字节数；不存在返回 -1 */
    long size(String key);

    /** 删一个对象；返回是否真的删掉了什么。不存在当成功（返回 false） */
    boolean delete(String key);

    /** 删掉一整个前缀下的东西（一篇帖子的配图、一个专题的文件柜） */
    void deleteFolder(String folderKey);

    /**
     * 一张短期有效的直链，带 {@code Content-Disposition} 把文件名还原成 downloadName。
     *
     * <p>**本地后端返回 null**——调用方据此回落到「服务端把字节流出去」那条老路。
     * 这不是降级处理，是本地磁盘本来就没有「让浏览器绕过我们直接取」的概念。
     */
    String presignedGet(String key, String downloadName, Duration ttl);
}
