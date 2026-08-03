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
    // Comment file attachments: images + common documents/archives/plain data. Deliberately
    // excludes html/svg/jsp/exe etc. (stored-XSS / executable) — same stance as images.
    private static final Set<String> ALLOWED_DOC_EXTENSIONS = new HashSet<>(Arrays.asList(
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "zip", "rar", "7z",
            "json", "yaml", "yml", "log", "tsv", "rtf", "odt", "ods", "odp", "epub"));

    /**
     * 专题文件系统改用**黑名单**：它的用途本来就是「什么文件都能放」，白名单每加一种
     * 格式就要改一次代码，而真正需要拦的其实只有两类。
     *
     * <p>第一类是**我们自己域名下会被浏览器当成文档执行的**。上传目录由静态资源处理器
     * 直接对外服务（{@code ImgConfigurer}），Content-Type 完全由扩展名决定，所以一个
     * .html 或 .svg 就是我们域名下的储存型 XSS——这不是「不常见」，是危险。
     * 服务端脚本的扩展名（.php/.jsp…）我们的服务器不执行，但上传目录哪天被别的
     * web server 挂出去就会，留着不花钱。
     *
     * <p>第二类是**双击就中招的 Windows 可执行/脚本**。文件 URL 是无鉴权的，不值得
     * 让站点变成马场。.apk/.dmg/.deb/.jar 这类开发产物**不在**名单里，是有意放开的
     * ——本站自己就在分发 APK。
     *
     * <p>没有扩展名的文件（README、Makefile）也放行，落盘时补 .bin。
     */
    private static final Set<String> DANGEROUS_EXTENSIONS = new HashSet<>(Arrays.asList(
            // 浏览器直接渲染成文档、能跑脚本
            "html", "htm", "xhtml", "xht", "shtml", "svg", "svgz",
            "xml", "xsl", "xslt", "mht", "mhtml", "swf",
            // 服务端脚本名
            "jsp", "jspx", "jspf", "jsw", "jsv", "php", "php3", "php4", "php5", "phtml",
            "asp", "aspx", "ascx", "asa", "cer", "cshtml", "cgi",
            // 双击即执行（Windows 为主）
            "exe", "dll", "msi", "bat", "cmd", "com", "scr", "pif", "hta",
            "vbs", "vbe", "wsf", "wsh", "ps1", "psm1", "reg", "lnk"));
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024; // 10MB (images)
    private static final long MAX_BANNER_SIZE = 20L * 1024 * 1024; // 20MB (topic banners — full-bleed wallpapers)
    private static final long MAX_ATTACHMENT_SIZE = 30L * 1024 * 1024; // 30MB (comment files)

    /** URL prefix that ImgConfigurer maps to the upload dir (e.g. /picImg/). */
    private static String picPath;

    /** 文件名指纹的盐：外置，改了只影响新文件的去重命中，不影响已有链接 */
    private static String hashSalt = "dream-upload";

    @Value("${picPath.hashSalt:dream-upload}")
    public void setHashSalt(String salt) {
        if (salt != null && !salt.isEmpty()) {
            FileUtils.hashSalt = salt;
        }
    }

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
        return store(file, uploadPath, folderKey, ALLOWED_EXTENSIONS::contains, MAX_FILE_SIZE,
                "仅允许图片 " + ALLOWED_EXTENSIONS);
    }

    /**
     * Store a wallpaper-sized image (topic banners). Same whitelist and hardening as
     * {@link #upload}, only the cap differs: banners come straight off a phone camera roll,
     * where 10MB is easy to exceed, and the browser shrinks them to 1600px before upload
     * anyway — so what actually lands on disk is a few hundred KB either way. Raising the
     * cap only changes which files get rejected outright.
     */
    public static String uploadBanner(MultipartFile file, String uploadPath, String folderKey) throws IOException {
        return store(file, uploadPath, folderKey, ALLOWED_EXTENSIONS::contains, MAX_BANNER_SIZE,
                "仅允许图片 " + ALLOWED_EXTENSIONS);
    }

    /**
     * Store a comment attachment (image OR document). Same hardening as {@link #upload}, but a
     * wider whitelist (images + docs) and a larger size cap. Returns the accessible URL.
     */
    public static String uploadAttachment(MultipartFile file, String uploadPath, String folderKey) throws IOException {
        Set<String> allowed = new HashSet<>(ALLOWED_EXTENSIONS);
        allowed.addAll(ALLOWED_DOC_EXTENSIONS);
        return store(file, uploadPath, folderKey, allowed::contains, MAX_ATTACHMENT_SIZE,
                "支持图片与常见文档 " + allowed);
    }

    /**
     * Store a topic file-system file. Same hardening as {@link #upload}, but the extension rule is
     * a **denylist** ({@link #DANGEROUS_EXTENSIONS}) instead of a whitelist — a file system whose
     * point is arbitrary files cannot enumerate its formats in advance.
     */
    public static String uploadTopicFile(MultipartFile file, String uploadPath, String folderKey) throws IOException {
        return store(file, uploadPath, folderKey, ext -> !DANGEROUS_EXTENSIONS.contains(ext),
                MAX_ATTACHMENT_SIZE, "网页脚本与可执行文件不能上传（" + DANGEROUS_EXTENSIONS.size() + " 种）");
    }

    /** Validate (non-empty / size / extension rule) then store with a random name; returns the URL. */
    private static String store(MultipartFile file, String uploadPath, String folderKey,
                                java.util.function.Predicate<String> extAllowed, long maxSize,
                                String typeHint) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件为空");
        }
        if (file.getSize() > maxSize) {
            throw new IllegalArgumentException("文件过大，最大 " + (maxSize / 1024 / 1024) + "MB");
        }
        String ext = safeExtension(file.getOriginalFilename());
        if (!extAllowed.test(ext)) {
            throw new IllegalArgumentException("不支持的文件类型，" + typeHint);
        }
        // path-traversal-safe folder segment; the filename is always server-generated
        String safeFolder = folderKey == null ? "" : folderKey.replaceAll("[^a-zA-Z0-9_\\-]", "");

        // 大图先瘦身再落盘（GIF、带透明的 PNG 会被 ImageUtil 自己放过）。
        // 顺带一提：PNG 转 JPEG 之后扩展名也会变，所以名字要用返回的那个
        byte[] bytes = file.getBytes();
        ImageUtil.Result img = ImageUtil.shrink(bytes, ext);
        bytes = img.data;
        ext = img.ext;

        // 文件名 = 内容指纹。同一个文件重复上传只会落一份盘，天然去重。
        // 加盐是为了让名字仍然猜不到：直接用内容哈希的话，谁手里有同一张图就能拼出 URL
        // 去探测"这张图是不是被发过"，私信附件尤其不该泄露这个。
        // 没有扩展名的文件（README、Makefile，只有黑名单那条路放得进来）补 .bin：
        // 空扩展名会拼出 "xxxx." 这种带尾点的名字。显示名在库里另存，不受影响。
        String safeName = contentName(bytes) + "." + (ext.isEmpty() ? "bin" : ext);

        File dir = safeFolder.isEmpty() ? new File(uploadPath) : new File(uploadPath, safeFolder);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("无法创建上传目录");
        }
        File target = new File(dir, safeName);
        if (!target.exists()) {
            java.nio.file.Files.write(target.toPath(), bytes);
        }

        String urlFolder = safeFolder.isEmpty() ? "" : safeFolder + "/";
        return picPath + urlFolder + safeName;
    }

    /**
     * 内容指纹（32 位十六进制）：同样的字节永远得到同样的名字，不同的字节几乎不可能撞上。
     *
     * 去重就是靠它——文件已经在那儿就不再写一遍。盐让名字不可预测；盐变了顶多是
     * 旧文件不再被复用（多存一份），不会坏掉任何已有链接。
     */
    static String contentName(byte[] bytes) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(
                    hashSalt.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] h = mac.doFinal(bytes);
            StringBuilder sb = new StringBuilder(32);
            for (int i = 0; i < 16; i++) {
                sb.append(String.format("%02x", h[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            // 拿不到 HMAC 就退回随机名：去重是优化，不能因此传不上去
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    /** True if a URL points into our own upload store (rejects external / javascript: URLs on save). */
    public static boolean isLocalUploadUrl(String url) {
        return url != null && picPath != null && !picPath.isEmpty() && url.startsWith(picPath);
    }

    /**
     * 把一个上传 URL（/picImg/xxx/abc.png）还原成磁盘上的文件。
     *
     * 群聊的导出和清理都要按 URL 找到真实文件，这是唯一该做这件事的地方。
     * 三道防线：必须是本站上传前缀、不许出现 .. 之类的段、最后用规范化路径
     * 再确认一次确实落在上传根目录内（软链接和编码绕过都挡掉）。
     * 任何一条不满足、或者文件不存在，都返回 null。
     */
    public static File resolveUploadFile(String uploadPath, String url) {
        if (!isLocalUploadUrl(url) || uploadPath == null || uploadPath.isEmpty()) {
            return null;
        }
        String rel = url.substring(picPath.length());
        if (rel.isEmpty() || rel.startsWith("/") || rel.contains("..")) {
            return null;
        }
        File f = new File(uploadPath, rel);
        try {
            java.nio.file.Path root = new File(uploadPath).getCanonicalFile().toPath();
            if (!f.getCanonicalFile().toPath().startsWith(root)) {
                return null;
            }
        } catch (IOException e) {
            return null;
        }
        return f.isFile() ? f : null;
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
