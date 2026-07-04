package com.dream.basketball.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Image upload helper (P2-4 security + P4-3 REST).
 *
 * Hardens the old upload, which trusted the attacker-controlled original filename:
 *  - extension whitelist (images only) — blocks .html/.svg/.jsp stored-XSS payloads;
 *  - size cap;
 *  - server-generated random filename (UUID) decoupled from the original — no
 *    same-millisecond overwrite, no name injection;
 *  - path-traversal-safe folder segment (strips ../, /, \);
 *  - robust extension parse — no more substring(-1) crash on extension-less names.
 * Returns the publicly accessible URL; the caller wraps it in a unified Result.
 */
@Component
public class FileUtils {

    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(Arrays.asList(
            "jpg", "jpeg", "png", "gif", "webp", "bmp"));
    // Comment file attachments: images + common documents/archives. Deliberately excludes
    // html/svg/js/jsp/exe/sh etc. (stored-XSS / executable) — same defensive stance as images.
    private static final Set<String> ALLOWED_DOC_EXTENSIONS = new HashSet<>(Arrays.asList(
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "zip", "rar", "7z"));
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024; // 5MB (images)
    private static final long MAX_ATTACHMENT_SIZE = 20L * 1024 * 1024; // 20MB (comment files)

    /** URL prefix that ImgConfigurer maps to the upload dir (e.g. /picImg/). */
    private static String picPath;

    @Value("${picPath.picPath:}")
    public void setPicPath(String picPath) {
        FileUtils.picPath = picPath;
    }

    /**
     * Validate and store an uploaded image, returning its accessible URL.
     *
     * @throws IllegalArgumentException empty / oversize / disallowed type (client error → 400)
     * @throws IOException              storage failure
     */
    public static String upload(MultipartFile file, String uploadPath, String folderKey) throws IOException {
        return store(file, uploadPath, folderKey, ALLOWED_EXTENSIONS, MAX_FILE_SIZE, "仅允许图片 " + ALLOWED_EXTENSIONS);
    }

    /**
     * Store a comment attachment (image OR document). Same hardening as {@link #upload}, but a
     * wider whitelist (images + docs) and a larger size cap. Returns the accessible URL.
     */
    public static String uploadAttachment(MultipartFile file, String uploadPath, String folderKey) throws IOException {
        Set<String> allowed = new HashSet<>(ALLOWED_EXTENSIONS);
        allowed.addAll(ALLOWED_DOC_EXTENSIONS);
        return store(file, uploadPath, folderKey, allowed, MAX_ATTACHMENT_SIZE, "支持图片与常见文档 " + allowed);
    }

    /** Validate (non-empty / size / extension whitelist) then store with a random name; returns the URL. */
    private static String store(MultipartFile file, String uploadPath, String folderKey,
                                Set<String> allowedExt, long maxSize, String typeHint) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件为空");
        }
        if (file.getSize() > maxSize) {
            throw new IllegalArgumentException("文件过大，最大 " + (maxSize / 1024 / 1024) + "MB");
        }
        String ext = safeExtension(file.getOriginalFilename());
        if (!allowedExt.contains(ext)) {
            throw new IllegalArgumentException("不支持的文件类型，" + typeHint);
        }
        // path-traversal-safe folder segment + server-generated filename (decoupled from original name)
        String safeFolder = folderKey == null ? "" : folderKey.replaceAll("[^a-zA-Z0-9_\\-]", "");
        String safeName = UUID.randomUUID().toString().replace("-", "") + "." + ext;

        File dir = safeFolder.isEmpty() ? new File(uploadPath) : new File(uploadPath, safeFolder);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("无法创建上传目录");
        }
        file.transferTo(new File(dir, safeName));

        String urlFolder = safeFolder.isEmpty() ? "" : safeFolder + "/";
        return picPath + urlFolder + safeName;
    }

    /** True if a URL points into our own upload store (rejects external / javascript: URLs on save). */
    public static boolean isLocalUploadUrl(String url) {
        return url != null && picPath != null && !picPath.isEmpty() && url.startsWith(picPath);
    }

    /**
     * Delete one upload folder (e.g. a deleted post's images at {uploadPath}/{folderKey}).
     * The folder segment is sanitized exactly like upload(), and a blank key is refused,
     * so this can never escape or wipe the upload root. Best-effort: quietly no-ops when
     * the folder does not exist.
     */
    public static void deleteUploadFolder(String uploadPath, String folderKey) {
        String safeFolder = folderKey == null ? "" : folderKey.replaceAll("[^a-zA-Z0-9_\\-]", "");
        if (safeFolder.isEmpty() || uploadPath == null || uploadPath.isEmpty()) {
            return;
        }
        File dir = new File(uploadPath, safeFolder);
        File[] children = dir.listFiles();
        if (children != null) {
            for (File child : children) {
                child.delete();
            }
        }
        dir.delete();
    }

    /**
     * Lowercased extension (no dot) of a filename — robust to no extension, a
     * trailing dot, or an embedded path. Returns "" when there is no usable extension.
     */
    static String safeExtension(String originalName) {
        if (originalName == null) {
            return "";
        }
        String name = originalName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
